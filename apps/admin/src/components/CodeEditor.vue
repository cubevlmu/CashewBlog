<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "../workers/editor.worker?worker";
import htmlWorker from "../workers/html.worker?worker";
import cssWorker from "../workers/css.worker?worker";
import { dark } from "../theme";

const props = defineProps<{ modelValue: string; label: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const root = ref<HTMLElement>();
let instance: monaco.editor.IStandaloneCodeEditor | undefined;
globalThis.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === "html"
      ? new htmlWorker()
      : label === "css"
        ? new cssWorker()
        : new editorWorker(),
};
const theme = () => (dark.value ? "vs-dark" : "vs");
onMounted(() => {
  instance = monaco.editor.create(root.value!, {
    value: props.modelValue,
    language: "html",
    theme: theme(),
    ariaLabel: props.label,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: "on",
    lineNumbers: "on",
    tabSize: 2,
    scrollBeyondLastLine: false,
    padding: { top: 12, bottom: 12 },
  });
  instance.onDidChangeModelContent(() =>
    emit("update:modelValue", instance?.getValue() ?? ""),
  );
});
// Monaco themes are global; follow the admin's light/dark switch.
watch(dark, () => monaco.editor.setTheme(theme()));
watch(
  () => props.modelValue,
  (value) => {
    if (instance && value !== instance.getValue()) instance.setValue(value);
  },
);
onBeforeUnmount(() => {
  const model = instance?.getModel();
  instance?.dispose();
  model?.dispose();
});
</script>
<template>
  <div ref="root" class="h-full min-h-0 w-full" />
</template>
