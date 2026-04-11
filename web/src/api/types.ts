export interface PaginationQuery {
  page?: number
  pageSize?: number
}

export interface KeywordQuery extends PaginationQuery {
  keyword?: string
}
