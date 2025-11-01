import { Outlet, Link, useLocation } from 'react-router-dom'
import { useRef } from 'react'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import MunicipalitySelect from './MunicipalitySelect'
import ServicesMenu from './ServicesMenu'
import { useNavigate } from 'react-router-dom'
import Footer from './Footer'
import AuthStatusBanner from './AuthStatusBanner'
import { Toast } from '@munlink/ui'
import { mediaUrl } from '@/lib/api'
import { Menu } from 'lucide-react'

export default function Layout() {
  const accountRef = useRef<HTMLDetailsElement>(null)
  const closeAccount = () => { try { if (accountRef.current) accountRef.current.open = false } catch {} }
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'warning' | 'info'; message: string } | null>(null)
  const role = useAppStore((s) => s.role)
  const user = useAppStore((s) => s.user)
  const logout = useAppStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()

  // Re-validate auth on history navigation to prevent back access after logout
  useEffect(() => {
    const protectedPrefixes = ['/dashboard', '/profile', '/my-marketplace', '/upload-id']
    const recheckAuth = () => {
      const { isAuthenticated: auth, role: currentRole } = useAppStore.getState()
      const path = typeof window !== 'undefined' ? window.location.pathname || '' : ''
      const needsAuth = protectedPrefixes.some((prefix) => path.startsWith(prefix))
      if (needsAuth && (!auth || currentRole === 'public')) {
        navigate('/login', { replace: true })
      }
    }
    window.addEventListener('pageshow', recheckAuth)
    window.addEventListener('popstate', recheckAuth)
    return () => {
      window.removeEventListener('pageshow', recheckAuth)
      window.removeEventListener('popstate', recheckAuth)
    }
  }, [navigate])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    onScroll();
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Read one-time toast from navigation state
  useEffect(() => {
    const anyState = (location as any)?.state
    const nextToast = anyState?.toast
    if (nextToast) {
      setToast(nextToast)
      // Clear the navigation state to avoid repeated toasts on back/forward
      navigate(location.pathname + location.search, { replace: true })
    }
  }, [location, navigate])

  return (
    <div className={"min-h-screen flex flex-col"}>
      <nav className={"fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-6xl "+(scrolled?"":"") }>
        <div className="bg-white/70 backdrop-blur-xl rounded-full px-6 py-3 shadow-2xl border border-white/50">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-lg md:text-xl font-serif font-semibold text-gray-900">
              MunLink Zambales
            </Link>

            <div className="hidden md:flex items-center gap-6 text-gray-900">
              <Link to="/" className="hover:text-ocean-700 transition-colors font-serif">
                Home
              </Link>
              <Link to="/announcements" className="hover:text-ocean-700 transition-colors font-serif">
                Announcements
              </Link>
              <Link to="/marketplace" className="hover:text-ocean-700 transition-colors font-serif">
                Marketplace
              </Link>
              <ServicesMenu />
              <MunicipalitySelect />
              <Link to="/about" className="hover:text-ocean-700 transition-colors font-serif">
                About
              </Link>
              {role === 'public' ? (
                <>
                  <span aria-hidden="true" className="w-px h-6 bg-white/50" />
                  <Link to="/login" className="hover:text-ocean-700 transition-colors font-serif">Login</Link>
                  <span aria-hidden="true" className="w-px h-6 bg-white/50" />
                  <Link to="/register" className="hover:text-ocean-700 transition-colors font-serif">Register</Link>
                </>
              ) : (
                <details ref={accountRef} className="relative group">
                  <summary className="list-none cursor-pointer flex items-center gap-2">
                    {user?.profile_picture ? (
                      <img src={mediaUrl(user.profile_picture)} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-white/60" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center text-xs font-semibold">
                        {(user?.username || 'A').slice(0,2).toUpperCase()}
                      </div>
                    )}
                    <span className="font-serif">Account ▾</span>
                  </summary>
                  <div className="absolute right-0 mt-3 w-56 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
                    <button onClick={() => { closeAccount(); navigate('/dashboard') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">Dashboard</button>
                    <button onClick={() => { closeAccount(); navigate('/my-marketplace') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">My Marketplace</button>
                    <button onClick={() => { closeAccount(); navigate('/profile') }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">Profile</button>
                    <button onClick={() => { closeAccount(); logout(); navigate('/login', { replace: true }) }} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">Logout</button>
                  </div>
                </details>
              )}
            </div>

            {/* Mobile hamburger */}
            <button className="md:hidden btn-ghost rounded-full" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile slide-over menu */}
      <div className={`fixed inset-0 z-50 md:hidden ${mobileOpen ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
        <aside className="absolute right-0 top-0 h-full w-[85%] xxs:w-[80%] xs:w-[70%] bg-white p-4 flex flex-col">
          <div className="px-2 py-3 border-b border-neutral-200">
            <Link to="/" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Home</Link>
            <Link to="/announcements" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Announcements</Link>
            <Link to="/marketplace" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Marketplace</Link>
            <div className="mt-1 mb-1 px-3 text-xs font-semibold tracking-wide text-neutral-500 uppercase">Services</div>
            <Link to="/documents" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Documents</Link>
            <Link to="/issues" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Issues</Link>
            <Link to="/benefits" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">Benefits</Link>
            <Link to="/about" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-neutral-50">About</Link>
            <div className="px-3 py-2">
              <MunicipalitySelect />
            </div>
          </div>
          <div className="mt-auto p-3 border-t border-neutral-200">
            {role === 'public' ? (
              <div className="grid gap-2">
                <Link to="/login" onClick={() => setMobileOpen(false)} className="btn-primary text-center">Login</Link>
                <Link to="/register" onClick={() => setMobileOpen(false)} className="btn-secondary text-center">Register</Link>
              </div>
            ) : (
              <div className="grid gap-2">
                <button onClick={() => { setMobileOpen(false); navigate('/dashboard'); }} className="btn-ghost rounded">Dashboard</button>
                <button onClick={() => { setMobileOpen(false); navigate('/my-marketplace'); }} className="btn-ghost rounded">My Marketplace</button>
                <button onClick={() => { setMobileOpen(false); navigate('/profile'); }} className="btn-ghost rounded">Profile</button>
                <button onClick={() => { setMobileOpen(false); logout(); navigate('/login', { replace: true }) }} className="btn-primary rounded">Logout</button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <div className="h-24" />
      <AuthStatusBanner />
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  )
}

