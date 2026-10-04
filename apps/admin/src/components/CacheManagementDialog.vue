<script setup lang="ts">
import { onMounted, ref } from "vue";
import { cacheReport, clearCache, formatBytes, persistCache, type CacheBucket, type CacheReport } from "../browser-cache";

defineProps<{ visible: boolean }>();
const emit = defineEmits<{ "update:visible": [value: boolean] }>();
const report = ref<CacheReport | null>(null);
const busy = ref(false);
const message = ref("");
const labels: Record<CacheBucket, { title: string; detail: string }> = {
  static: { title: "程序资源", detail: "CSS、JavaScript、字体与图标" },
  images: { title: "图片资源", detail: "公开图片与站点图像" },
  pages: { title: "页面校验缓存", detail: "公开 HTML 的本地副本" },
};
async function refresh() {
  report.value = await cacheReport();
}
async function clear(bucket?: CacheBucket) {
  busy.value = true;
  message.value = "";
  try {
    await clearCache(bucket);
    message.value = bucket ? "已清理该缓存。" : "已清理全部浏览器缓存。";
    await refresh();
  } catch { message.value = "缓存清理失败，请稍后重试。"; }
  finally { busy.value = false; }
}
async function makePersistent() {
  const ok = await persistCache();
  message.value = ok ? "浏览器已允许保留缓存。" : "浏览器未授予持久化存储权限。";
  await refresh();
}
onMounted(() => void refresh());
</script>

<template>
  <Dialog :visible="visible" modal header="浏览器缓存管理" class="w-full max-w-xl" @update:visible="emit('update:visible', $event)">
    <div class="space-y-4">
      <Message severity="info">基础 CSS、JavaScript 和字体会优先从本机复用；页面内容仍会在线校验，登录信息不会写入缓存。</Message>
      <Message v-if="message" severity="success">{{ message }}</Message>
      <div v-if="report?.available" class="space-y-2">
        <div v-for="bucket in report.buckets" :key="bucket.bucket" class="flex items-center gap-3 rounded-lg border border-[var(--p-content-border-color)] p-3">
          <div class="min-w-0 flex-1"><div class="font-medium">{{ labels[bucket.bucket].title }}</div><div class="text-xs text-[var(--p-text-muted-color)]">{{ labels[bucket.bucket].detail }}</div></div>
          <div class="shrink-0 text-right text-sm"><div>{{ bucket.entries }} 项</div><div class="text-xs text-[var(--p-text-muted-color)]">{{ formatBytes(bucket.bytes) }}</div></div>
          <Button icon="pi pi-trash" text rounded severity="danger" :disabled="busy || bucket.entries === 0" :aria-label="`清理${labels[bucket.bucket].title}`" @click="clear(bucket.bucket)" />
        </div>
        <div class="text-sm text-[var(--p-text-muted-color)]">浏览器总占用：{{ formatBytes(report.usage) }}<span v-if="report.quota"> / {{ formatBytes(report.quota) }}</span> · {{ report.persisted ? "已持久化" : "可能被浏览器回收" }}</div>
      </div>
      <Message v-else severity="warn">当前浏览器不支持持久缓存，仍会使用普通 HTTP 缓存。</Message>
    </div>
    <template #footer>
      <Button label="请求保留缓存" severity="secondary" outlined :disabled="busy || !report?.available" @click="makePersistent" />
      <Button label="清理全部" severity="danger" outlined :loading="busy" :disabled="!report?.available" @click="clear()" />
      <Button label="关闭" @click="emit('update:visible', false)" />
    </template>
  </Dialog>
</template>
