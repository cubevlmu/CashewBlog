<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import Button from "primevue/button";
import ButtonGroup from "primevue/buttongroup";
import EditableSurface from "./EditableSurface.vue";
import { inlineHtml } from "../editor/inline-markdown";
import { caretAtEnd, caretAtStart, readInline, setCaret } from "../editor/dom";
import {
  alignTableColumn,
  emptyTable,
  insertTableColumn,
  insertTableRow,
  parseTable,
  removeTableColumn,
  removeTableRow,
  serializeTable,
  type Align,
  type TableModel,
} from "../editor/markdown-blocks";

const props = defineProps<{ source: string }>();
const emit = defineEmits<{
  change: [source: string];
  remove: [];
  exit: [];
  navigate: [direction: "up" | "down"];
}>();

const root = ref<HTMLElement>();
const table = computed(() => parseTable(props.source) ?? emptyTable());
// Row -1 is the header row.
const active = ref({ row: -1, column: 0 });
const readCell = (element: HTMLElement) => readInline(element, false);

function commit(next: TableModel, focusCell?: { row: number; column: number }) {
  emit("change", serializeTable(next));
  if (focusCell) {
    active.value = focusCell;
    void nextTick(() => focus(focusCell.row, focusCell.column));
  }
}
function setCell(row: number, column: number, value: string) {
  const next: TableModel = {
    ...table.value,
    header: table.value.header.slice(),
    rows: table.value.rows.map((cells) => cells.slice()),
  };
  if (row < 0) next.header[column] = value;
  else next.rows[row][column] = value;
  commit(next);
}
function cell(row: number, column: number) {
  return root.value?.querySelector<HTMLElement>(`[data-cell="${row}:${column}"]`) ?? null;
}
function focus(row: number, column: number, position: number | "end" = "end") {
  const element = cell(row, column);
  if (element) setCaret(element, position);
}
function onKeydown(event: KeyboardEvent, row: number, column: number) {
  if (event.isComposing) return;
  const element = event.currentTarget as HTMLElement;
  const columns = table.value.header.length;
  const lastRow = table.value.rows.length - 1;
  if (event.key === "Tab") {
    event.preventDefault();
    const step = event.shiftKey ? -1 : 1;
    let nextColumn = column + step;
    let nextRow = row;
    if (nextColumn >= columns) (nextColumn = 0), nextRow++;
    if (nextColumn < 0) (nextColumn = columns - 1), nextRow--;
    if (nextRow < -1) return;
    if (nextRow > lastRow) commit(insertTableRow(table.value, nextRow), { row: nextRow, column: 0 });
    else focus(nextRow, nextColumn);
  } else if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) emit("exit");
    else if (row >= lastRow) commit(insertTableRow(table.value, lastRow + 1), { row: lastRow + 1, column });
    else focus(row + 1, column);
  } else if (event.key === "ArrowUp" && caretAtStart(element)) {
    event.preventDefault();
    if (row === -1) emit("navigate", "up");
    else focus(row - 1, column);
  } else if (event.key === "ArrowDown" && caretAtEnd(element)) {
    event.preventDefault();
    if (row >= lastRow) emit("navigate", "down");
    else focus(row + 1, column);
  }
}
function addRow(offset: 0 | 1) {
  const at = Math.max(0, active.value.row + offset);
  commit(insertTableRow(table.value, at), { row: at, column: active.value.column });
}
function deleteRow() {
  if (active.value.row < 0) return;
  const row = Math.min(active.value.row, table.value.rows.length - 2);
  commit(removeTableRow(table.value, active.value.row), { row, column: active.value.column });
}
function addColumn(offset: 0 | 1) {
  const at = active.value.column + offset;
  commit(insertTableColumn(table.value, at), { row: active.value.row, column: at });
}
function deleteColumn() {
  if (table.value.header.length <= 1) return;
  const column = Math.max(0, active.value.column - 1);
  commit(removeTableColumn(table.value, active.value.column), { row: active.value.row, column });
}
function align(value: Align) {
  commit(alignTableColumn(table.value, active.value.column, value));
}
function focusFirst(position: "start" | "end" = "end") {
  focus(position === "start" ? -1 : table.value.rows.length - 1, 0);
}
defineExpose({ focus: focusFirst });
</script>

<template>
  <div ref="root" class="md-table-block">
    <div class="md-table-actions mb-1 flex flex-wrap items-center gap-1" role="toolbar" aria-label="表格操作">
      <ButtonGroup>
        <Button icon="pi pi-arrow-up" text size="small" severity="secondary" aria-label="在上方插入行" title="在上方插入行" :disabled="active.row < 0" @mousedown.prevent @click="addRow(0)" />
        <Button icon="pi pi-arrow-down" text size="small" severity="secondary" aria-label="在下方插入行" title="在下方插入行" @mousedown.prevent @click="addRow(1)" />
        <Button icon="pi pi-minus" text size="small" severity="secondary" aria-label="删除行" title="删除行" :disabled="active.row < 0" @mousedown.prevent @click="deleteRow" />
      </ButtonGroup>
      <ButtonGroup>
        <Button icon="pi pi-arrow-left" text size="small" severity="secondary" aria-label="在左侧插入列" title="在左侧插入列" @mousedown.prevent @click="addColumn(0)" />
        <Button icon="pi pi-arrow-right" text size="small" severity="secondary" aria-label="在右侧插入列" title="在右侧插入列" @mousedown.prevent @click="addColumn(1)" />
        <Button icon="pi pi-times" text size="small" severity="secondary" aria-label="删除列" title="删除列" :disabled="table.header.length <= 1" @mousedown.prevent @click="deleteColumn" />
      </ButtonGroup>
      <ButtonGroup>
        <Button icon="pi pi-align-left" text size="small" :severity="table.align[active.column] === 'left' ? 'primary' : 'secondary'" aria-label="左对齐" title="左对齐" @mousedown.prevent @click="align(table.align[active.column] === 'left' ? null : 'left')" />
        <Button icon="pi pi-align-center" text size="small" :severity="table.align[active.column] === 'center' ? 'primary' : 'secondary'" aria-label="居中" title="居中" @mousedown.prevent @click="align(table.align[active.column] === 'center' ? null : 'center')" />
        <Button icon="pi pi-align-right" text size="small" :severity="table.align[active.column] === 'right' ? 'primary' : 'secondary'" aria-label="右对齐" title="右对齐" @mousedown.prevent @click="align(table.align[active.column] === 'right' ? null : 'right')" />
      </ButtonGroup>
      <Button icon="pi pi-trash" text size="small" severity="danger" aria-label="删除表格" title="删除表格" @mousedown.prevent @click="emit('remove')" />
    </div>
    <div class="overflow-x-auto">
      <table class="md-table">
        <thead>
          <tr>
            <th v-for="(value, column) in table.header" :key="column" :style="{ textAlign: table.align[column] ?? undefined }">
              <EditableSurface
                :source="value"
                :render="inlineHtml"
                :read="readCell"
                :data-cell="`-1:${column}`"
                :label="`表头第 ${column + 1} 列`"
                @change="setCell(-1, column, $event)"
                @focus="active = { row: -1, column }"
                @keydown="onKeydown($event, -1, column)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(cells, row) in table.rows" :key="row">
            <td v-for="(value, column) in cells" :key="column" :style="{ textAlign: table.align[column] ?? undefined }">
              <EditableSurface
                :source="value"
                :render="inlineHtml"
                :read="readCell"
                :data-cell="`${row}:${column}`"
                :label="`第 ${row + 1} 行第 ${column + 1} 列`"
                @change="setCell(row, column, $event)"
                @focus="active = { row, column }"
                @keydown="onKeydown($event, row, column)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
