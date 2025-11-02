import { create } from 'zustand'
import { authApi } from './api'
import { setSessionAccessToken as setApiSessionAccessToken, getAccessToken as getApiAccessToken } from './api'

export type Municipality = {
  id: number
  name: string
  slug: string
  sealUrl?: string
}

type User = {
  id: number
  username: string
  role: 'public' | 'resident' | 'municipal_admin'
  email_verified?: boolean
  admin_verified?: boolean
  profile_picture?: string
  valid_id_front?: string
  valid_id_back?: string
  selfie_with_id?: string
}

type AppState = {
  selectedMunicipality?: Municipality
  setMunicipality: (m?: Municipality) => void
  role: 'public' | 'resident' | 'admin'
  setRole: (r: 'public' | 'resident' | 'admin') => void
  user?: User
  accessToken?: string
  refreshToken?: string
  isAuthenticated: boolean
  isAuthBootstrapped: boolean
  setAuthBootstrapped: (v: boolean) => void
  emailVerified: boolean
  adminVerified: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  loginAs: (r: 'resident' | 'admin') => void
  logout: () => void
  forceLogout: () => void
}

export const useAppStore = create<AppState>((set) => {
  const storedRole = (typeof window !== 'undefined' && (localStorage.getItem('munlink:role') as any)) || 'public'
  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('munlink:user') : null
  // no persisted tokens; use in-memory + sessionStorage handled in api layer

  let initialUser: User | undefined
  try {
    initialUser = storedUser ? JSON.parse(storedUser) : undefined
  } catch {
    initialUser = undefined
  }

  const emailVerified = !!initialUser?.email_verified
  const adminVerified = !!initialUser?.admin_verified

  // Function to refresh user profile data
  const refreshUserProfile = async () => {
    if (typeof window !== 'undefined' && getApiAccessToken()) {
      try {
        const { authApi } = await import('./api')
        const response = await authApi.getProfile()
        const userData = response.data
        if (userData) {
          // Update localStorage and state
          localStorage.setItem('munlink:user', JSON.stringify(userData))
          set({
            user: userData,
            emailVerified: !!userData.email_verified,
            adminVerified: !!userData.admin_verified,
          })
        }
      } catch (error) {
        console.error('Failed to refresh user profile:', error)
      }
    }
  }

  // Refresh profile on app load if user is authenticated
  if (typeof window !== 'undefined' && getApiAccessToken() && initialUser) {
    // Check if user data is missing ID document fields (old data)
    if (!initialUser.valid_id_front && !initialUser.valid_id_back && !initialUser.selfie_with_id) {
      refreshUserProfile()
    }
  }

  return {
    selectedMunicipality: undefined,
    setMunicipality: (m) => set({ selectedMunicipality: m }),
    role: storedRole,
    setRole: (r) => {
      if (typeof window !== 'undefined') localStorage.setItem('munlink:role', r)
      set({ role: r, isAuthenticated: r !== 'public' })
    },
    user: initialUser,
    accessToken: undefined,
    refreshToken: undefined,
    isAuthenticated: !!getApiAccessToken() && storedRole !== 'public',
    isAuthBootstrapped: false,
    setAuthBootstrapped: (v) => set({ isAuthBootstrapped: v }),
    emailVerified,
    adminVerified,
    setAuth: (user, accessToken, _refreshToken) => {
      const mappedRole: 'public' | 'resident' | 'admin' = user.role === 'municipal_admin' ? 'admin' : (user.role as any)
      // Only allow resident sessions in web app
      if (mappedRole !== 'resident') {
        return
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('munlink:role', mappedRole)
        localStorage.setItem('munlink:user', JSON.stringify(user))
      }
      // hydrate in-memory token and schedule proactive refresh
      setApiSessionAccessToken(accessToken)
      set({
        user,
        accessToken,
        refreshToken: undefined,
        role: mappedRole,
        isAuthenticated: true,
        emailVerified: !!user.email_verified,
        adminVerified: !!user.admin_verified,
      })
    },
    loginAs: (r) => {
      if (typeof window !== 'undefined') localStorage.setItem('munlink:role', r)
      set({ role: r, isAuthenticated: true })
    },
    logout: () => {
      // best-effort server logout to clear cookie and blacklist token
      try { void authApi.logout() } catch {}
      if (typeof window !== 'undefined') {
        localStorage.removeItem('munlink:role')
        localStorage.removeItem('munlink:user')
      }
      setApiSessionAccessToken(null)
      set({ role: 'public', isAuthenticated: false, user: undefined, accessToken: undefined, refreshToken: undefined, emailVerified: false, adminVerified: false })
    },
    forceLogout: () => {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('munlink:role')
        localStorage.removeItem('munlink:user')
      }
      setApiSessionAccessToken(null)
      set({ role: 'public', isAuthenticated: false, user: undefined, accessToken: undefined, refreshToken: undefined, emailVerified: false, adminVerified: false })
    },
  }
})


