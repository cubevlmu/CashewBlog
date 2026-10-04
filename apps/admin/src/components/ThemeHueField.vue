<script setup lang="ts">
// Theme colour picker. The site stores only a hue; any colour picked here is reduced to
// its hue, and every swatch shows the colour the public site will actually generate.
import { computed, ref, watch } from "vue";
import ColorPicker from "primevue/colorpicker";
import InputNumber from "primevue/inputnumber";
import Slider from "primevue/slider";
import { hueFromHex, normalizeHue, seedHex, themeSwatches, type ThemeSpec, type ThemeStyle } from "../theme-colors";

const props = defineProps<{ modelValue: number; themeStyle: ThemeStyle; themeSpec: ThemeSpec }>();
const emit = defineEmits<{ "update:modelValue": [hue: number] }>();

const hue = computed(() => normalizeHue(props.modelValue ?? 0));
const seed = computed(() => seedHex(hue.value));
const presets = Array.from({ length: 12 }, (_, index) => index * 30);
const track = `linear-gradient(to right, ${Array.from({ length: 13 }, (_, index) => seedHex(index * 30)).join(", ")})`;
const palettes = computed(() => [
  { label: "浅色", colors: themeSwatches(hue.value, props.themeStyle, props.themeSpec, false) },
  { label: "深色", colors: themeSwatches(hue.value, props.themeStyle, props.themeSpec, true) },
]);
const roles = [
  { key: "primary", label: "主色" },
  { key: "secondary", label: "辅助色" },
  { key: "tertiary", label: "第三色" },
  { key: "primaryContainer", label: "主色容器" },
  { key: "surface", label: "表面" },
] as const;

// While the picker panel is open it keeps the exact colour under the cursor; feeding the
// derived seed back would make the panel jump. It snaps to the seed when it closes.
const picker = ref(seed.value.slice(1));
let picking = false;
watch(seed, (value) => {
  if (!picking) picker.value = value.slice(1);
});

function set(value: number | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) emit("update:modelValue", normalizeHue(value));
}
function pick(hex: unknown) {
  if (typeof hex !== "string" || !/^#?[0-9a-f]{6}$/i.test(hex)) return;
  picking = true;
  picker.value = hex.replace("#", "");
  set(hueFromHex(hex));
}
function closePicker() {
  picking = false;
  picker.value = seed.value.slice(1);
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4">
      <ColorPicker
        :model-value="picker"
        format="hex"
        aria-label="选择主题色"
        :pt="{ preview: { class: '!size-12 !rounded-full !border-2 !border-[var(--p-content-border-color)]' } }"
        @update:model-value="pick"
        @hide="closePicker"
      />
      <div class="min-w-48 flex-1">
        <div class="mb-3 flex items-baseline justify-between gap-2 text-sm">
          <span class="hidden text-[var(--p-text-muted-color)] sm:inline">拖动选择色相，或点击左侧色块取色</span>
          <span class="ml-auto shrink-0 font-mono tabular-nums">{{ seed }}</span>
        </div>
        <Slider
          :model-value="hue"
          :min="0"
          :max="359"
          aria-label="主题色相"
          :pt="{ root: { style: { background: track, height: '0.5rem' } }, range: { class: '!bg-transparent' } }"
          @update:model-value="set(Array.isArray($event) ? $event[0] : $event)"
        />
      </div>
      <InputNumber
        :model-value="hue"
        :min="0"
        :max="359"
        suffix="°"
        show-buttons
        aria-label="色相角度"
        :fluid="false"
        class="shrink-0"
        :input-style="{ width: '5rem' }"
        @update:model-value="set"
      />
    </div>

    <div class="flex flex-wrap gap-2" role="group" aria-label="常用色相">
      <button
        v-for="preset in presets"
        :key="preset"
        type="button"
        class="size-8 cursor-pointer rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p-primary-color)]"
        :class="preset === hue ? 'border-[var(--p-text-color)]' : 'border-transparent'"
        :style="{ background: seedHex(preset) }"
        :aria-label="`色相 ${preset}°`"
        :aria-pressed="preset === hue"
        :title="`${preset}°`"
        @click="set(preset)"
      />
    </div>

    <div class="grid gap-2 sm:grid-cols-2">
      <div
        v-for="palette in palettes"
        :key="palette.label"
        class="rounded-lg border border-[var(--p-content-border-color)] p-3"
      >
        <div class="mb-2 text-xs text-[var(--p-text-muted-color)]">{{ palette.label }}模式配色</div>
        <div class="flex gap-2">
          <div v-for="role in roles" :key="role.key" class="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span
              class="h-8 w-full rounded-md border border-black/10"
              :style="{ background: palette.colors[role.key] }"
              :title="palette.colors[role.key]"
            />
            <span class="truncate text-[0.7rem] text-[var(--p-text-muted-color)]">{{ role.label }}</span>
          </div>
        </div>
      </div>
    </div>
    <small class="text-[var(--p-text-muted-color)]">
      只保存所选颜色的色相；饱和度与明度由 Material 3 规范自动生成，色块即站点上实际使用的颜色。
    </small>
  </div>
</template>
