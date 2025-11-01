import { useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { User, Globe } from 'lucide-react'
import { useAdminStore } from '../../lib/store'
import type { AdminState } from '../../lib/store'

interface TopHeaderProps {
  sidebarCollapsed: boolean
  onOpenMobile: () => void
}

export default function TopHeader({ sidebarCollapsed, onOpenMobile }: TopHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const user = useAdminStore((state: AdminState) => state.user)
  const doLogout = useAdminStore((state: AdminState) => state.logout)
  
  // Get current page name from path
  const getCurrentPageName = () => {
    const path = location.pathname
    if (path === '/dashboard') return 'Dashboard'
    if (path === '/residents') return 'Residents'
    if (path === '/benefits') return 'Benefits'
    if (path === '/requests') return 'Requests'
    if (path === '/marketplace') return 'Marketplace'
    if (path === '/admins') return 'Admins'
    if (path === '/reports') return 'Reports'
    return 'Dashboard'
  }
  
  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'
  // Resolve public site URL: prefer explicit env; otherwise, if running on a dev port (e.g., 3001), link to 3000
  const PUBLIC_SITE_URL = (import.meta as any).env?.VITE_PUBLIC_SITE_URL || (() => {
    try {
      const { protocol, hostname, port } = window.location
      const n = Number(port)
      if (!Number.isNaN(n) && n > 0) {
        const guess = n >= 3001 ? String(n - 1) : '3000'
        return `${protocol}//${hostname}:${guess}`
      }
      return `${protocol}//${hostname}`
    } catch {
      return '/'
    }
  })()
  const resolveImageUrl = (path?: string) => {
    if (!path) return undefined
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) return path
    if (path.startsWith('/uploads/')) return `${API_BASE_URL}${path}`
    return `${API_BASE_URL}/uploads/${path}`
  }

  const handleLogout = () => {
    try { sessionStorage.clear() } catch {}
    doLogout()
    navigate('/login', { replace: true })
  }

  const goToProfile = () => {
    navigate('/profile')
  }
  // On tablet (md–lg), always align to pinned rail (80px). On xl+, respect collapse state.
  const leftOffset = sidebarCollapsed ? 'md:left-[80px] xl:left-[80px]' : 'md:left-[80px] xl:left-[260px]'
  const portalTitle = `${user?.admin_municipality_name || 'Municipality'} Admin Portal`
  return (
    <header className={`fixed top-0 right-0 left-0 ${leftOffset} h-16 bg-white md:bg-white/90 md:backdrop-blur-xl border-b border-neutral-200 z-40 transition-all duration-300`}>
      <div className="h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <button className="md:hidden w-9 h-9 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center justify-center" onClick={onOpenMobile} aria-label="Open menu">
            <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
          </button>
          <span className="hidden md:inline text-neutral-500">Admin</span>
          <span className="hidden md:inline text-neutral-400">/</span>
          <span className="hidden md:inline text-ocean-600 font-medium">{getCurrentPageName()}</span>
        </div>
        {/* Center title on mobile to avoid empty space */}
        <div className="flex-1 md:hidden text-center px-2">
          <span className="text-sm font-semibold text-neutral-700 truncate max-w-[70%] inline-block align-middle">{portalTitle}</span>
        </div>
        {/* Removed global header search per requirements */}
        <div className="flex items-center gap-3">
          {/* Mobile avatar button opens quick actions */}
          <button
            className="md:hidden flex items-center gap-2 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition-colors"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open account menu"
          >
            {user?.profile_picture ? (
              <img src={resolveImageUrl(user.profile_picture)} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 bg-ocean-gradient rounded-full flex items-center justify-center text-white font-bold text-xs">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
          </button>

          <div className="relative group hidden md:block">
            <button className="flex items-center gap-2 px-3 py-2 bg-neutral-50 hover:bg-neutral-100 rounded-xl transition-colors">
              <div className="relative">
              {user?.profile_picture ? (
                <img src={resolveImageUrl(user.profile_picture)} alt="Profile" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 bg-ocean-gradient rounded-full flex items-center justify-center text-white font-bold text-xs">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
              )}
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-forest-500 rounded-full border-2 border-white" />
              </div>
              <span className="text-sm font-medium text-neutral-700">{user?.first_name} {user?.last_name}</span>
              <svg className="w-4 h-4 text-neutral-500 group-hover:text-neutral-700 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
            </button>
            <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-neutral-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all hidden md:block">
              <div className="px-4 py-3 border-b border-neutral-200">
                <p className="font-semibold text-sm text-neutral-900">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-neutral-600">{user?.email}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-ocean-100 text-ocean-700 text-xs font-medium rounded-full">{user?.admin_municipality_name || 'Admin'}</span>
              </div>
              <div className="py-2">
                <button onClick={goToProfile} className="w-full text-left flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 transition-colors"><User className="w-4 h-4" aria-hidden="true" /><span className="text-sm font-medium text-neutral-700">My Profile</span></button>
                <a href={PUBLIC_SITE_URL} target="_blank" className="flex items-center gap-3 px-4 py-2 hover:bg-neutral-50 transition-colors"><Globe className="w-4 h-4" aria-hidden="true" /><span className="text-sm font-medium text-neutral-700">View Public Site</span></a>
              </div>
              <div className="px-4 py-3 border-t border-neutral-200">
                <button onClick={handleLogout} className="w-full btn bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Mobile slide-over for account actions */}
      <div className={`fixed inset-0 z-[90] md:hidden ${mobileMenuOpen ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileMenuOpen(false)} />
        <aside className="absolute right-0 top-0 h-full w-[85%] xxs:w-[80%] xs:w-[70%] bg-white p-4 pb-24 flex flex-col shadow-2xl border-l border-neutral-200">
          <div className="flex items-center gap-3 p-3 border-b border-neutral-200">
            {user?.profile_picture ? (
              <img src={resolveImageUrl(user.profile_picture)} alt="Profile" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 bg-ocean-gradient rounded-full flex items-center justify-center text-white font-bold text-sm">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-medium text-neutral-900 truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-neutral-600 truncate">{user?.email}</p>
            </div>
          </div>
          <div className="py-2 flex-1">
            <button onClick={() => { setMobileMenuOpen(false); goToProfile(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-50 transition-colors"><User className="w-4 h-4" aria-hidden="true" /><span className="text-sm font-medium text-neutral-700">My Profile</span></button>
            <a href={PUBLIC_SITE_URL} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-neutral-50 transition-colors"><Globe className="w-4 h-4" aria-hidden="true" /><span className="text-sm font-medium text-neutral-700">View Public Site</span></a>
          </div>
          <div className="p-4 border-t border-neutral-200">
            <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="w-full btn bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium">Logout</button>
          </div>
        </aside>
      </div>
    </header>
  )
}


