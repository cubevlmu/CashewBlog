<script setup lang="ts">
import { reactive, watch } from "vue";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputText from "primevue/inputtext";
import type { LinkValue } from "../editor/editor-commands";

const visible = defineModel<boolean>("visible", { required: true });
const props = defineProps<{ value: LinkValue; editing: boolean }>();
const emit = defineEmits<{ submit: [value: LinkValue]; remove: []; close: [] }>();

const form = reactive<LinkValue>({ text: "", href: "", title: "" });
watch(visible, (open) => {
  if (open) Object.assign(form, props.value);
});
function submit() {
  if (!form.href.trim()) return;
  emit("submit", { text: form.text, href: form.href.trim(), title: form.title.trim() });
  visible.value = false;
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="editing ? '编辑链接' : '插入链接'"
    :draggable="false"
    class="w-[min(28rem,calc(100vw-2rem))]"
    @hide="emit('close')"
  >
    <form id="md-link-form" class="flex flex-col gap-3" @submit.prevent="submit">
      <label class="flex flex-col gap-1 text-sm">
        链接地址
        <InputText v-model="form.href" autofocus placeholder="https:// 或 /posts/..." aria-label="链接地址" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        显示文本
        <InputText v-model="form.text" placeholder="留空则使用链接地址" aria-label="显示文本" />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        标题（可选）
        <InputText v-model="form.title" aria-label="链接标题" />
      </label>
    </form>
    <template #footer>
      <Button v-if="editing" label="移除链接" icon="pi pi-trash" text severity="danger" class="mr-auto" @click="emit('remove'); visible = false" />
      <Button label="取消" text severity="secondary" @click="visible = false" />
      <Button type="submit" form="md-link-form" label="确定" icon="pi pi-check" :disabled="!form.href.trim()" />
    </template>
  </Dialog>
</template>
