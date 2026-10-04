<script setup lang="ts">
// A titled group of settings. Section-level groups are PrimeVue Panels; nested groups
// (inside a panel or an item dialog) are lighter sub-sections. An optional switch in the
// header enables the whole group, e.g. 横幅遮罩 or Umami.
import { useId } from "vue";
import Panel from "primevue/panel";
import ToggleSwitch from "primevue/toggleswitch";

// `toggle` must default to undefined: an absent boolean prop would otherwise become false
// and render a switch on every group.
withDefaults(defineProps<{ title: string; hint?: string; root: boolean; toggle?: boolean }>(), {
  hint: undefined,
  toggle: undefined,
});
const emit = defineEmits<{ toggle: [value: boolean] }>();
const id = useId();
</script>

<template>
  <Panel v-if="root" class="min-w-0">
    <template #header>
      <div class="flex min-w-0 flex-1 items-start justify-between gap-4">
        <div class="min-w-0">
          <label :for="toggle === undefined ? undefined : id" class="text-base font-semibold">{{ title }}</label>
          <p v-if="hint" class="m-0 mt-1 text-sm text-[var(--p-text-muted-color)]">{{ hint }}</p>
        </div>
        <ToggleSwitch
          v-if="toggle !== undefined"
          :model-value="toggle"
          :input-id="id"
          class="mt-0.5 shrink-0"
          @update:model-value="emit('toggle', $event)"
        />
      </div>
    </template>
    <slot />
  </Panel>
  <section v-else class="min-w-0" :class="{ 'border-t border-[var(--p-content-border-color)] pt-5': title }">
    <div v-if="title" class="mb-4 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <label :for="toggle === undefined ? undefined : id" class="text-sm font-semibold">{{ title }}</label>
        <p v-if="hint" class="m-0 mt-0.5 text-xs text-[var(--p-text-muted-color)]">{{ hint }}</p>
      </div>
      <ToggleSwitch
        v-if="toggle !== undefined"
        :model-value="toggle"
        :input-id="id"
        class="shrink-0"
        @update:model-value="emit('toggle', $event)"
      />
    </div>
    <slot />
  </section>
</template>
