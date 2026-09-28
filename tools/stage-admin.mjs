import { cp, mkdir } from "node:fs/promises";
const source = new URL("../apps/admin/dist/", import.meta.url);
const target = new URL("../src/CashewBlog.Api/wwwroot/admin/", import.meta.url);
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
console.log("Admin build copied into ASP.NET wwwroot/admin.");
