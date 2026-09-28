<script setup lang="ts">
import type { PageState } from "primevue/paginator";
import { computed, useSlots } from "vue";
import { PAGE_SIZE } from "../pagination";

/**
 * Table surface used by every admin list: toolbar, a DataTable above `md` and a card list
 * below it. With `lazy` the paginator only reports state (server-side paging); otherwise the
 * rows are sliced here.
 */
const props = withDefaults(
  defineProps<{
    value?: any[];
    loading?: boolean;
    emptyText?: string;
    dataKey?: string;
    /** 1-based page number; the page size is fixed to `PAGE_SIZE`. */
    page?: number;
    totalRecords?: number;
    paginator?: boolean;
    tableStyle?: string;
    selection?: any[];
    lazy?: boolean;
  }>(),
  {
    value: () => [],
    loading: false,
    emptyText: "暂无内容",
    dataKey: "id",
    page: 1,
    totalRecords: 0,
    paginator: true,
    tableStyle: undefined,
    selection: undefined,
    lazy: true,
  },
);
const emit = defineEmits<{
  page: [event: PageState];
  "update:selection": [value: any[]];
}>();
const slots = useSlots();
const hasToolbar = computed(() =>
  Boolean(slots.filters || slots.search || slots.actions),
);
const first = computed(() => (props.page - 1) * PAGE_SIZE);
const visible = computed(() =>
  props.lazy
    ? props.value
    : props.value.slice(first.value, first.value + PAGE_SIZE),
);
</script>
<template>
  <section
    class="min-w-0 overflow-hidden rounded-lg border border-[var(--p-content-border-color)] bg-[var(--p-content-background)]"
  >
    <Toolbar
      v-if="hasToolbar"
      class="!rounded-none !border-x-0 !border-t-0"
      :pt="{ start: { class: 'min-w-0 flex-auto' } }"
    >
      <template #start
        ><div class="flex min-w-0 flex-wrap items-center gap-2">
          <slot name="filters" /></div
      ></template>
      <template #end
        ><div class="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <slot name="search" /><slot name="actions" /></div
      ></template>
    </Toolbar>
    <slot name="before" />
    <div class="hidden md:block">
      <DataTable
        :value="visible"
        :loading="props.loading"
        :data-key="props.dataKey"
        :table-style="props.tableStyle"
        :selection="props.selection"
        :lazy="props.lazy"
        @update:selection="emit('update:selection', $event)"
      >
        <slot />
        <template #empty
          ><div
            class="px-4 py-12 text-center text-sm text-[var(--p-text-muted-color)]"
          >
            {{ props.emptyText }}
          </div></template
        >
      </DataTable>
    </div>
    <div class="md:hidden">
      <p
        v-if="!props.value.length"
        class="px-4 py-12 text-center text-sm text-[var(--p-text-muted-color)]"
      >
        {{ props.emptyText }}
      </p>
      <ul v-else class="divide-y divide-[var(--p-content-border-color)]">
        <li
          v-for="(item, index) in visible"
          :key="props.dataKey ? item[props.dataKey] : index"
        >
          <slot name="item" :item="item" :index="index" />
        </li>
      </ul>
    </div>
    <Paginator
      v-if="props.paginator"
      :first="first"
      :rows="PAGE_SIZE"
      :total-records="props.totalRecords"
      :disabled="props.loading"
      template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
      class="!rounded-none !border-x-0 !border-b-0"
      @page="emit('page', $event)"
    />
  </section>
</template>
