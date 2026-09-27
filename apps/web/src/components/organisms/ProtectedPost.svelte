<script lang="ts">
/**
 * ProtectedPost.svelte — 文章加密业务有机体 (Svelte 5 Runes)
 * 职责：管理文章解锁状态、内存会话持久化与解密后 DOM 挂载
 */
import PasswordGate from "@components/organisms/PasswordGate.svelte";
import { initPostDecryption } from "@utils/post-decryption";
import type { ProtectedPayload } from "@/types/protectedContent";

let {
	payload,
	scope,
	hint = "",
}: {
	payload: ProtectedPayload;
	scope: string;
	hint?: string;
} = $props();

let content = $state<string | null>(null);
let containerElement = $state<HTMLElement | null>(null);

function handleUnlocked(decryptedContent: string) {
	content = decryptedContent;
}

// 当解密内容挂载到 DOM 容器后，触发运行时协同器
$effect(() => {
	if (content !== null && containerElement) {
		initPostDecryption(containerElement);
	}
});
</script>

{#if content !== null}
	<!-- 解密后的正文渲染容器：继承站点标准 Markdown 样式与动效 -->
	<div
		bind:this={containerElement}
		class="prose dark:prose-invert prose-base !max-w-none custom-md markdown-content mb-6 onload-animation"
	>
		<!-- biome-ignore lint/security/noDangerouslySetInnerHtml: Decrypted HTML from authenticated Web Crypto AES-GCM -->
		{@html content}
	</div>
{:else}
	<!-- 未解锁状态：呈现通用的 M3E PasswordGate 门控 -->
	<div class="protected-post-gate mb-6 onload-animation">
		<PasswordGate
			{payload}
			{scope}
			{hint}
			onunlocked={handleUnlocked}
		/>
	</div>
{/if}

<style lang="stylus">
.protected-post-gate
	display: flex
	justify-content: center
	width: 100%
	margin: var(--m3e-space-4) 0
</style>
