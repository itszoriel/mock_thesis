import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi, handleApiError } from '../lib/api'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'

// Base URL handled by api client; keep for reference only

export default function AdminLoginPage() {
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAdminStore((state: AdminState) => state.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await authApi.adminLogin(formData)
      const { user, access_token } = res as any
      
      // Verify user has admin role
      if (user.role !== 'municipal_admin' && user.role !== 'admin') {
        setError('This account is not authorized for admin access.')
        setLoading(false)
        return
      }
      
      // Store auth state
      setAuth(user, access_token, '')
      
      // Redirect to dashboard
      navigate('/dashboard')
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto card p-6">
      <div className="w-full flex justify-center pt-2">
        <img
          src={new URL('../../../../public/logos/zambales/128px-Seal_of_Province_of_Zambales.svg.png', import.meta.url).toString()}
          alt="Zambales Seal"
          className="h-14 w-14 object-contain opacity-90"
        />
      </div>
      <h1 className="text-2xl font-serif font-semibold mb-4">Admin Login</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
        <div>
          <label className="block text-sm font-medium mb-1">Username or Email</label>
          <input className="input-field" value={formData.username} onChange={(e)=>setFormData({...formData, username:e.target.value})} required />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-field pr-10"
              value={formData.password}
              onChange={(e)=>setFormData({...formData, password:e.target.value})}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-neutral-500 hover:text-neutral-700 focus:outline-none focus:ring-2 focus:ring-ocean-400"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-5 0-9.27-3.11-11-7.5a11 11 0 0 1 5-5.78" />
                  <path d="M9.88 9.88A3 3 0 0 0 12 15a3 3 0 0 0 2.12-.88" />
                  <path d="M2 2l20 20" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1.5 12C3.23 7.61 7.5 4.5 12 4.5s8.77 3.11 10.5 7.5c-1.73 4.39-6 7.5-10.5 7.5S3.23 16.39 1.5 12Z" />
                  <path d="M12 15.75A3.75 3.75 0 1 0 12 8.25a3.75 3.75 0 0 0 0 7.5Z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  )
}


