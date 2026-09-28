import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
const admin = join(root, "apps/admin");
const web = join(root, "apps/web");
const adminRequire = createRequire(join(admin, "package.json"));
const webRequire = createRequire(join(web, "package.json"));
const vite = join(
  dirname(adminRequire.resolve("vite/package.json")),
  "bin/vite.js",
);
const astroPackage = webRequire("astro/package.json");
const astro = join(
  dirname(webRequire.resolve("astro/package.json")),
  typeof astroPackage.bin === "string"
    ? astroPackage.bin
    : astroPackage.bin.astro,
);
const port = Number(process.env.CASHEWBLOG_PORT ?? 8080);
const webPort = Number(process.env.CASHEWBLOG_WEB_PORT ?? 4321);
if (
  ![port, webPort].every((p) => Number.isInteger(p) && p > 0 && p < 65536) ||
  port === webPort
)
  throw new Error(
    "Use two distinct valid CASHEWBLOG_PORT / CASHEWBLOG_WEB_PORT values.",
  );
const origin = `http://127.0.0.1:${port}`;
const apiArtifacts = join(root, ".local-dev", `api-${port}`);
const children = new Set();
let stopping = false;

async function available(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", () =>
      reject(
        new Error(
          `Port ${port} is occupied. Stop the old dev:api/dev:web terminal or choose another CASHEWBLOG_PORT / CASHEWBLOG_WEB_PORT.`,
        ),
      ),
    );
    server.listen(port, "127.0.0.1", () => server.close(resolve));
  });
}
function launch(command, args, cwd = root, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
    windowsHide: true,
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
function run(command, args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = launch(command, args, cwd);
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  console.log("\n[CashewBlog] Stopping development processes…");
  await Promise.all(
    [...children].map(
      (child) =>
        new Promise((resolve) => {
          if (!child.pid) return resolve();
          if (process.platform === "win32") {
            const killer = spawn(
              "taskkill.exe",
              ["/PID", String(child.pid), "/T", "/F"],
              { windowsHide: true, stdio: "ignore" },
            );
            killer.once("error", resolve);
            killer.once("exit", resolve);
          } else {
            child.once("exit", resolve);
            child.kill("SIGTERM");
            setTimeout(() => {
              child.kill("SIGKILL");
              resolve();
            }, 4000).unref();
          }
        }),
    ),
  );
  process.exit(code);
}
function supervise(child) {
  child.once("error", (error) => {
    console.error(error.message);
    void stop(1);
  });
  child.once("exit", (code) => {
    if (!stopping) {
      console.error(
        "[CashewBlog] A service stopped; shutting down the others.",
      );
      void stop(code || 1);
    }
  });
}
process.once("SIGINT", () => void stop());
process.once("SIGTERM", () => void stop());

try {
  await Promise.all([available(port), available(webPort)]);
  console.log("[CashewBlog] Building the admin UI…");
  await run(process.execPath, [vite, "build", "--logLevel", "warn"], admin);
  await run(process.execPath, [join(root, "tools/stage-admin.mjs")]);
  console.log("[CashewBlog] Building the API…");
  await run("dotnet", [
    "build",
    "src/CashewBlog.Api",
    "--artifacts-path",
    apiArtifacts,
    "-p:UseAppHost=false",
    "--nologo",
    "--verbosity",
    "quiet",
  ]);
  await run(process.execPath, ["scripts/icons/generate-local-icons.mjs"], web);
  // This supervisor owns the process lifetime; Astro must stay in the foreground
  // and must not replace a separate CLI session on another port.
  supervise(
    launch(
      process.execPath,
      [
        astro,
        "dev",
        "--ignore-lock",
        "--host",
        "127.0.0.1",
        "--port",
        String(webPort),
      ],
      web,
      {
        CASHEWBLOG_API_URL: origin,
        CASHEWBLOG_WEB_CACHE_DIR: join(root, ".local-dev", `web-${webPort}`),
      },
    ),
  );
  supervise(
    launch(
      "dotnet",
      [
        join(apiArtifacts, "bin/CashewBlog.Api/debug/CashewBlog.Api.dll"),
        "--urls",
        origin,
      ],
      join(root, "src/CashewBlog.Api"),
      { CASHEWBLOG_WEB_UPSTREAM: `http://127.0.0.1:${webPort}` },
    ),
  );
  supervise(
    launch(
      process.execPath,
      [vite, "build", "--watch", "--logLevel", "warn"],
      admin,
      { CASHEWBLOG_STAGE_ADMIN: "1" },
    ),
  );
  console.log(
    `\n[CashewBlog] One entry point: ${origin}\n  Setup: ${origin}/setup\n  Admin: ${origin}/admin\n  Admin edits rebuild automatically; refresh the browser after rebuilding.\n  Ctrl+C stops all three development processes.\n`,
  );
} catch (error) {
  console.error(`[CashewBlog] ${error.message}`);
  await stop(1);
}
