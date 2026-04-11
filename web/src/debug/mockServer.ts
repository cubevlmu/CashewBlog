import { requestMockJson } from '@/mocks/api'

export interface MockApiServer {
  requestJson<T>(path: string, options?: RequestInit): Promise<T>
}

export function createMockApiServer(): MockApiServer {
  return {
    requestJson: requestMockJson,
  }
}

export const mockApiServer = createMockApiServer()
