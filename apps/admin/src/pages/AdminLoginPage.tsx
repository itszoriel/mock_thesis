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
          <input type="password" className="input-field" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} required />
        </div>
        <button className="btn-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </div>
  )
}


