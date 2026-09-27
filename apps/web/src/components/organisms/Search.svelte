<script lang="ts">
import IconButton from "@components/atoms/action/IconButton.svelte";
import SearchPanel from "@components/atoms/blog/SearchPanel.svelte";
import SearchBar from "@components/molecules/SearchBar.svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getPostUrlBySlug } from "@utils/url-utils.ts";
import type { SearchResponseDto } from "@/lib/api/types";

/** Full-text search against `/api/search`; highlights arrive server-escaped. */

interface PanelResult {
	url: string;
	title: string;
	titleHtml: string;
	excerpt: string;
}

const DEBOUNCE_MS = 200;

let keywordDesktop = "";
let keywordMobile = "";
let result: PanelResult[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;

const togglePanel = () => {
	const panel = document.getElementById("search-panel");
	panel?.classList.toggle("float-panel-closed");
};

const setPanelVisibility = (show: boolean, isDesktop: boolean): void => {
	const panel = document.getElementById("search-panel");
	if (!panel || !isDesktop) return;
	panel.classList.toggle("float-panel-closed", !show);
};

const stripTags = (html: string) => html.replace(/<[^>]*>/g, "");

async function runSearch(keyword: string, isDesktop: boolean): Promise<void> {
	controller?.abort();
	controller = new AbortController();
	try {
		const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}`, {
			signal: controller.signal,
			headers: { accept: "application/json" },
		});
		if (!response.ok) throw new Error(`search responded ${response.status}`);
		const data = (await response.json()) as SearchResponseDto;
		result = data.items.map((hit) => ({
			url: getPostUrlBySlug(hit.slug),
			title: stripTags(hit.titleHtml),
			titleHtml: hit.titleHtml,
			excerpt: hit.snippetHtml,
		}));
		setPanelVisibility(result.length > 0, isDesktop);
	} catch (error) {
		if ((error as Error).name === "AbortError") return;
		console.error("Search error:", error);
		result = [];
		setPanelVisibility(false, isDesktop);
	}
}

function search(keyword: string, isDesktop: boolean): void {
	clearTimeout(timer);
	const trimmed = keyword.trim();
	if (!trimmed) {
		controller?.abort();
		result = [];
		setPanelVisibility(false, isDesktop);
		return;
	}
	timer = setTimeout(() => void runSearch(trimmed, isDesktop), DEBOUNCE_MS);
}

$: search(keywordDesktop, true);
$: search(keywordMobile, false);
</script>

<!-- 桌面搜索：SearchBar 分子（40px 图标按钮，hover/点击展开成胶囊搜索条） -->
<SearchBar
    bind:value={keywordDesktop}
    id="search-input-desktop"
    name="search-desktop"
    placeholder={i18n(I18nKey.search)}
    onfocus={() => search(keywordDesktop, true)}
    oncollapse={() => setPanelVisibility(false, true)}
/>

<!-- toggle btn for phone/tablet view -->
<IconButton
    icon="material-symbols:search"
    label="Search Panel"
    id="search-switch"
    size="small"
    shape="round"
    onclick={togglePanel}
    class="lg:!hidden !w-10 !h-10 !text-[1.25rem]"
/>

<!-- search panel（blog/SearchPanel 原子；开合由调用方 classList 控制） -->
<SearchPanel
    id="search-panel"
    class="float-panel float-panel-closed absolute md:w-[30rem] top-20 left-4 md:left-[unset] right-4"
    bind:query={keywordMobile}
    results={result}
    placeholder={i18n(I18nKey.search)}
    hideInputOnDesktop
/>
