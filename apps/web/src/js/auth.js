import { apiRequest } from './api'

export function fetchCsrfToken() {
  return apiRequest('/auth/csrf').then(function (res) {
    const token = res?.data?.csrf_token || ''
    const meta = document.querySelector('meta[name="csrf-token"]')
    if (meta && token) meta.setAttribute('content', token)
    return token
  })
}

export function login(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    data: { email, password },
  })
}

export function logout() {
  return apiRequest('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return apiRequest('/auth/me')
}
