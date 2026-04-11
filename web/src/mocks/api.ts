import {
  handleAdmin,
  handleAssets,
  handleAuth,
  handleComments,
  handlePublicBlogs,
  handleSettings,
  handleTaxonomy,
  handleUsers,
  handleWriteBlogs,
} from './mockApiHandlers'
import { fail, getMethod, parseUrl } from './mockApiShared'
import { validateMockSiteData } from './site'

let mockValidationDone = false

function validateMockDataOnce() {
  if (mockValidationDone) {
    return
  }

  mockValidationDone = true
  const result = validateMockSiteData()

  if (!result.ok) {
    console.warn('[mock-api] 检测到 mock 数据一致性问题:')
    for (const issue of result.issues) {
      console.warn(`[mock-api] ${issue.message}`)
    }
    return
  }

  console.info('[mock-api] mock 数据一致性校验通过')
}

export async function requestMockJson<T>(path: string, options?: RequestInit): Promise<T> {
  validateMockDataOnce()

  const request = {
    url: parseUrl(path),
    method: getMethod(options),
    options,
  }

  const handlers = [
    handleSettings,
    handleAuth,
    handlePublicBlogs,
    handleWriteBlogs,
    handleTaxonomy,
    handleUsers,
    handleAssets,
    handleComments,
    handleAdmin,
  ]

  if (
    request.url.pathname.startsWith('/api/v1/me/blogs/')
    || request.url.pathname.startsWith('/api/v1/admin/blogs/')
    || request.url.pathname.startsWith('/api/v1/blogs/')
  ) {
    console.info('[mock-api] request', {
      method: request.method,
      path: request.url.pathname,
      body: typeof options?.body === 'string' ? options.body : undefined,
    })
  }

  for (const handler of handlers) {
    const result = await handler(request)
    if (result !== null) {
      if (
        request.url.pathname.startsWith('/api/v1/me/blogs/')
        || request.url.pathname.startsWith('/api/v1/admin/blogs/')
        || request.url.pathname.startsWith('/api/v1/blogs/')
      ) {
        console.info('[mock-api] response', {
          method: request.method,
          path: request.url.pathname,
          result,
        })
      }
      return result as T
    }
  }

  return fail(`Mock API route not implemented: ${request.method} ${request.url.pathname}`) as T
}
