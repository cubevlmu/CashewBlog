import { spawn, execSync } from "node:child_process";

const deviceArg = process.argv.find((arg) => arg.startsWith("--device="));
const device = deviceArg?.split("=")[1] === "mobile" ? "mobile" : "desktop";
const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function killPort4321() {
	try {
		if (process.platform === "win32") {
			execSync(
				'powershell -Command "Get-NetTCPConnection -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"',
				{ stdio: "ignore" },
			);
		}
	} catch {
		// ignore
	}
}

function run(args, env = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			env: { ...process.env, ...env },
			stdio: "inherit",
			shell: process.platform === "win32",
		});
		child.on("error", reject);
		child.on("exit", (code, signal) => {
			if (signal) reject(new Error("Command terminated by " + signal));
			else if (code === 0) resolve();
			else reject(new Error("Command exited with code " + code));
		});
	});
}

async function waitForServer(url, timeoutMs = 20000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(url);
			if (res.ok || res.status === 200 || res.status === 304) {
				return true;
			}
		} catch {
			// not ready yet
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`Server failed to respond at ${url} within ${timeoutMs}ms`);
}

try {
	console.log("Building site for Lighthouse audit...");
	await run(["build"]);
	killPort4321();
	await run(["astro", "preview", "stop"]).catch(() => undefined);
	await run(["astro", "preview", "--host", "127.0.0.1", "--port", "4321"]);
	await waitForServer("http://127.0.0.1:4321/");
	console.log(
		`Preview server is running at http://127.0.0.1:4321/. Running Lighthouse CI (${device})...`,
	);
	await run(["exec", "lhci", "autorun", "--config=lighthouserc.cjs"], {
		LH_DEVICE: device,
	});
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await run(["astro", "preview", "stop"]).catch(() => undefined);
	killPort4321();
}
