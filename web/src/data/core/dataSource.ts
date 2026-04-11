export type DataSourceMode = 'mock' | 'api'

export function resolveDataSourceMode(): DataSourceMode {
  return import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_API === 'true' ? 'mock' : 'api'
}

export function isMockDataSourceEnabled() {
  return resolveDataSourceMode() === 'mock'
}
