<script setup lang="ts">
import { computed, defineAsyncComponent, ref } from "vue";
import { VueDraggable } from "vue-draggable-plus";
import {
  choices,
  labels,
  template,
  sidebarPages,
  type Value,
} from "./settings-fields";
const props = defineProps<{ modelValue: Value; path: string }>();
const emit = defineEmits<{ "update:modelValue": [value: Value] }>();
const key = computed(() => props.path.split(".").at(-1)!);
const MediaView = defineAsyncComponent(() => import("../views/MediaView.vue"));
const mediaVisible = ref(false);
const mediaField = computed(
  () =>
    ["profile.avatar", "general.favicon", "seo.ogImage"].includes(props.path) ||
    /^banner\.(desktop|mobile)\.\d+$/.test(props.path),
);
const options = computed(() =>
  key.value === "type"
    ? props.path.startsWith("sidebar")
      ? [
          "profile",
          "announcement",
          "categories",
          "tags",
          "series",
          "recentPosts",
          "stats",
          "toc",
        ]
      : [
          "home",
          "archive",
          "categories",
          "tags",
          "series",
          "rss",
          "page",
          "url",
        ]
    : choices[key.value],
);
const entries = computed(() =>
  props.modelValue &&
  typeof props.modelValue === "object" &&
  !Array.isArray(props.modelValue)
    ? Object.entries(props.modelValue)
    : [],
);
function updateField(name: string, value: Value) {
  emit("update:modelValue", {
    ...(props.modelValue as Record<string, Value>),
    [name]: value,
  });
}
function updateItem(index: number, value: Value) {
  const items = [...(props.modelValue as Value[])];
  items[index] = value;
  emit("update:modelValue", items);
}
function remove(index: number) {
  const items = [...(props.modelValue as Value[])];
  items.splice(index, 1);
  emit("update:modelValue", items);
}
const canAdd = computed(
  () =>
    key.value !== "children" ||
    props.path.split(".").filter((k) => k === "children").length < 2,
);
</script>
<template>
  <MultiSelect
    v-if="key === 'pages'"
    :model-value="modelValue"
    :options="sidebarPages"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <template v-else-if="Array.isArray(modelValue)">
    <VueDraggable
      :model-value="modelValue"
      handle=".drag-handle"
      @update:model-value="emit('update:modelValue', $event)"
    >
      <Fieldset
        v-for="(item, index) in modelValue"
        :key="index"
        :legend="String(index + 1)"
        ><Button
          class="drag-handle"
          icon="pi pi-arrows-v"
          text
          aria-label="拖动排序" /><SettingsFields
          :model-value="item"
          :path="`${path}.${index}`"
          @update:model-value="updateItem(index, $event)" /><Button
          label="移除"
          text
          severity="danger"
          @click="remove(index)"
      /></Fieldset>
    </VueDraggable>
    <Button
      v-if="canAdd"
      label="添加"
      icon="pi pi-plus"
      text
      @click="emit('update:modelValue', [...modelValue, template(path)])"
    />
  </template>
  <template v-else-if="modelValue && typeof modelValue === 'object'">
    <Field
      v-for="[name, value] in entries"
      :key="name"
      :label="labels[name] ?? name"
      ><SettingsFields
        :model-value="value"
        :path="`${path}.${name}`"
        @update:model-value="updateField(name, $event)"
    /></Field>
  </template>
  <Select
    v-else-if="options"
    :model-value="modelValue"
    :options="options"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <ToggleSwitch
    v-else-if="typeof modelValue === 'boolean'"
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <InputNumber
    v-else-if="typeof modelValue === 'number' || key === 'collapseAfter'"
    :model-value="modelValue as number | null"
    :max-fraction-digits="3"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <Textarea
    v-else-if="
      [
        'html',
        'content',
        'description',
        'bio',
        'extraRobots',
        'defaultDescription',
      ].includes(key)
    "
    :model-value="modelValue as string | null"
    auto-resize
    rows="5"
    @update:model-value="emit('update:modelValue', $event ?? '')"
  />
  <InputText
    v-else
    :model-value="modelValue as string | null"
    @update:model-value="emit('update:modelValue', $event ?? '')"
  />
  <Button
    v-if="mediaField"
    label="从媒体库选择"
    text
    @click="mediaVisible = true"
  />
  <Dialog
    v-if="mediaField"
    v-model:visible="mediaVisible"
    header="选择媒体"
    modal
    maximizable
  >
    <MediaView
      v-if="mediaVisible"
      picker
      @select="
        emit('update:modelValue', $event.url);
        mediaVisible = false;
      "
    />
  </Dialog>
</template>
