<script setup lang="ts">
// Cloudflare Turnstile challenge rendered explicitly. The script loads once per page; every render
// emits a fresh single-use token (or null when it expires or errors). Parents call reset() after
// each submission because a token cannot be verified twice.
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { dark } from "../theme";

interface TurnstileApi {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loader: Promise<TurnstileApi> | null = null;
function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loader ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile unavailable")));
    script.onerror = () => {
      loader = null;
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(script);
  });
  return loader;
}

const props = defineProps<{ siteKey: string }>();
const emit = defineEmits<{ token: [value: string | null] }>();
const host = ref<HTMLElement | null>(null);
const failed = ref(false);
let api: TurnstileApi | null = null;
let widgetId: string | null = null;

function remove() {
  if (api && widgetId) api.remove(widgetId);
  widgetId = null;
}
async function render() {
  remove();
  emit("token", null);
  failed.value = false;
  try {
    api = await loadTurnstile();
  } catch {
    failed.value = true;
    return;
  }
  if (!host.value) return;
  widgetId = api.render(host.value, {
    sitekey: props.siteKey,
    theme: dark.value ? "dark" : "light",
    size: "flexible",
    language: "zh-cn",
    callback: (token: string) => emit("token", token),
    "expired-callback": () => emit("token", null),
    "timeout-callback": () => emit("token", null),
    "error-callback": () => {
      emit("token", null);
      // Returning true tells Turnstile the error was handled; it retries on its own.
      return true;
    },
  });
}
function reset() {
  emit("token", null);
  if (api && widgetId) api.reset(widgetId);
}
defineExpose({ reset });

onMounted(render);
watch(() => [props.siteKey, dark.value], render);
onBeforeUnmount(remove);
</script>
<template>
  <div class="min-h-[65px] w-full">
    <div ref="host" class="w-full" />
    <p v-if="failed" class="m-0 text-sm text-[var(--p-red-500)]" role="alert">
      人机验证加载失败，请检查网络后刷新页面。
    </p>
  </div>
</template>
