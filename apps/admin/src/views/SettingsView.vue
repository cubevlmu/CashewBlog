<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { useRoute } from "vue-router";
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
async function load() {
  await attempt(async () => {
    settings.value = await http.get<SiteSettings>("/api/admin/settings");
    changeSection();
  });
}
function changeSection() {
  if (settings.value)
    draft.value = JSON.parse(
      JSON.stringify(settings.value[section.value]),
    ) as unknown as Value;
  saved.value = false;
}
watch(section, changeSection);
async function save() {
  busy.value = true;
  await attempt(async () => {
    settings.value = await http.put<SiteSettings>("/api/admin/settings", {
      [section.value]: draft.value,
    });
    saved.value = true;
  });
  busy.value = false;
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
onMounted(load);
</script>
<template>
  <Panel>
    <Message v-if="saved" severity="success">已保存</Message
    ><Message v-if="section === 'footer'" severity="warn"
      >页脚 HTML 中的脚本会在公开页面执行。请仅使用你信任的代码。</Message
    >
    <div v-if="settings" class="settings-content">
      <Fluid><SettingsFields v-model="draft" :path="section" /></Fluid>
      <div class="mt-6 flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" label="恢复默认" severity="secondary" @click="reset" />
        <Button type="button" label="保存设置" icon="pi pi-check" :loading="busy" @click="save" />
      </div>
    </div>
  </Panel>
</template>
