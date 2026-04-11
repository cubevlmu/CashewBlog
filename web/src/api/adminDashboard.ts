import { mapDashboardToSummary } from '@/mappers/adminApi'
import { requestJson } from '@/data/core/http'
import type { ApiDashboardData } from '@/types/api'

export function getAdminDashboardSummary() {
  return requestJson<ApiDashboardData>('/api/v1/admin/dashboard').then(mapDashboardToSummary)
}
