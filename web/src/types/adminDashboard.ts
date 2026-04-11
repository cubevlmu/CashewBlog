export interface AdminDashboardStat {
  label: string
  value: string
}

export interface AdminDashboardSummary {
  stats: AdminDashboardStat[]
  recentPosts: string[]
  recentComments: string[]
}
