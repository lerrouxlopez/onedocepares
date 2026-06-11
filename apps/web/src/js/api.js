const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const CSRF_META_NAME = 'csrf-token'
let csrfTokenCache = null

function ensureCsrfMeta() {
  let meta = document.querySelector(`meta[name="${CSRF_META_NAME}"]`)

  if (!meta) {
    meta = document.createElement('meta')
    meta.name = CSRF_META_NAME
    document.head.append(meta)
  }

  return meta
}

function setCsrfToken(token) {
  csrfTokenCache = token || null
  ensureCsrfMeta().content = csrfTokenCache || ''
}

function getCsrfToken() {
  if (csrfTokenCache) {
    return csrfTokenCache
  }

  const meta = document.querySelector(`meta[name="${CSRF_META_NAME}"]`)
  csrfTokenCache = meta?.content || null
  return csrfTokenCache
}

function buildHeaders({ headers = {}, body } = {}) {
  const builtHeaders = {
    Accept: 'application/json',
    ...headers,
  }

  if (!(body instanceof FormData) && body !== undefined && !builtHeaders['Content-Type']) {
    builtHeaders['Content-Type'] = 'application/json'
  }

  return builtHeaders
}

function buildBody(body, headers) {
  if (body === undefined || body instanceof FormData) {
    return body
  }

  if (headers['Content-Type'] === 'application/json') {
    return JSON.stringify(body)
  }

  return body
}

function parseErrorBody(payload, fallbackMessage) {
  if (payload?.error?.message) {
    return payload.error.message
  }

  return fallbackMessage
}

export class ApiError extends Error {
  constructor(message, { status, payload, isNetworkError = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status || 0
    this.payload = payload || null
    this.isNetworkError = isNetworkError
  }
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = buildHeaders(options)

  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrfToken = getCsrfToken() || (await fetchCsrfToken().catch(() => null))

    if (csrfToken) {
      headers['x-csrf-token'] = csrfToken
    }
  }

  let response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      body: buildBody(options.body, headers),
      credentials: 'include',
    })
  } catch (error) {
    const apiError = new ApiError('Network error while contacting API.', {
      isNetworkError: true,
    })
    dispatchApiError(apiError)
    throw apiError
  }

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = parseErrorBody(payload, `Request failed with status ${response.status}.`)
    const apiError = new ApiError(message, { status: response.status, payload })
    dispatchApiError(apiError)
    throw apiError
  }

  return payload
}

export function dispatchApiError(error) {
  window.dispatchEvent(
    new CustomEvent('odp:api-error', {
      detail: {
        message: error.message,
        error,
      },
    }),
  )
}

export async function getHealth() {
  return apiRequest('/health')
}

export async function getPublicPage(slug) {
  return apiRequest(`/cms/pages/${encodeURIComponent(slug)}`)
}

export async function login(credentials) {
  const response = await apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
  })

  await fetchCsrfToken()
  return response
}

export async function logout() {
  const response = await apiRequest('/auth/logout', {
    method: 'POST',
  })

  setCsrfToken(null)
  return response
}

export async function fetchCurrentUser() {
  return apiRequest('/auth/me')
}

export async function fetchCsrfToken() {
  const response = await apiRequest('/auth/csrf')
  setCsrfToken(response?.data?.csrf_token || null)
  return response
}

export async function listPages() {
  return apiRequest('/admin/cms/pages')
}

export async function createPage(payload) {
  return apiRequest('/admin/cms/pages', {
    method: 'POST',
    body: payload,
  })
}

export async function updatePage(id, payload) {
  return apiRequest(`/admin/cms/pages/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function publishPage(id) {
  return apiRequest(`/admin/cms/pages/${id}/publish`, {
    method: 'POST',
  })
}

export async function unpublishPage(id) {
  return apiRequest(`/admin/cms/pages/${id}/unpublish`, {
    method: 'POST',
  })
}

export async function listMedia() {
  return apiRequest('/admin/media')
}

export async function uploadMedia(file) {
  const body = new FormData()
  body.append('file', file)

  return apiRequest('/admin/media', {
    method: 'POST',
    body,
  })
}

export async function updateMedia(id, payload) {
  return apiRequest(`/admin/media/${id}`, {
    method: 'PATCH',
    body: payload,
  })
}

export async function deleteMedia(id) {
  return apiRequest(`/admin/media/${id}`, {
    method: 'DELETE',
  })
}

export function isUnauthorizedError(error) {
  return error instanceof ApiError && error.status === 401
}

export function isForbiddenError(error) {
  return error instanceof ApiError && error.status === 403
}

export function isNetworkError(error) {
  return error instanceof ApiError && error.isNetworkError
}
