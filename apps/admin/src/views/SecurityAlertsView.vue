<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import SettingsGroup from "../components/SettingsGroup.vue";
import ResponsiveDataTable from "../components/ResponsiveDataTable.vue";
import type { PageState } from "primevue/paginator";
import { http } from "../api/http";
import type { SecurityAlertDto, SecurityAlertPageDto } from "../api/types";
import { errorMessage } from "../state";

const alerts = ref<SecurityAlertDto[]>([]);
const selected = ref<SecurityAlertDto | null>(null);
const detailVisible = ref(false);
const loading = ref(true);
const operating = ref<number | "all" | null>(null);
const error = ref("");
const includeAcknowledged = ref(false);
const severity = ref("");
const category = ref("");
const offset = ref(0);
const limit = 20;
const total = ref(0);
const activeCount = ref(0);
const categories = [
  { label: "全部类型", value: "" },
  { label: "账户安全 · 登录爆破", value: "LoginBruteForce" },
  { label: "流量控制 · 请求限流", value: "RateLimitExceeded" },
  { label: "路由探测 · 无效接口", value: "RouteProbe" },
  { label: "流量攻击 · 超大请求", value: "OversizedRequest" },
  { label: "协议异常 · 请求格式", value: "InvalidContentType" },
  { label: "历史 · 被拒请求", value: "RejectedRequest" },
];
const severities = [
  { label: "全部级别", value: "" },
  { label: "严重", value: "Critical" },
  { label: "警告", value: "Warning" },
];
const categoryLabels = Object.fromEntries(categories.map((item) => [item.value, item.label]));
function categoryLabel(value: string) { return categoryLabels[value] ?? value; }
function severityLabel(value: string) { return value === "Critical" ? "严重" : "警告"; }
function severityStyle(value: string) { return value === "Critical" ? "danger" : "warn"; }
function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString("zh-CN") : "—"; }

async function load(nextOffset = offset.value) {
  loading.value = true;
  error.value = "";
  try {
    const page = await http.get<SecurityAlertPageDto>("/api/admin/security-alerts", {
      includeAcknowledged: includeAcknowledged.value,
      severity: severity.value || undefined,
      category: category.value || undefined,
      offset: nextOffset,
      limit,
    });
    alerts.value = page.items;
    offset.value = page.offset;
    total.value = page.totalCount;
    activeCount.value = page.activeCount;
  } catch (reason) {
    error.value = errorMessage(reason);
  } finally {
    loading.value = false;
  }
}
async function acknowledge(alert: SecurityAlertDto) {
  operating.value = alert.id;
  try { await http.post(`/api/admin/security-alerts/${alert.id}/acknowledge`); await load(); }
  catch (reason) { error.value = errorMessage(reason); }
  finally { operating.value = null; }
}
async function acknowledgeAll() {
  operating.value = "all";
  try { await http.post("/api/admin/security-alerts/acknowledge-all"); await load(0); }
  catch (reason) { error.value = errorMessage(reason); }
  finally { operating.value = null; }
}
async function remove(alert: SecurityAlertDto) {
  operating.value = alert.id;
  try {
    await http.del(`/api/admin/security-alerts/${alert.id}`);
    selected.value = null;
    detailVisible.value = false;
    await load(alerts.value.length === 1 ? Math.max(0, offset.value - limit) : offset.value);
  } catch (reason) { error.value = errorMessage(reason); }
  finally { operating.value = null; }
}
function paginate(event: PageState) {
  void load(event.page * limit);
}
watch([includeAcknowledged, severity, category], () => void load(0));
onMounted(() => void load(0));
</script>

<template>
  <div class="flex flex-col gap-5">
    <SettingsGroup title="安全事件" :hint="`${activeCount} 条未处理事件；重复事件会按来源和路径聚合。`" root>
      <Message v-if="error" severity="error" class="mb-4">{{ error }}</Message>
      <ResponsiveDataTable
        :value="alerts"
        :loading="loading"
        data-key="id"
        empty-text="当前没有安全警报"
        :page="Math.floor(offset / limit) + 1"
        :total-records="total"
        @page="paginate"
      >
        <template #filters>
          <Select v-model="severity" :options="severities" option-label="label" option-value="value" class="w-full sm:w-36" />
          <Select v-model="category" :options="categories" option-label="label" option-value="value" class="w-full sm:w-64" />
        </template>
        <template #actions>
          <Button :label="includeAcknowledged ? '仅看未处理' : '查看历史'" icon="pi pi-history" severity="secondary" outlined :disabled="loading" @click="includeAcknowledged = !includeAcknowledged" />
          <Button label="刷新" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" @click="load()" />
          <Button v-if="activeCount" label="全部确认" icon="pi pi-check-circle" severity="danger" outlined :loading="operating === 'all'" :disabled="operating !== null" @click="acknowledgeAll" />
        </template>
        <Column header="级别" class="w-24"><template #body="{ data }"><Tag :value="severityLabel(data.severity)" :severity="severityStyle(data.severity)" /></template></Column>
        <Column header="警报类型" class="min-w-56"><template #body="{ data }"><span class="font-medium">{{ categoryLabel(data.category) }}</span><small v-if="data.acknowledgedAt" class="ml-2 text-[var(--p-text-muted-color)]">已确认</small></template></Column>
        <Column field="sourceIp" header="来源 IP" class="min-w-36"><template #body="{ data }"><code>{{ data.sourceIp }}</code></template></Column>
        <Column field="count" header="次数" class="w-24" />
        <Column header="最后发生" class="min-w-44"><template #body="{ data }">{{ dateLabel(data.lastSeenAt) }}</template></Column>
        <Column header="操作" class="min-w-52"><template #body="{ data }"><div class="flex flex-wrap gap-2"><Button label="详情" icon="pi pi-eye" size="small" severity="secondary" outlined @click="selected = data; detailVisible = true" /><Button v-if="!data.acknowledgedAt" label="确认" icon="pi pi-check" size="small" outlined :loading="operating === data.id" :disabled="operating !== null" @click="acknowledge(data)" /><Button label="删除" icon="pi pi-trash" size="small" severity="danger" outlined :loading="operating === data.id" :disabled="operating !== null" @click="remove(data)" /></div></template></Column>
        <template #item="{ item }">
          <article class="space-y-3 p-4" :class="item.acknowledgedAt ? 'opacity-65' : ''">
            <div class="flex items-start gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2"><Tag :value="severityLabel(item.severity)" :severity="severityStyle(item.severity)" /><span class="font-medium">{{ categoryLabel(item.category) }}</span></div>
                <p class="mt-2 truncate font-mono text-xs text-[var(--p-text-muted-color)]">{{ item.sourceIp }} · {{ dateLabel(item.lastSeenAt) }}</p>
              </div>
              <span class="shrink-0 rounded-md border border-[var(--p-content-border-color)] bg-[var(--p-content-hover-background)] px-2 py-1 font-mono text-xs font-semibold">{{ item.count }} 次</span>
            </div>
            <p class="m-0 line-clamp-2 break-words text-sm text-[var(--p-text-muted-color)]">{{ item.message }}</p>
            <div class="flex flex-wrap gap-2 border-t border-[var(--p-content-border-color)] pt-3">
              <Button label="详情" icon="pi pi-eye" size="small" severity="secondary" outlined @click="selected = item; detailVisible = true" />
              <Button v-if="!item.acknowledgedAt" label="确认" icon="pi pi-check" size="small" outlined :loading="operating === item.id" :disabled="operating !== null" @click="acknowledge(item)" />
              <Button label="删除" icon="pi pi-trash" size="small" severity="danger" outlined :loading="operating === item.id" :disabled="operating !== null" @click="remove(item)" />
            </div>
          </article>
        </template>
      </ResponsiveDataTable>
    </SettingsGroup>

    <Dialog v-model:visible="detailVisible" modal header="安全警报详情" class="w-full max-w-2xl">
      <div v-if="selected" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2"><Tag :value="severityLabel(selected.severity)" :severity="severityStyle(selected.severity)" /><Tag :value="categoryLabel(selected.category)" severity="secondary" /><span class="font-mono text-sm">聚合 {{ selected.count }} 次</span></div>
        <dl class="grid gap-3 rounded-lg border border-[var(--p-content-border-color)] p-4 text-sm sm:grid-cols-2"><div><dt class="text-xs text-[var(--p-text-muted-color)]">来源 IP</dt><dd class="mt-1 break-all font-mono">{{ selected.sourceIp }}</dd></div><div><dt class="text-xs text-[var(--p-text-muted-color)]">状态</dt><dd class="mt-1">{{ selected.acknowledgedAt ? `${dateLabel(selected.acknowledgedAt)} 已确认` : '未处理' }}</dd></div><div><dt class="text-xs text-[var(--p-text-muted-color)]">首次发生</dt><dd class="mt-1">{{ dateLabel(selected.firstSeenAt) }}</dd></div><div><dt class="text-xs text-[var(--p-text-muted-color)]">最后发生</dt><dd class="mt-1">{{ dateLabel(selected.lastSeenAt) }}</dd></div></dl>
        <div><p class="text-xs text-[var(--p-text-muted-color)]">详细信息</p><p class="mt-1 whitespace-pre-wrap break-words text-sm">{{ selected.message }}</p></div>
        <div><p class="text-xs text-[var(--p-text-muted-color)]">请求路径</p><code class="mt-1 block break-all rounded-lg bg-[var(--p-content-hover-background)] p-3 text-xs">{{ selected.path || '—' }}</code></div>
      </div>
      <template #footer><Button label="关闭" severity="secondary" outlined @click="detailVisible = false" /><Button v-if="selected && !selected.acknowledgedAt" label="确认处理" icon="pi pi-check" outlined :loading="operating === selected.id" @click="acknowledge(selected); detailVisible = false" /></template>
    </Dialog>
  </div>
</template>
