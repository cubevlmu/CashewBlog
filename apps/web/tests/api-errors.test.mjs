import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, createBlogApi, getBootstrap } from "../src/lib/api/client.ts";

test("bootstrap preserves setup_required so middleware can route to setup", async (t) => {
	t.mock.method(globalThis, "fetch", async () => Response.json({ error: "setup_required" }, { status: 503 }));
	await assert.rejects(getBootstrap(), error => error instanceof ApiError && error.status === 503 && error.code === "setup_required");
});

test("a generic upstream 503 does not masquerade as first-run setup", async (t) => {
	t.mock.method(globalThis, "fetch", async () => new Response("Unavailable", { status: 503 }));
	await assert.rejects(createBlogApi().getPosts(), error => error instanceof ApiError && error.status === 503 && error.code === undefined);
});
