import axios from 'axios'

// Base URL from Vite env; fallback to localhost
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// In-memory access token (never persisted beyond session unless caller stores it)
let accessToken: string | null = null
let refreshPromise: Promise<string | null> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let unauthorizedHandler: (() => void) | null = null

export const getAccessToken = (): string | null => accessToken
export const setAccessToken = (token: string | null) => {
  accessToken = token
  try {
    if (token) sessionStorage.setItem('access_token', token)
    else sessionStorage.removeItem('access_token')
  } catch {}
}

export const clearAccessToken = () => {
  accessToken = null
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  try { sessionStorage.removeItem('access_token') } catch {}
}

export const setSessionAccessToken = (token: string | null) => {
  setAccessToken(token)
  if (token) scheduleRefresh(token)
}

export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  unauthorizedHandler = handler
}

function base64UrlDecode(input: string): string {
  const pad = (str: string) => str + '='.repeat((4 - (str.length % 4)) % 4)
  const b64 = pad(input).replace(/-/g, '+').replace(/_/g, '/')
  try {
    return decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
  } catch {
    return ''
  }
}

function decodeJwt(token: string): any | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(base64UrlDecode(parts[1]) || 'null')
    return payload
  } catch {
    return null
  }
}

function scheduleRefresh(token: string) {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  const payload = decodeJwt(token)
  const expSec = payload?.exp
  if (!expSec || typeof expSec !== 'number') return
  const nowSec = Math.floor(Date.now() / 1000)
  const bufferSec = 60 // refresh slightly before expiry
  const delayMs = Math.max((expSec - nowSec - bufferSec) * 1000, 0)
  refreshTimer = setTimeout(() => {
    void doRefresh().catch(() => {})
  }, delayMs)
}

function getCookie(name: string): string | undefined {
  try {
    return document.cookie
      .split('; ')
      .find((row) => row.startsWith(name + '='))
      ?.split('=')[1]
  } catch {
    return undefined
  }
}

async function doRefresh(): Promise<string | null> {
  try {
    const csrf = getCookie('csrf_refresh_token')
    const resp = await axios.post(
      `${API_BASE_URL}/api/auth/refresh`,
      {},
      {
        withCredentials: true,
        validateStatus: () => true,
        headers: csrf ? { 'X-CSRF-TOKEN': csrf } : undefined,
      }
    )
    if (resp.status !== 200) return null
    const newToken: string | undefined = (resp?.data as any)?.access_token
    if (newToken) {
      setAccessToken(newToken)
      scheduleRefresh(newToken)
      return newToken
    }
  } catch {}
  return null
}

export async function bootstrapAuth(): Promise<boolean> {
  // Hydrate from sessionStorage for snappy UX
  try {
    const saved = sessionStorage.getItem('access_token')
    if (saved) {
      setAccessToken(saved)
      scheduleRefresh(saved)
      void doRefresh()
      return true
    }
  } catch {}

  // Probe for refresh cookie to avoid 401 noise on cold start
  try {
    const probe = await axios.get(`${API_BASE_URL}/api/auth/refresh-status`, {
      withCredentials: true,
      validateStatus: () => true,
    })
    const hasRefresh = !!(probe?.data as any)?.has_refresh
    if (hasRefresh) {
      const token = await doRefresh()
      return !!token
    }
    return false
  } catch {
    return false
  }
}

// Attach token on requests
api.interceptors.request.use((config: any) => {
  if (!config.headers) config.headers = {}
  if (accessToken) {
    try {
      config.headers['Authorization'] = `Bearer ${accessToken}`
    } catch {
      ;(config.headers as any).Authorization = `Bearer ${accessToken}`
    }
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {}
    if (error.response?.status === 401 && !(originalRequest as any)._retry) {
      ;(originalRequest as any)._retry = true
      try {
        refreshPromise = refreshPromise || doRefresh()
        const newToken = await refreshPromise.finally(() => { refreshPromise = null })
        if (newToken) {
          ;(originalRequest as any).headers = (originalRequest as any).headers || {}
          try {
            (originalRequest as any).headers['Authorization'] = `Bearer ${newToken}`
          } catch {
            (originalRequest as any).headers.Authorization = `Bearer ${newToken}`
          }
          return api(originalRequest)
        }
      } catch {}
      clearAccessToken()
      if (unauthorizedHandler) {
        try {
          unauthorizedHandler()
        } catch (err) {
          console.error('Unauthorized handler threw an error:', err)
        }
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api


