import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi, handleApiError } from '@/lib/api'

type Status = 'idle' | 'success' | 'error'

export default function ForgotPasswordPage() {
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    date_of_birth: '',
  })
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  const handleChange = (field: 'email' | 'username' | 'date_of_birth') => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setStatus('idle')
    setMessage('')
    try {
      const resp = await authApi.requestPasswordReset(formData)
      const msg = resp?.data?.message || 'If the details match our records, you will receive a password reset email shortly.'
      setStatus('success')
      setMessage(msg)
    } catch (err: any) {
      setStatus('error')
      setMessage(handleApiError(err, 'Unable to process your request right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
      <div className="card max-w-lg w-full">
        <div className="w-full flex justify-center pt-4">
          <img
            src={new URL('../../../../public/logos/zambales/128px-Seal_of_Province_of_Zambales.svg.png', import.meta.url).toString()}
            alt="Zambales Seal"
            className="h-16 w-16 object-contain opacity-90"
          />
        </div>
        <h2 className="text-fluid-3xl font-serif font-semibold text-center mb-6 text-zambales-green">
          Forgot Password
        </h2>

        <p className="text-sm text-gray-600 text-center mb-6">
          Enter your account details so we can verify your identity and email you a secure password reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="input-field"
              value={formData.email}
              onChange={handleChange('email')}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input
              type="text"
              className="input-field"
              value={formData.username}
              onChange={handleChange('username')}
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Birthday</label>
            <input
              type="date"
              className="input-field"
              value={formData.date_of_birth}
              onChange={handleChange('date_of_birth')}
              required
            />
          </div>

          {status !== 'idle' && message && (
            <div
              className={`rounded px-3 py-2 text-sm border ${
                status === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {message}
            </div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Sending instructions…' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          Remembered your password?{' '}
          <Link to="/login" className="text-primary-500 hover:underline">
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  )
}

