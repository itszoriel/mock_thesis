import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { authApi, handleApiError } from '@/lib/api'

type ViewState = 'checking' | 'invalid' | 'ready' | 'success'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [viewState, setViewState] = useState<ViewState>(token ? 'checking' : 'invalid')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [formData, setFormData] = useState({ new_password: '', confirm_password: '' })
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setViewState('invalid')
        setMessage('This password reset link is invalid. Please request a new one.')
        return
      }
      try {
        await authApi.verifyPasswordResetToken(token)
        setViewState('ready')
        setMessage('')
      } catch (err: any) {
        setViewState('invalid')
        setMessage(handleApiError(err, 'This password reset link is no longer valid.'))
      }
    }
    void verifyToken()
  }, [token])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (formData.new_password !== formData.confirm_password) {
      setMessage('Passwords do not match.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      await authApi.resetPassword({
        token,
        new_password: formData.new_password,
        confirm_password: formData.confirm_password,
      })
      setViewState('success')
      setMessage('Your password has been updated. You can now log in with your new credentials.')
    } catch (err: any) {
      setMessage(handleApiError(err, 'Unable to reset password.'))
    } finally {
      setSubmitting(false)
    }
  }

  const renderReadyForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">New Password</label>
        <div className="relative">
          <input
            type={showNew ? 'text' : 'password'}
            className="input-field pr-10"
            value={formData.new_password}
            onChange={(e) => setFormData((prev) => ({ ...prev, new_password: e.target.value }))}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
            onClick={() => setShowNew((prev) => !prev)}
            aria-label={showNew ? 'Hide password' : 'Show password'}
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Confirm Password</label>
        <div className="relative">
          <input
            type={showConfirm ? 'text' : 'password'}
            className="input-field pr-10"
            value={formData.confirm_password}
            onChange={(e) => setFormData((prev) => ({ ...prev, confirm_password: e.target.value }))}
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500"
            onClick={() => setShowConfirm((prev) => !prev)}
            aria-label={showConfirm ? 'Hide password' : 'Show password'}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{message}</div>
      )}

      <button type="submit" className="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Updating password…' : 'Reset Password'}
      </button>
    </form>
  )

  let content: JSX.Element
  if (viewState === 'checking') {
    content = <div className="text-center text-gray-600">Verifying your password reset link…</div>
  } else if (viewState === 'invalid') {
    content = (
      <div className="space-y-4">
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
          {message || 'This password reset link is invalid or has expired.'}
        </div>
        <p className="text-sm text-gray-600 text-center">
          Need a new link?{' '}
          <Link to="/forgot-password" className="text-primary-500 hover:underline">
            Request another password reset
          </Link>
        </p>
      </div>
    )
  } else if (viewState === 'success') {
    content = (
      <div className="space-y-4 text-center">
        <div className="rounded border border-green-200 bg-green-50 text-green-700 px-3 py-2 text-sm">
          {message}
        </div>
        <Link to="/login" className="btn-primary inline-block">
          Go to Login
        </Link>
      </div>
    )
  } else {
    content = renderReadyForm()
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
          Reset Password
        </h2>
        {content}
      </div>
    </div>
  )
}

