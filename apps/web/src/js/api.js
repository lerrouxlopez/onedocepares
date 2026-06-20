import $ from 'jquery'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'

function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || ''
}

export function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const { data, headers = {} } = options
  const isUnsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isFormData = data instanceof FormData

  const ajaxSettings = {
    url: `${API_BASE}${path}`,
    method,
    xhrFields: { withCredentials: true },
    headers: {
      Accept: 'application/json',
      ...(isUnsafe && { 'X-CSRF-Token': getCsrfToken() }),
      ...headers,
    },
  }

  if (data !== undefined) {
    if (isFormData) {
      ajaxSettings.data = data
      ajaxSettings.processData = false
      ajaxSettings.contentType = false
    } else {
      ajaxSettings.data = JSON.stringify(data)
      ajaxSettings.contentType = 'application/json'
    }
  }

  return $.ajax(ajaxSettings).fail(function (xhr, status, error) {
    document.dispatchEvent(
      new CustomEvent('odp:api-error', {
        detail: {
          message: xhr.responseJSON?.error?.message || error || status,
          xhr,
        },
      }),
    )
  })
}

export function getHealth() {
  return apiRequest('/health')
}
