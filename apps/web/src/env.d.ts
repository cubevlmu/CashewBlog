/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
/// <reference path="../node_modules/astro-expressive-code/virtual.d.ts" />

declare namespace App {
	interface Locals {
		api: import("./lib/api/client").BlogApi;
		site: import("./lib/site/context").SiteContext;
	}
}
