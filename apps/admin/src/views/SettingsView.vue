<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute } from "vue-router";
import { useConfirm } from "primevue/useconfirm";
import SettingsFields from "../components/SettingsFields.vue";
import { type Value } from "../components/settings-fields";
import { settingsSection } from "../settings-sections";
import type { SiteSettings } from "../api/types";
import { http } from "../api/http";
import { attempt } from "../state";
const route = useRoute(),
  confirm = useConfirm(),
  settings = ref<SiteSettings>(),
  section = computed(() => settingsSection(route.params.section)),
  busy = ref(false),
  saved = ref(false);
const draft = shallowRef<Value>({});
const baseline = ref("");
const dirty = computed(() => !!settings.value && JSON.stringify(draft.value) !== baseline.value);

async function load() {
  await attempt(async () => {
    settings.value = await http.get<SiteSettings>("/api/admin/settings");
    changeSection();
  });
}
function changeSection() {
  if (!settings.value) return;
  const value = JSON.stringify(settings.value[section.value]);
  draft.value = JSON.parse(value) as Value;
  baseline.value = value;
  saved.value = false;
}
watch(section, changeSection);
async function save() {
  busy.value = true;
  await attempt(async () => {
    settings.value = await http.put<SiteSettings>("/api/admin/settings", {
      [section.value]: draft.value,
    });
    changeSection();
    saved.value = true;
  });
  busy.value = false;
}
function discard() {
  changeSection();
}
function reset() {
  confirm.require({
    header: "恢复默认",
    message: "仅重置当前设置区，确定继续？",
    acceptLabel: "重置",
    rejectLabel: "取消",
    accept: () =>
      attempt(async () => {
        settings.value = await http.post<SiteSettings>(
          `/api/admin/settings/reset/${section.value}`,
        );
        changeSection();
      }),
  });
}
function confirmLeave() {
  if (!dirty.value) return true;
  return new Promise<boolean>((resolve) =>
    confirm.require({
      header: "放弃未保存的更改",
      message: "当前设置区有未保存的更改，离开后将丢失，确定离开？",
      acceptLabel: "离开",
      rejectLabel: "继续编辑",
      accept: () => resolve(true),
      reject: () => resolve(false),
      onHide: () => resolve(false),
    }),
  );
}
// Switching sections only changes the `:section` param (a route update, not a leave).
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = "";
}
onMounted(() => {
  void load();
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => window.removeEventListener("beforeunload", beforeUnload));
</script>
<template>
  <div class="flex flex-col gap-5">
    <Message v-if="section === 'footer'" severity="warn">
      页脚 HTML 中的脚本会在公开页面执行，请仅使用你信任的代码。
    </Message>
    <Fluid v-if="settings"><SettingsFields v-model="draft" :path="section" /></Fluid>
    <div
      v-if="settings"
      class="sticky bottom-4 z-10 flex items-center justify-between gap-2 rounded-xl border border-[var(--p-content-border-color)] bg-[var(--p-content-background)] px-3 py-2 shadow-lg sm:gap-3 sm:px-4 sm:py-3"
      role="region"
      aria-label="保存设置"
    >
      <span class="flex min-w-0 items-center gap-2 truncate text-sm" role="status">
        <i
          class="pi text-sm"
          :class="dirty ? 'pi-circle-fill text-[var(--p-orange-500)]' : 'pi-check-circle text-[var(--p-green-500)]'"
          aria-hidden="true"
        />
        {{ dirty ? "有未保存的更改" : saved ? "设置已保存" : "所有更改已保存" }}
      </span>
      <!-- On phones the secondary actions collapse to icons so the bar stays one row. -->
      <div class="flex shrink-0 gap-1 sm:gap-2">
        <Button type="button" label="恢复默认" icon="pi pi-replay" severity="secondary" text aria-label="恢复默认" title="恢复默认" class="max-sm:[&_.p-button-label]:hidden" @click="reset" />
        <Button type="button" label="撤销更改" icon="pi pi-undo" severity="secondary" outlined aria-label="撤销更改" title="撤销更改" :disabled="!dirty" class="max-sm:[&_.p-button-label]:hidden" @click="discard" />
        <Button type="button" label="保存设置" icon="pi pi-check" :disabled="!dirty" :loading="busy" @click="save" />
      </div>
    </div>
  </div>
</template>
