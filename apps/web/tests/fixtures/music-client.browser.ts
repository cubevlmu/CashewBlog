import type { ComponentProps } from "svelte";
import { mount } from "svelte";
import MusicSidebarClient from "../../src/components/organisms/music/MusicSidebarClient.svelte";

type MusicSidebarClientProps = ComponentProps<typeof MusicSidebarClient>;

export function mountMusicClientFixture(
	target: HTMLElement,
	props: MusicSidebarClientProps,
): ReturnType<typeof mount> {
	return mount(MusicSidebarClient, { target, props });
}
