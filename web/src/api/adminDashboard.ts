import { mapDashboardToSummary } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import { authState } from '@/stores/authStore'
import type { ApiDashboardData } from '@/types/api'

export function getAdminDashboardSummary() {
  const path = authState.isAdmin ? '/api/v1/admin/dashboard' : '/api/v1/me/dashboard'
  return requestJson<ApiDashboardData>(path).then(mapDashboardToSummary)
}
