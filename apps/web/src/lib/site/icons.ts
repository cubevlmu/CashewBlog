import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { IconifyJSON } from "@iconify/types";
import { getIcons } from "@iconify/utils";

/**
 * Offline icon data for administrator-chosen icons rendered by Svelte islands
 * (`@iconify/svelte` cannot fetch at runtime and the generated collection only
 * covers icons that appear in source). Resolved on the SSR server from the
 * installed `@iconify-json/*` sets and passed to the island as a prop.
 */

const SUPPORTED_PREFIXES = new Set([
	"fa6-brands",
	"fa6-regular",
	"fa6-solid",
	"material-symbols",
	"simple-icons",
]);

const require = createRequire(import.meta.url);
const sets = new Map<string, Promise<IconifyJSON>>();

function loadSet(prefix: string): Promise<IconifyJSON> {
	let set = sets.get(prefix);
	if (!set) {
		const file = require.resolve(`@iconify-json/${prefix}/icons.json`);
		set = readFile(file, "utf8").then((text) => JSON.parse(text) as IconifyJSON);
		sets.set(prefix, set);
	}
	return set;
}

export async function resolveIconCollections(
	names: Iterable<string | undefined | null>,
): Promise<IconifyJSON[]> {
	const byPrefix = new Map<string, Set<string>>();
	for (const name of names) {
		const [prefix, icon] = name?.split(":") ?? [];
		if (!prefix || !icon || !SUPPORTED_PREFIXES.has(prefix)) continue;
		if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
		byPrefix.get(prefix)?.add(icon);
	}
	const collections: IconifyJSON[] = [];
	for (const [prefix, icons] of byPrefix) {
		const subset = getIcons(await loadSet(prefix), [...icons]);
		if (subset) collections.push(subset);
	}
	return collections;
}
