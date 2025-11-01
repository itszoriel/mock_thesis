import { NavLink } from 'react-router-dom'
import { useAdminStore } from '../../lib/store'
import type { AdminState } from '../../lib/store'
import { LayoutDashboard, Users, Gift, FileText, AlertTriangle, ShoppingBag, Megaphone, BarChart3 } from 'lucide-react'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  className?: string
}

const navItems = [
  { icon: 'dashboard', label: 'Dashboard', path: '/dashboard', badge: null },
  { icon: 'residents', label: 'Residents', path: '/residents', badge: null },
  { icon: 'benefits', label: 'Benefits', path: '/benefits', badge: null },
  { icon: 'requests', label: 'Requests', path: '/requests', badge: null },
  { icon: 'issues', label: 'Issues', path: '/issues', badge: null },
  { icon: 'marketplace', label: 'Marketplace', path: '/marketplace', badge: null },
  { icon: 'announcements', label: 'Announcements', path: '/announcements', badge: null },
  { icon: 'reports', label: 'Reports', path: '/reports', badge: null },
]

function IconFor(code: string, className = 'w-5 h-5') {
  switch (code) {
    case 'dashboard': return <LayoutDashboard className={className} aria-hidden="true" />
    case 'residents': return <Users className={className} aria-hidden="true" />
    case 'benefits': return <Gift className={className} aria-hidden="true" />
    case 'requests': return <FileText className={className} aria-hidden="true" />
    case 'issues': return <AlertTriangle className={className} aria-hidden="true" />
    case 'transactions': return <ShoppingBag className={className} aria-hidden="true" />
    case 'marketplace': return <ShoppingBag className={className} aria-hidden="true" />
    case 'announcements': return <Megaphone className={className} aria-hidden="true" />
    case 'reports': return <BarChart3 className={className} aria-hidden="true" />
    default: return <LayoutDashboard className={className} aria-hidden="true" />
  }
}

export default function Sidebar({ collapsed, onToggle, className = '' }: SidebarProps) {
  const user = useAdminStore((state: AdminState) => state.user)
  
  // Get municipality logo path
  const getMunicipalityLogo = () => {
    // Map municipality keys (slug or name) to their specific logo files in /public/logos
    const municipalityLogos: Record<string, string> = {
      // Province fallback
      'zambales': '/logos/zambales/64px-Seal_of_Province_of_Zambales.svg.png',

      // Exact slugs
      'botolan': '/logos/municipalities/Botolan/Ph_seal_zambales_botolan.png',
      'cabangan': '/logos/municipalities/Cabangan/Cabangan_Zambales_seal.png',
      'candelaria': '/logos/municipalities/Candelaria/Candelaria_Zambales_Seal.png',
      'castillejos': '/logos/municipalities/Castillejos/Castillejos_Zambales_seal.png',
      'iba': '/logos/municipalities/Iba/Iba_Zambales_seal.png',
      'masinloc': '/logos/municipalities/Masinloc/Masinloc_Zambales_seal.png',
      'palauig': '/logos/municipalities/Palauig/Palauig_Zambales_seal.png',
      'san-antonio': '/logos/municipalities/SanAntonio/SanAntonio,102Zambalesjf.png',
      'san-felipe': '/logos/municipalities/San Felipe/Seal San Felipe.png',
      'san-marcelino': '/logos/municipalities/San Marcelino/smz-logo-256px.png',
      'san-narciso': '/logos/municipalities/San Narciso/san-narciso-seal 256px.png',
      'santa-cruz': '/logos/municipalities/Santa-Cruz/Santa_Cruz_Zambales.png',
      'subic': '/logos/municipalities/Subic/subic seal 256px.png',

      // Name aliases (lowercased)
      'san antonio': '/logos/municipalities/SanAntonio/SanAntonio,102Zambalesjf.png',
      'san felipe': '/logos/municipalities/San Felipe/Seal San Felipe.png',
      'san marcelino': '/logos/municipalities/San Marcelino/smz-logo-256px.png',
      'san narciso': '/logos/municipalities/San Narciso/san-narciso-seal 256px.png',
      'santa cruz': '/logos/municipalities/Santa-Cruz/Santa_Cruz_Zambales.png',
    }

    const slug = (user?.admin_municipality_slug || '').toLowerCase()
    const name = (user?.admin_municipality_name || '').toLowerCase()
    const normalizedNameSlug = name.replace(/\s+/g, '-').trim()

    const candidates = [slug, name, normalizedNameSlug]
    for (const key of candidates) {
      if (key && municipalityLogos[key]) return municipalityLogos[key]
    }
    return municipalityLogos['zambales']
  }
  if (collapsed) {
    return (
      <aside className={`fixed left-0 top-0 h-screen w-[80px] bg-white/90 backdrop-blur-xl border-r border-neutral-200 z-50 transition-all duration-300 ${className}`}>
        <div className="flex flex-col items-center px-4 py-5 border-b border-neutral-200">
          <img src={getMunicipalityLogo()} className="w-10 h-10 mb-2" alt="Municipality Logo" />
          <button onClick={onToggle} className="w-8 h-8 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center justify-center transition-colors">
            <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <nav className="px-4 py-6 space-y-3">
          {navItems.map((item) => (
            <div key={item.path} className="relative group">
              <NavLink
                to={item.path}
                className={({ isActive }) => `flex items-center justify-center w-12 h-12 rounded-xl transition-all ${isActive ? 'bg-ocean-gradient text-white shadow-lg' : 'text-neutral-700 hover:bg-ocean-50'}`}
              >
                <span className="text-xl">{IconFor(item.icon, 'w-5 h-5')}</span>
                {item.badge && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </NavLink>
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl">
                {item.label}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-900" />
              </div>
            </div>
          ))}
        </nav>
        {/* Removed bottom profile block for compact UI; profile remains in TopHeader */}
      </aside>
    )
  }

  return (
    <aside className={`fixed left-0 top-0 h-screen w-[260px] bg-white/90 backdrop-blur-xl border-r border-neutral-200 z-50 transition-all duration-300 ${className}`}>
      <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <img src={getMunicipalityLogo()} className="w-10 h-10" alt="Municipality Logo" />
          <div>
            <p className="font-bold text-sm text-neutral-900">{user?.admin_municipality_name || 'MunLink'}</p>
            <p className="text-xs text-neutral-600">Admin Portal</p>
          </div>
        </div>
        <button onClick={onToggle} className="w-8 h-8 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center justify-center transition-colors">
          <svg className="w-5 h-5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      <nav className="px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `group flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${isActive ? 'bg-ocean-gradient text-white shadow-lg' : 'text-neutral-700 hover:bg-ocean-50 hover:text-ocean-700'}`}
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">{IconFor(item.icon, 'w-5 h-5')}</span>
              <span className="text-sm">{item.label}</span>
            </div>
            {item.badge && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{item.badge}</span>
            )}
          </NavLink>
        ))}
      </nav>
      {/* Removed bottom profile block for cleaner layout */}
    </aside>
  )
}


