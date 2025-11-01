import { useEffect, useState } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api, { authApi, getAccessToken, handleApiError } from '@/lib/api'
import { useAppStore } from '@/lib/store'

export default function VerifyEmailPage() {
  const location = useLocation()
  const setAuth = useAppStore((s) => s.setAuth)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState<string>('')
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [resendMessage, setResendMessage] = useState<string>('')
  const [emailInput, setEmailInput] = useState<string>('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const token = params.get('token')
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token. Please open the link from your email or resend a new link below.')
      return
    }

    const doVerify = async () => {
      setStatus('verifying')
      try {
        const res = await api.get(`/api/auth/verify-email/${encodeURIComponent(token)}`)
        setStatus('success')
        setMessage(res.data?.message || 'Email verified successfully')
        // Optionally refresh profile if already logged in
        try {
          const resp = await api.get('/api/auth/profile')
          const { id, username, role, email_verified, admin_verified, profile_picture } = resp.data || {}
          if (id) {
            setAuth({ id, username, role, email_verified, admin_verified, profile_picture } as any, getAccessToken() || '', '')
          }
        } catch {}
      } catch (err: any) {
        setStatus('error')
        setMessage(handleApiError(err, 'Email verification failed'))
      }
    }

    doVerify()
  }, [location.search])

  return (
    <div className="min-h-[calc(100vh-200px)] py-12 px-4">
      <div className="card max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-4">Verify Email</h1>
        {status === 'verifying' && <p>Verifying your email...</p>}
        {status !== 'verifying' && (
          <>
            <p className={status === 'error' ? 'text-red-600' : 'text-green-700'}>{message}</p>
            {status === 'error' && (
              <div className="mt-4">
                {!isAuthenticated && (
                  <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input
                      type="email"
                      className="input-field"
                      placeholder="your.email@example.com"
                      value={emailInput}
                      autoComplete="email"
                      onChange={(e) => setEmailInput(e.target.value)}
                    />
                  </div>
                )}
                <button
                  onClick={async () => {
                    setResendStatus('sending')
                    setResendMessage('')
                    try {
                      let res
                      if (isAuthenticated) {
                        res = await authApi.resendVerification()
                      } else {
                        if (!emailInput) throw new Error('Enter your email to resend the link')
                        res = await authApi.resendVerificationPublic(emailInput)
                      }
                      setResendStatus('sent')
                      setResendMessage(res.data?.message || 'Verification email sent')
                      const link = (res?.data as any)?.verify_link
                      if (link) {
                        // In DEBUG builds, the backend returns a direct link for local testing
                        window.location.href = link
                      }
                    } catch (err: any) {
                      const msg = err?.response?.data?.error || err?.message || 'Failed to resend verification email'
                      setResendStatus('error')
                      setResendMessage(msg)
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700 disabled:opacity-60"
                  disabled={resendStatus === 'sending'}
                >
                  {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                </button>
                {!!resendMessage && (
                  <p className={resendStatus === 'error' ? 'text-red-600' : 'text-green-700'}>
                    {resendMessage}
                  </p>
                )}
              </div>
            )}
            {status === 'success' && (
              <div className="mt-4 text-sm text-gray-600 space-y-2">
                <p>Your account is now email-verified. Please upload your government ID for admin review to unlock all features.</p>
                <div>
                  <Link to="/login" className="text-primary-600 hover:underline">Return to login</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


