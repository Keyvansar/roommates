// Client-side API utilities with CSRF token support

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf'

/**
 * Get CSRF token from cookie (client-side)
 */
function getCSRFTokenFromCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`))
  return match ? match[2] : null
}

/**
 * Enhanced fetch wrapper that automatically includes CSRF token
 * for state-changing requests
 */
export async function apiFetch(
  url: string,
  options: RequestInit & { method?: string } = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)

  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrfToken = getCSRFTokenFromCookie()
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  // Ensure JSON content type for requests with body
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(url, { ...options, headers })

  // Handle CSRF token errors
  if (response.status === 403) {
    const data = await response.json().catch(() => ({}))
    if (data.error?.includes('CSRF')) {
      // Auto-refresh page on CSRF failure to get new token
      window.location.reload()
      throw new Error('CSRF token invalid - page refreshing')
    }
  }

  return response
}

/**
 * JSON API wrapper with CSRF support
 */
export async function apiRequest<T>(
  url: string,
  options: RequestInit & { method?: string; body?: any } = {}
): Promise<T> {
  const fetchOptions: RequestInit = {
    ...options,
    headers: options.headers || {},
  }

  if (options.body && typeof options.body === 'object') {
    fetchOptions.body = JSON.stringify(options.body)
  }

  const response = await apiFetch(url, fetchOptions)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

// Convenience methods
export const api = {
  get: <T>(url: string) => apiRequest<T>(url, { method: 'GET' }),
  post: <T>(url: string, body?: any) => apiRequest<T>(url, { method: 'POST', body }),
  put: <T>(url: string, body?: any) => apiRequest<T>(url, { method: 'PUT', body }),
  patch: <T>(url: string, body?: any) => apiRequest<T>(url, { method: 'PATCH', body }),
  delete: <T>(url: string) => apiRequest<T>(url, { method: 'DELETE' }),
}
