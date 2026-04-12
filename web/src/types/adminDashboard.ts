export interface AdminDashboardStat {
  label: string
  value: string
}

export interface AdminDashboardSummary {
  stats: AdminDashboardStat[]
  recentPosts: AdminDashboardRecentPost[]
  recentComments: AdminDashboardRecentComment[]
}

export interface AdminDashboardRecentPost {
  title: string
  author: string
  time: string
}

export interface AdminDashboardRecentComment {
  content: string
  publisher: string
  time: string
}
