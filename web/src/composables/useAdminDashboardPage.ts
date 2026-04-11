import { onMounted, ref } from 'vue'

import { getAdminDashboardSummary } from '@/controllers/adminController'
import { authComputed, authState } from '@/stores/authStore'
import type { AdminDashboardSummary } from '@/types/adminDashboard'

export function useAdminDashboardPage() {
  const summary = ref<AdminDashboardSummary | null>(null)
  const loading = ref(true)
  const errorMessage = ref('')

  async function load() {
    loading.value = true
    errorMessage.value = ''

    try {
      summary.value = await getAdminDashboardSummary()
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '仪表盘加载失败'
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    void load()
  })

  return {
    authState,
    authComputed,
    summary,
    loading,
    errorMessage,
    load,
  }
}
