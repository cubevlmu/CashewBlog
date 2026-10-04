import { readonly, ref } from "vue";

// Login-page quote from the public hitokoto API. The request is a CORS "simple" GET (no custom
// headers, no credentials, no referrer) so it needs no preflight and leaks nothing about the
// admin; any failure or a slow response keeps the built-in quote.
const fallback = { text: "种一棵树最好的时间是十年前，其次是现在。", source: "谚语" };
const TIMEOUT_MS = 4000;

const quote = ref(fallback.text),
  source = ref(fallback.source);
let loaded = false;

async function load() {
  if (loaded) return;
  loaded = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch("https://v1.hitokoto.cn/?encode=json", {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) return;
    const value = (await response.json()) as { hitokoto?: string; from?: string; from_who?: string | null };
    const text = value.hitokoto?.trim();
    if (!text) return;
    quote.value = text;
    source.value = [value.from ? `《${value.from}》` : "", value.from_who ?? ""].filter(Boolean).join(" · ") || "一言";
  } catch {
    // Offline, blocked or timed out: keep the fallback quote.
  } finally {
    clearTimeout(timer);
  }
}

export function useAuthQuote() {
  void load();
  return { quote: readonly(quote), source: readonly(source) };
}
