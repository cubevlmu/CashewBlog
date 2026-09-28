<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import * as monaco from "monaco-editor";
import editorWorker from "../workers/editor.worker?worker";
import htmlWorker from "../workers/html.worker?worker";
import cssWorker from "../workers/css.worker?worker";

const props = defineProps<{ modelValue: string; language: "html" | "css" }>();
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
onMounted(() => {
  instance = monaco.editor.create(root.value!, {
    value: props.modelValue,
    language: props.language,
    automaticLayout: true,
    minimap: { enabled: false },
    wordWrap: "on",
    lineNumbers: "on",
    tabSize: 2,
  });
  instance.onDidChangeModelContent(() =>
    emit("update:modelValue", instance?.getValue() ?? ""),
  );
});
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
<template><div ref="root" style="height: 360px" /></template>
