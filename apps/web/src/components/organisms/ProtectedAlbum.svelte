<script lang="ts">
import AlbumGallery from "@components/organisms/AlbumGallery.svelte";
import PasswordGate from "@components/organisms/PasswordGate.svelte";
import { parseProtectedPayload } from "@utils/password-protection";
import type { AlbumLayout, AlbumPhoto } from "@/types/album";
import type { ProtectedPayload } from "@/types/protectedContent";

let {
	payload,
	scope,
	hint = "",
	layout = "masonry" as AlbumLayout,
	columns = 3,
}: {
	payload: ProtectedPayload;
	scope: string;
	hint?: string;
	layout?: AlbumLayout;
	columns?: 2 | 3 | 4;
} = $props();

let photos = $state<AlbumPhoto[] | null>(null);
let parseError = $state(false);

function unlock(content: string) {
	try {
		const parsed: unknown = JSON.parse(content);
		if (!Array.isArray(parsed)) throw new Error("Invalid protected album data");
		photos = parsed as AlbumPhoto[];
		parseError = false;
	} catch {
		photos = null;
		parseError = true;
	}
}
</script>

{#if photos}
	<AlbumGallery {photos} {layout} {columns} />
{:else if parseError}
	<PasswordGate {payload} {scope} {hint} onunlocked={unlock} />
{:else}
	<PasswordGate {payload} {scope} {hint} onunlocked={unlock} />
{/if}
