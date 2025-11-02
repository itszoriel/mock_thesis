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
  const [showPassword, setShowPassword] = useState(false)
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
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-400"
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

