import { StatusBadge } from '@munlink/ui'
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { documentsApi, mediaUrl } from '@/lib/api'
import ClaimTicketModal from '@/components/ClaimTicketModal'

export default function DocumentRequestPage() {
  const { id } = useParams()
  const [loading, setLoading] = useState(true)
  const [req, setReq] = useState<any>(null)
  const [claimOpen, setClaimOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await documentsApi.getRequest(Number(id))
        if (!cancelled) setReq(res.data?.request || res.data)
      } catch {
        if (!cancelled) setReq(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [id])

  // Auto-refresh while processing to surface readiness quickly
  useEffect(() => {
    if (!req) return
    if (req.status !== 'processing') return
    let cancelled = false
    const interval = setInterval(async () => {
      try {
        const res = await documentsApi.getRequest(Number(id))
        const next = res.data?.request || res.data
        if (!cancelled && next) setReq(next)
        if ((next?.status || '').toLowerCase() !== 'processing') {
          clearInterval(interval)
        }
      } catch {}
    }, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [req?.status, id])

  return (
    <div className="container-responsive py-12">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/dashboard" className="text-blue-700 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Back to Dashboard</span>
        </Link>
      </div>
      {loading ? (
        <div className="skeleton-card p-6">
          <div className="h-6 w-1/3 skeleton mb-3" />
          <div className="h-4 w-1/2 skeleton" />
        </div>
      ) : req ? (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{req.document_type?.name || 'Document Request'}</h1>
              <div className="text-sm text-gray-600">Request No.: {req.request_number}</div>
            </div>
            <StatusBadge status={req.status} />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><span className="font-medium">Delivery:</span> {(req.delivery_method === 'physical' ? 'pickup' : req.delivery_method)}{req.delivery_address?` • ${req.delivery_address}`:''}</div>
            <div><span className="font-medium">Purpose:</span> {req.purpose}</div>
            {req.additional_notes && <div className="sm:col-span-2"><span className="font-medium">Remarks:</span> {req.additional_notes}</div>}
          </div>
          {req.status === 'processing' && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
              Your digital document is being generated. This page will refresh automatically.
            </div>
          )}
          {req.status === 'rejected' && (req.rejection_reason || req.admin_notes) && (
            <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="font-medium">Rejected</div>
              <div>{req.rejection_reason || req.admin_notes}</div>
            </div>
          )}
          {(req.status === 'ready' || req.status === 'completed') && req.document_file && (
            <div className="mt-6">
              <a
                href={mediaUrl(req.document_file)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium"
              >
                {String(req.document_file).toLowerCase().endsWith('.pdf') ? 'View PDF' : 'Download Document'}
              </a>
              <div className="text-xs text-gray-600 mt-2">This link opens your generated document. Keep it safe.</div>
            </div>
          )}
          {(() => {
            const statusLower = String(req.status || '').toLowerCase()
            const deliveryLower = String(req.delivery_method || '').toLowerCase()
            const canViewTicket = deliveryLower !== 'digital' && ['ready', 'picked_up', 'completed'].includes(statusLower)
            if (!canViewTicket) return null
            return (
              <div className="mt-6">
                <button
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setClaimOpen(true)}
                >
                  View Pickup Ticket
                </button>
                <div className="text-xs text-gray-600 mt-2">Show this ticket or QR code at the pickup counter.</div>
              </div>
            )
          })()}
        </div>
      ) : (
        <div className="text-gray-600">Request not found.</div>
      )}
      <ClaimTicketModal
        requestId={Number(id)}
        isOpen={claimOpen}
        onClose={() => setClaimOpen(false)}
      />
    </div>
  )
}


