<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { Crepe } from "@milkdown/crepe";
import { replaceAll, insert } from "@milkdown/kit/utils";
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/classic.css";
import { upload, errorMessage } from "../state";
const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{
  "update:modelValue": [value: string];
  error: [message: string];
}>();
const root = ref<HTMLElement>();
let editor: Crepe | undefined,
  disposed = false,
  created = false,
  current = props.modelValue;
onMounted(async () => {
  try {
    editor = new Crepe({
      root: root.value!,
      defaultValue: props.modelValue,
      featureConfigs: {
        "image-block": { onUpload: async (file) => (await upload(file)).url },
      },
    });
    editor.on((listener) =>
      listener.markdownUpdated((_ctx, markdown) => {
        current = markdown;
        emit("update:modelValue", markdown);
      }),
    );
    await editor.create();
    created = true;
    if (disposed) await editor.destroy();
  } catch (error) {
    emit("error", errorMessage(error));
  }
});
watch(
  () => props.modelValue,
  (value) => {
    if (editor && created && value !== current) {
      current = value;
      editor.editor.action(replaceAll(value));
    }
  },
);
onBeforeUnmount(() => {
  disposed = true;
  if (created) void editor?.destroy();
});
defineExpose({
  insert: (markdown: string) => editor?.editor.action(insert(markdown)),
});
</script>
<template><div ref="root" aria-label="文章正文编辑器" /></template>
