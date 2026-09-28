<script setup lang="ts">
import { computed, ref } from "vue";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import { parseCode, serializeCode } from "../editor/markdown-blocks";

const props = defineProps<{ source: string }>();
const emit = defineEmits<{
  change: [source: string];
  exit: [];
  remove: [];
  navigate: [direction: "up" | "down"];
}>();

const LANGUAGES = [
  "text", "bash", "powershell", "shell", "c", "cpp", "csharp", "css", "diff", "dockerfile",
  "go", "html", "ini", "java", "javascript", "json", "kotlin", "markdown", "mermaid", "php",
  "python", "ruby", "rust", "scss", "sql", "swift", "toml", "typescript", "vue", "xml", "yaml",
];

const model = computed(() => parseCode(props.source) ?? { fence: "```", language: "", code: "" });
const textarea = ref<{ $el: HTMLTextAreaElement }>();

function update(patch: { language?: string; code?: string }) {
  emit("change", serializeCode({ ...model.value, ...patch }));
}
function onLanguage(value: unknown) {
  update({ language: typeof value === "string" ? value : "" });
}
function onKeydown(event: KeyboardEvent) {
  if (event.isComposing) return;
  const target = event.target as HTMLTextAreaElement;
  const atStart = target.selectionStart === 0 && target.selectionEnd === 0;
  const atEnd = target.selectionStart === target.value.length;
  if (event.key === "Tab" && !event.shiftKey) {
    event.preventDefault();
    target.setRangeText("  ", target.selectionStart, target.selectionEnd, "end");
    update({ code: target.value });
  } else if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) {
    event.preventDefault();
    emit("exit");
  } else if (event.key === "Backspace" && !target.value) {
    event.preventDefault();
    emit("remove");
  } else if (event.key === "ArrowUp" && atStart) {
    event.preventDefault();
    emit("navigate", "up");
  } else if (event.key === "ArrowDown" && atEnd) {
    event.preventDefault();
    emit("navigate", "down");
  }
}
function focus(position: "start" | "end" = "end") {
  const element = textarea.value?.$el;
  if (!element) return;
  element.focus({ preventScroll: true });
  const offset = position === "start" ? 0 : element.value.length;
  element.setSelectionRange(offset, offset);
}
defineExpose({ focus });
</script>

<template>
  <div class="md-code rounded-md border border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)]">
    <div class="flex items-center justify-between gap-2 border-b border-[var(--p-content-border-color)] px-2 py-1">
      <Select
        :model-value="model.language"
        :options="LANGUAGES"
        editable
        filter
        size="small"
        placeholder="语言"
        aria-label="代码语言"
        class="w-40"
        @update:model-value="onLanguage"
      />
      <span class="hidden text-xs text-[var(--p-text-muted-color)] sm:inline">Esc 或 Ctrl+Enter 退出代码块</span>
    </div>
    <Textarea
      ref="textarea"
      :model-value="model.code"
      auto-resize
      rows="2"
      spellcheck="false"
      aria-label="代码内容"
      class="md-code-input w-full !rounded-none !border-0 !bg-transparent !shadow-none"
      @update:model-value="update({ code: $event ?? '' })"
      @keydown="onKeydown"
    />
  </div>
</template>
