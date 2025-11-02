import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authApi, handleApiError, showToast } from '@/lib/api'
import { useAppStore } from '@/lib/store'

type ReviewState = {
  status: string
  notes: string
  updated_at?: string
}

export default function ResolveReviewPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [review, setReview] = useState<ReviewState>({ status: '', notes: '' })

  const hydrateStore = (profile: any) => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('munlink:user', JSON.stringify(profile)) } catch {}
    }
    useAppStore.setState({
      user: profile,
      emailVerified: !!profile?.email_verified,
      adminVerified: !!profile?.admin_verified,
      verificationStatus: profile?.verification_status,
      verificationNotes: profile?.verification_notes,
    })
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const resp = await authApi.getProfile()
        const data = (resp as any)?.data || resp
        if (!cancelled && data) {
          hydrateStore(data)
          setReview({
            status: (data.verification_status || '').toLowerCase(),
            notes: data.verification_notes || '',
            updated_at: data.updated_at,
          })
        }
      } catch (err) {
        if (!cancelled) setError(handleApiError(err, 'Unable to load account status'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleResubmit = async () => {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      const resp = await authApi.resubmitVerification()
      const data = resp?.data || resp
      setOk(data?.message || 'Profile resubmitted for review')
      showToast(data?.message || 'Profile resubmitted for review', 'success')
      const profileResp = await authApi.getProfile()
      const profile = (profileResp as any)?.data || profileResp
      hydrateStore(profile)
      setReview({
        status: (profile.verification_status || '').toLowerCase(),
        notes: profile.verification_notes || '',
        updated_at: profile.updated_at,
      })
    } catch (err) {
      const msg = handleApiError(err, 'Failed to resubmit profile')
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setSaving(false)
    }
  }

  const statusLabel = (() => {
    switch (review.status) {
      case 'needs_revision':
        return 'Needs Updates'
      case 'pending':
        return 'Pending Review'
      case 'verified':
        return 'Verified'
      default:
        return review.status ? review.status.replace(/_/g, ' ') : 'Unknown'
    }
  })()

  return (
    <div className="container-responsive py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <button type="button" className="text-sm text-ocean-700 hover:text-ocean-800" onClick={() => navigate(-1)}>&larr; Back</button>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-white/60 p-6">
          <h1 className="text-2xl font-serif font-semibold mb-2">Resolve Review Feedback</h1>
          <p className="text-sm text-gray-600">
            Review the feedback from your municipal administrator, update your profile or documents, and resubmit your account for approval.
          </p>
          <div className="mt-6 grid gap-4">
            <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50">
              <div className="text-xs uppercase font-semibold text-neutral-500 mb-1">Current status</div>
              <div className="text-lg font-semibold text-neutral-900">{statusLabel}</div>
              {review.updated_at && (
                <div className="text-xs text-neutral-500 mt-1">Updated {new Date(review.updated_at).toLocaleString()}</div>
              )}
            </div>
            {review.notes ? (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                <div className="text-xs uppercase font-semibold text-amber-600 mb-1">Administrator feedback</div>
                <div className="text-sm text-amber-900 whitespace-pre-line">{review.notes}</div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-neutral-200 bg-neutral-50 text-sm text-neutral-700">
                No specific feedback was provided. Please double-check your profile details and documents before resubmitting.
              </div>
            )}
          </div>

          <div className="mt-6 space-y-3 text-sm text-neutral-700">
            <div className="font-medium">Next steps</div>
            <ol className="list-decimal list-inside space-y-2">
              <li>Update your personal details on the <Link to="/profile" className="text-ocean-600 hover:underline">Profile</Link> page if necessary.</li>
              <li>Upload refreshed ID or proof documents via the <Link to="/upload-id" className="text-ocean-600 hover:underline">Upload ID</Link> page.</li>
              <li>Return here and click <em>Resubmit for Review</em> to notify your administrator.</li>
            </ol>
          </div>

          {error && <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm">{error}</div>}
          {ok && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-3 py-2 text-sm">{ok}</div>}

          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-neutral-500">
              Need assistance? Contact your municipal administrator for clarification.
            </div>
            <div className="flex items-center gap-2">
              <Link to="/profile" className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100">Edit Profile</Link>
              <Link to="/upload-id" className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 hover:bg-neutral-100">Upload Documents</Link>
              <button
                onClick={handleResubmit}
                disabled={saving || loading}
                className="px-4 py-2 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? 'Submitting…' : 'Resubmit for Review'}
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-sm text-neutral-500">Loading account details…</div>}
      </div>
    </div>
  )
}


