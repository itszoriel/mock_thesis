import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { resolvePublicSiteUrl } from '../lib/config'
import { useAdminStore } from '../lib/store'

export default function AdminHeader() {
  const { user, logout } = useAdminStore()
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const initials = `${user?.first_name?.[0] || ''}${user?.last_name?.[0] || ''}`

  const PUBLIC_SITE_URL = resolvePublicSiteUrl()

  const openPublicSite = () => {
    const url = PUBLIC_SITE_URL
    window.open(url, '_blank')
  }

  const getMunicipalityName = () => {
    if ((user as any)?.admin_municipality_name) return (user as any).admin_municipality_name
    if ((user as any)?.municipality_name) return (user as any).municipality_name
    return 'Zambales'
  }

  const getMunicipalityLogo = () => {
    const municipalitySlug = (user as any)?.admin_municipality_slug || (user as any)?.municipality_slug
    if (municipalitySlug) {
      const municipalityMap: { [key: string]: string } = {
        'iba': 'Iba',
        'botolan': 'Botolan',
        'cabangan': 'Cabangan',
        'candelaria': 'Candelaria',
        'castillejos': 'Castillejos',
        'masinloc': 'Masinloc',
        'palauig': 'Palauig',
        'san-antonio': 'SanAntonio',
        'san-felipe': 'San Felipe',
        'san-marcelino': 'San Marcelino',
        'san-narciso': 'San Narciso',
        'santa-cruz': 'Santa-Cruz',
        'subic': 'Subic'
      }
      const municipalityFolder = municipalityMap[municipalitySlug]
      if (municipalityFolder) {
        return new URL(`../../../../public/logos/municipalities/${municipalityFolder}/${municipalityFolder}_Zambales_seal.png`, import.meta.url).toString()
      }
    }
    return new URL('../../../../public/logos/zambales/128px-Seal_of_Province_of_Zambales.svg.png', import.meta.url).toString()
  }

  const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000'
  const resolveImageUrl = (path?: string) => {
    if (!path) return undefined
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:') || path.startsWith('blob:')) return path
    if (path.startsWith('/uploads/')) return `${API_BASE_URL}${path}`
    return `${API_BASE_URL}/uploads/${path}`
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img
            src={getMunicipalityLogo()}
            alt={getMunicipalityName() + ' Logo'}
            className="h-12 w-12 object-contain"
          />
          <div>
            <h1 className="text-2xl font-serif font-bold text-zambales-green">
              {getMunicipalityName()} Admin Dashboard
            </h1>
            <p className="text-sm text-gray-600">
              Welcome, {user?.first_name} {user?.last_name}
            </p>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2">
            {user?.profile_picture ? (
              <img src={resolveImageUrl(user.profile_picture)} alt="Profile" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-medium">
                {initials || 'AD'}
              </div>
            )}
            <svg className="h-4 w-4 text-gray-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" /></svg>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border p-2 z-50">
              <button onClick={() => navigate('/profile')} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">Profile</button>
              <button onClick={openPublicSite} className="block w-full text-left px-3 py-2 rounded hover:bg-ocean-50">View Public Site</button>
              <div className="my-2 border-t" />
              <button onClick={() => { logout(); navigate('/login', { replace: true }) }} className="block w-full text-left px-3 py-2 rounded hover:bg-red-50 text-red-700">Logout</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}


