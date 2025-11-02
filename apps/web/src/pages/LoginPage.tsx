import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, handleApiError } from '@/lib/api'
import { useAppStore } from '@/lib/store'

export default function LoginPage() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAppStore((s) => s.setAuth)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const res = await authApi.login({ username: formData.username, password: formData.password })
      const { access_token, refresh_token, user } = res.data
      
      // Only allow residents to log in via web portal
      if (user?.role === 'admin' || user?.role === 'municipal_admin') {
        setError('This account is for administrative use only. Please log in via the Admin Portal.')
      } else {
        setAuth(user, access_token, refresh_token)
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(handleApiError(err, 'Login failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="card max-w-md w-full">
        <div className="w-full flex justify-center pt-6">
          <img
            src={new URL('../../../../public/logos/zambales/128px-Seal_of_Province_of_Zambales.svg.png', import.meta.url).toString()}
            alt="Zambales Seal"
            className="h-16 w-16 object-contain opacity-90"
          />
        </div>
        <h2 className="text-fluid-3xl font-serif font-semibold text-center mb-6 text-zambales-green">
          Login to MunLink
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Username or Email</label>
            <input
              type="text"
              className="input-field"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              autoComplete="username"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="input-field"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              autoComplete="current-password"
              required
            />
            <div className="text-right mt-1 text-sm">
              <Link to="/forgot-password" className="text-primary-500 hover:underline">
                Forgot password?
              </Link>
            </div>
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2 text-sm">{error}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="text-center mt-4 text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-500 hover:underline">
            Register here
          </Link>
        </p>
      </div>
    </div>
  )
}

