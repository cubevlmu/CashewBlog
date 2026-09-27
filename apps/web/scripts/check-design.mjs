import { execFileSync } from "node:child_process";

const args = [
	"--yes",
	"-p",
	"@google/design.md",
	"designmd",
	"lint",
	"DESIGN.md",
];

if (process.platform === "win32") {
	execFileSync(
		process.env.ComSpec || "cmd.exe",
		["/d", "/s", "/c", `npx.cmd ${args.join(" ")}`],
		{
			stdio: "inherit",
		},
	);
} else {
	execFileSync("npx", args, { stdio: "inherit" });
}
