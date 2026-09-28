<script setup lang="ts">
// A contenteditable element that owns its DOM. It repaints only when `source` changes
// from outside (undo, commands, autosave), never for its own input, so the caret and IME
// composition are left alone while typing.
import { onMounted, ref, watch } from "vue";
import { caretOffset, setCaret } from "../editor/dom";

const props = withDefaults(
  defineProps<{
    source: string;
    render: (source: string) => string;
    read: (element: HTMLElement) => string;
    tag?: string;
    placeholder?: string;
    label: string;
  }>(),
  { tag: "div", placeholder: "" },
);
const emit = defineEmits<{ change: [source: string] }>();

const element = ref<HTMLElement>();
let painted = props.source;
let composing = false;

function paint() {
  if (!element.value) return;
  element.value.innerHTML = props.render(props.source);
  painted = props.source;
}
/** Reads the DOM and emits the new source; returns it. */
function sync(): string {
  if (!element.value || composing) return painted;
  const next = props.read(element.value);
  if (next !== painted) {
    painted = next;
    emit("change", next);
  }
  return next;
}
function onCompositionStart() {
  composing = true;
}
function onCompositionEnd() {
  composing = false;
  sync();
}

watch(
  () => props.source,
  (source) => {
    if (source === painted || !element.value) return;
    const focused = element.value.contains(document.activeElement);
    const offset = focused ? caretOffset(element.value) : -1;
    paint();
    if (focused && offset >= 0) setCaret(element.value, offset);
  },
);
onMounted(paint);
defineExpose({ element, sync, isComposing: () => composing });
</script>

<template>
  <component
    :is="tag"
    ref="element"
    contenteditable="true"
    spellcheck="true"
    role="textbox"
    aria-multiline="true"
    :aria-label="label"
    :data-placeholder="placeholder || undefined"
    class="md-surface"
    @input="sync"
    @compositionstart="onCompositionStart"
    @compositionend="onCompositionEnd"
  />
</template>
