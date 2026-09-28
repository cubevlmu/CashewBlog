import assert from "node:assert/strict";
import { test } from "node:test";
import { gatewayEntry } from "../scripts/gateway-entry.mjs";

function request(url, headers = {}, method = "GET") {
	let handle;
	gatewayEntry("http://127.0.0.1:8080").configureServer({ middlewares: { use: fn => { handle = fn; } } });
	const result = { passed: false };
	handle({ url, method, headers: { host: "127.0.0.1:4321", ...headers } }, {
		writeHead(status, headers) { Object.assign(result, { status, headers }); },
		end() {},
	}, () => { result.passed = true; });
	return result;
}

test("direct admin paths preserve path and query on the gateway", () => {
	for (const path of ["/admin", "/admin/", "/admin/posts?status=draft", "/setup/"]) {
		assert.equal(request(path).headers.Location, `http://127.0.0.1:8080${path}`);
	}
	assert.equal(request("/administrator").passed, true);
});

test("direct HTML navigation redirects but gateway navigation does not loop", () => {
	assert.equal(request("/posts/test/", { accept: "text/html" }).status, 302);
	assert.equal(request("/", { accept: "text/html", host: "127.0.0.1:8080" }).passed, true);
	assert.equal(request("/", { accept: "text/html", "x-forwarded-host": "localhost:8080" }).passed, true);
});

test("Vite resources, HMR and write requests remain untouched", () => {
	assert.equal(request("/@vite/client").passed, true);
	assert.equal(request("/src/script.ts", { accept: "*/*" }).passed, true);
	assert.equal(request("/", { upgrade: "websocket" }).passed, true);
	assert.equal(request("/admin", {}, "POST").passed, true);
});

test("redirect authority is fixed even for protocol-relative request targets", () => {
	assert.equal(request("//example.com/admin").headers.Location, "http://127.0.0.1:8080/admin");
});
