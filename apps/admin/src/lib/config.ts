export const resolvePublicSiteUrl = (): string => {
  const envUrl = (import.meta as any)?.env?.VITE_PUBLIC_SITE_URL
  if (typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl
  }

  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location
    const normalizedHost = hostname?.toLowerCase?.() ?? ''
    const isLocalHost = normalizedHost === 'localhost' || normalizedHost === '127.0.0.1' || normalizedHost === '::1'

    if (isLocalHost) {
      return `${protocol}//${hostname}:3000`
    }
  }

  return 'https://munlink-web.onrender.com'
}

