import { useEffect, useState } from 'react'
import { Modal } from '@munlink/ui'
import { adminApi, handleApiError, documentsAdminApi, mediaUrl, showToast, auditAdminApi } from '../lib/api'
import { ClipboardList, Hourglass, Cog, CheckCircle, PartyPopper, Smartphone, Package as PackageIcon, Search } from 'lucide-react'

type Status = 'all' | 'pending' | 'processing' | 'ready' | 'completed' | 'picked_up'

export default function Requests() {
  const [statusFilter, setStatusFilter] = useState<Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<{ total_requests: number; pending_requests: number; processing_requests: number; ready_requests: number; completed_requests: number } | null>(null)
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'digital' | 'pickup'>('all')
  const [docTypeModalOpen, setDocTypeModalOpen] = useState(false)
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [loadingDocTypes, setLoadingDocTypes] = useState(false)
  const [editingDocType, setEditingDocType] = useState<any | null>(null)
  const [docTypeSubmitting, setDocTypeSubmitting] = useState(false)
  const [docTypeError, setDocTypeError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await adminApi.getRequests({ page: 1, per_page: 50, status: statusFilter === 'all' ? undefined : statusFilter })
        const list = (res.requests || []) as any[]
        const mapped = list.map((r) => {
          const raw = (r.status || 'pending').toLowerCase()
          const normalized = raw === 'in_progress' ? 'processing' : raw === 'resolved' ? 'ready' : raw === 'closed' ? 'completed' : raw
          let extra: any = undefined
          try {
            const rawNotes = r.additional_notes
            if (rawNotes && typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
              extra = JSON.parse(rawNotes)
            }
          } catch {}
          return {
            id: r.request_number || r.id || 'REQ',
            resident: [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') || 'Unknown',
            document: r.document_type?.name || 'Document',
            purpose: r.purpose || '—',
            details: extra?.text || '',
            civil_status: extra?.civil_status || r.civil_status || '',
            submitted: (r.created_at || '').slice(0, 10),
            status: normalized,
            priority: r.priority || 'normal',
            delivery_method: (r.delivery_method === 'physical' ? 'pickup' : r.delivery_method) || 'digital',
            delivery_address: r.delivery_address || '',
            request_id: r.id,
            document_file: r.document_file,
            resident_input: (r as any).resident_input,
            admin_edited_content: (r as any).admin_edited_content,
            additional_notes: r.additional_notes,
            has_claim_token: !!(r as any).qr_code,
          }
        })
        if (mounted) setRows(mapped)
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [statusFilter])

  // Load header counters from document request stats
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Fetch stats for each status
        const [allRes, pendingRes, processingRes, readyRes, completedRes] = await Promise.allSettled([
          adminApi.getRequests({ page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'pending', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'processing', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'ready', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'completed', page: 1, per_page: 1 }),
        ])
        
        const total = allRes.status === 'fulfilled' ? (allRes.value.pagination?.total || 0) : 0
        const pending = pendingRes.status === 'fulfilled' ? (pendingRes.value.pagination?.total || 0) : 0
        const processing = processingRes.status === 'fulfilled' ? (processingRes.value.pagination?.total || 0) : 0
        const ready = readyRes.status === 'fulfilled' ? (readyRes.value.pagination?.total || 0) : 0
        const completed = completedRes.status === 'fulfilled' ? (completedRes.value.pagination?.total || 0) : 0
        
        if (mounted) setStats({ 
          total_requests: total,
          pending_requests: pending,
          processing_requests: processing,
          ready_requests: ready,
          completed_requests: completed
        })
      } catch {}
    })()
    return () => { mounted = false }
  }, [])

  // Actions
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectForId, setRejectForId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [editFor, setEditFor] = useState<null | { id: number; purpose: string; remarks: string; civil_status: string; age?: string }>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [verifyToken, setVerifyToken] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyRequestId, setVerifyRequestId] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<any | null>(null)
  const [historyFor, setHistoryFor] = useState<number | null>(null)
  const [historyRows, setHistoryRows] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [moreForId, setMoreForId] = useState<number | null>(null)
  const visibleRows = rows.filter((r) => {
    // If Ready filter is active, and delivery filter is 'all', force pickup-only per requirements
    const effectiveDelivery = deliveryFilter === 'all' && statusFilter === 'ready' ? 'pickup' : deliveryFilter
    if (effectiveDelivery !== 'all' && r.delivery_method !== (effectiveDelivery === 'pickup' ? 'pickup' : 'digital')) return false
    return true
  })
  const refresh = async () => {
    try {
      const delivery = deliveryFilter === 'all' ? undefined : deliveryFilter
      const res = await adminApi.getRequests({ page: 1, per_page: 50, status: statusFilter === 'all' ? undefined : statusFilter, delivery })
      const list = (res.requests || []) as any[]
      const mapped = list.map((r) => {
        const raw = (r.status || 'pending').toLowerCase()
        const normalized = raw === 'in_progress' ? 'processing' : raw === 'resolved' ? 'ready' : raw === 'closed' ? 'completed' : raw
        let extra: any = undefined
        try {
          const rawNotes = r.additional_notes
          if (rawNotes && typeof rawNotes === 'string' && rawNotes.trim().startsWith('{')) {
            extra = JSON.parse(rawNotes)
          }
        } catch {}
        return {
          id: r.request_number || r.id || 'REQ',
          resident: [r.user?.first_name, r.user?.last_name].filter(Boolean).join(' ') || 'Unknown',
          document: r.document_type?.name || 'Document',
          purpose: r.purpose || '—',
          details: extra?.text || '',
          civil_status: extra?.civil_status || r.civil_status || '',
          submitted: (r.created_at || '').slice(0, 10),
          status: normalized,
          priority: r.priority || 'normal',
          delivery_method: (r.delivery_method === 'physical' ? 'pickup' : r.delivery_method) || 'digital',
          delivery_address: r.delivery_address || '',
          request_id: r.id,
          document_file: r.document_file,
          resident_input: (r as any).resident_input,
          admin_edited_content: (r as any).admin_edited_content,
          additional_notes: r.additional_notes,
          has_claim_token: !!(r as any).qr_code,
        }
      })
      setRows(mapped)
    } catch (e: any) {
      setError(handleApiError(e))
    }
  }

  const loadDocTypes = async () => {
    setLoadingDocTypes(true)
    try {
      setDocTypeError(null)
      const res = await documentsAdminApi.listTypes()
      const types = (res as any)?.types || (res as any)?.data?.types || []
      setDocTypes(Array.isArray(types) ? types : [])
    } catch (e: any) {
      setDocTypes([])
      setDocTypeError(handleApiError(e))
    } finally {
      setLoadingDocTypes(false)
    }
  }

  const openDocTypeManager = async () => {
    setDocTypeModalOpen(true)
    setEditingDocType(null)
    await loadDocTypes()
  }

  const closeDocTypeManager = () => {
    setDocTypeModalOpen(false)
    setEditingDocType(null)
    setDocTypeError(null)
  }

  const handleSaveDocType = async (formData: any) => {
    try {
      setDocTypeSubmitting(true)
      setDocTypeError(null)
      if (editingDocType && editingDocType.id) {
        await documentsAdminApi.updateType(editingDocType.id, formData)
        showToast('Document type updated', 'success')
      } else {
        await documentsAdminApi.createType(formData)
        showToast('Document type created', 'success')
      }
      await loadDocTypes()
      setEditingDocType(null)
    } catch (e: any) {
      setDocTypeError(handleApiError(e))
    } finally {
      setDocTypeSubmitting(false)
    }
  }

  const handleDeleteDocType = async (id: number) => {
    const confirm = window.confirm('Delete this document type? This cannot be undone.')
    if (!confirm) return
    try {
      setDocTypeSubmitting(true)
      setDocTypeError(null)
      await documentsAdminApi.deleteType(id)
      showToast('Document type deleted', 'success')
      await loadDocTypes()
    } catch (e: any) {
      setDocTypeError(handleApiError(e))
    } finally {
      setDocTypeSubmitting(false)
    }
  }

  

  const handleViewPdf = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      const res = await documentsAdminApi.downloadPdf(row.request_id)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'approved')
      await refresh()
      showToast('Request approved', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleStartProcessing = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'processing')
      await refresh()
      showToast('Started processing', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleGenerateClaim = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.claimToken(row.request_id)
      await refresh()
      showToast('Claim token generated', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // (replaced by handleStartProcessing)

  const handleSetReady = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      const res = await documentsAdminApi.readyForPickup(row.request_id)
      await refresh()
      const claim = (res as any)?.claim || (res as any)?.data?.claim
      if (claim?.code_masked) {
        showToast(`Ready for pickup. Claim code: ${claim.code_masked}`, 'success')
      } else {
        showToast('Request marked as ready for pickup', 'success')
      }
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handlePickedUp = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'picked_up', 'Verified and released to resident')
      await refresh()
      showToast('Marked as picked up', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleComplete = async (row: any) => {
    try {
      setActionLoading(String(row.id))
      await documentsAdminApi.updateStatus(row.request_id, 'completed')
      await refresh()
      showToast('Request completed', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const openReject = (row: any) => {
    setRejectForId(row.request_id)
    setRejectReason('')
  }

  const submitReject = async () => {
    if (!rejectForId) return
    try {
      setActionLoading(String(rejectForId))
      await documentsAdminApi.updateStatus(rejectForId, 'rejected', undefined, rejectReason || 'Request rejected by admin')
      setRejectForId(null)
      setRejectReason('')
      await refresh()
      showToast('Request rejected', 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Document Requests</h1>
        <p className="text-neutral-600">Process and track resident document requests</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-8">
        {[
          { status: 'all', label: 'All Requests', count: stats?.total_requests ?? '—', icon: '📋', color: 'neutral' },
          { status: 'pending', label: 'Pending Review', count: stats?.pending_requests ?? '—', icon: '⏳', color: 'yellow' },
          { status: 'processing', label: 'Processing', count: stats?.processing_requests ?? '—', icon: '⚙️', color: 'ocean' },
          { status: 'ready', label: 'Ready for Pickup', count: stats?.ready_requests ?? '—', icon: '✅', color: 'forest' },
          { status: 'completed', label: 'Completed', count: stats?.completed_requests ?? '—', icon: '🎉', color: 'purple' },
        ].map((item) => (
          <button key={item.status} onClick={() => setStatusFilter(item.status as Status)} className={`text-left p-4 rounded-2xl transition-all ${statusFilter === item.status ? 'bg-white/90 backdrop-blur-xl shadow-xl scale-105 border-2 border-ocean-500' : 'bg-white/70 backdrop-blur-xl border border-white/50 hover:scale-105'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">
                {(() => {
                  const code = String(item.icon)
                  if (code === '📋') return <ClipboardList className="w-6 h-6" aria-hidden="true" />
                  if (code === '⏳') return <Hourglass className="w-6 h-6" aria-hidden="true" />
                  if (code === '⚙️') return <Cog className="w-6 h-6" aria-hidden="true" />
                  if (code === '✅') return <CheckCircle className="w-6 h-6" aria-hidden="true" />
                  if (code === '🎉') return <PartyPopper className="w-6 h-6" aria-hidden="true" />
                  return <ClipboardList className="w-6 h-6" aria-hidden="true" />
                })()}
              </span>
              <span className={`text-2xl font-bold ${statusFilter === item.status ? 'text-ocean-600' : 'text-neutral-900'}`}>{item.count}</span>
            </div>
            <p className="text-sm font-medium text-neutral-700">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-neutral-900">Recent Requests</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              name="deliveryFilter"
              id="requests-delivery-filter"
              aria-label="Filter by delivery method"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as any)}
              className="px-4 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-medium"
            >
              <option value="all">All Delivery Types</option>
              <option value="digital">Digital</option>
              <option value="pickup">Pickup</option>
            </select>
            <button className="px-4 py-2 bg-white border border-neutral-200 hover:border-ocean-500 rounded-lg text-sm font-medium transition-all flex items-center gap-2" onClick={()=> setVerifyOpen(true)}>
              <Search className="w-4 h-4" aria-hidden="true" /> Verify Ticket
            </button>
            <button className="px-4 py-2 bg-white border border-neutral-200 hover:border-ocean-500 rounded-lg text-sm font-medium transition-all" onClick={openDocTypeManager}>
              Manage Document Types
            </button>
            <button className="px-4 py-2 bg-white border border-neutral-200 hover:border-ocean-500 rounded-lg text-sm font-medium transition-all flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/></svg>
              Filter
            </button>
          </div>
        </div>

        {error && <div className="px-6 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">{error}</div>}
        <div className="divide-y divide-neutral-200">
          {loading && (
            <div className="px-6 py-6">
              <div className="h-6 w-40 skeleton rounded mb-4" />
              <div className="space-y-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded" />))}</div>
            </div>
          )}
          {!loading && visibleRows.map((request) => (
            <div key={request.id} id={`req-${request.request_id}`} className="px-6 py-5 hover:bg-ocean-50/30 transition-colors group">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className={`sm:col-span-1 w-1 h-6 sm:h-16 rounded-full ${request.priority === 'urgent' ? 'bg-red-500' : request.priority === 'high' ? 'bg-yellow-500' : 'bg-neutral-300'}`} />
                <div className="sm:col-span-11 grid grid-cols-1 sm:grid-cols-12 gap-4 items-center min-w-0">
                  <div className="sm:col-span-3 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">{request.id}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-neutral-600">{request.document}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${request.delivery_method === 'digital' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {request.delivery_method === 'digital' ? (
                          <>
                            <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Digital</span>
                          </>
                        ) : (
                          <>
                            <PackageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Pickup</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="sm:col-span-2 min-w-0">
                    <p className="text-sm text-neutral-700">{request.resident}</p>
                    <p className="text-xs text-neutral-600">Requester</p>
                  </div>
                  <div className="sm:col-span-3 min-w-0">
                    <p className="text-sm text-neutral-700 truncate">{request.purpose}</p>
                    {(request.civil_status || request.details) && (
                      <p className="text-xs text-neutral-600 truncate">{[request.civil_status, request.details].filter(Boolean).join(' • ')}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <p className="text-sm text-neutral-700">{request.submitted}</p>
                    <p className="text-xs text-neutral-600">Submitted</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : request.status === 'processing' ? 'bg-ocean-100 text-ocean-700' : request.status === 'ready' ? 'bg-forest-100 text-forest-700' : request.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                      {request.status === 'pending' && <Hourglass className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'processing' && <Cog className="w-3.5 h-3.5" aria-hidden="true" />}
                      {request.status === 'ready' && <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                      <span>{request.status === 'picked_up' ? 'Picked Up' : (request.status.charAt(0).toUpperCase() + request.status.slice(1))}</span>
                    </span>
                  </div>
                  <div className="sm:col-span-1 text-left sm:text-right space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:justify-end sm:gap-2 relative">
                    <button
                      className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                      onClick={() => setMoreForId(moreForId===request.request_id?null:request.request_id)}
                    >More</button>
                    {moreForId===request.request_id && (
                      <div className="absolute right-0 top-10 z-10 bg-white border border-neutral-200 rounded-lg shadow-md w-40 py-1">
                        <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={async ()=> {
                          try {
                            setLoadingHistory(true); setHistoryFor(request.request_id); setMoreForId(null)
                            const res = await auditAdminApi.list({ entity_type: 'document_request', entity_id: request.request_id, per_page: 50 })
                            const data: any = (res as any)
                            setHistoryRows(data.logs || data.data?.logs || [])
                          } finally { setLoadingHistory(false) }
                        }}>History</button>
                        {request.document_file && (
                          <button className="block w-full text-left px-3 py-2 text-xs hover:bg-neutral-50" onClick={()=> { setMoreForId(null); handleViewPdf(request) }}>View Document</button>
                        )}
                        <button className="block w-full text-left px-3 py-2 text-xs text-rose-700 hover:bg-rose-50" onClick={()=> { setMoreForId(null); openReject(request) }}>Reject</button>
                      </div>
                    )}
                    {(() => {
                      const hasPdf = !!request.document_file
                      const isPending = request.status === 'pending'
                      const isApproved = request.status === 'approved'
                      const isProcessing = request.status === 'processing'
                      const isReady = request.status === 'ready'
                      const isPickup = request.delivery_method === 'pickup'
                      const hasToken = !!request.has_claim_token

                      if (isPending) {
                        return (
                          <button
                            onClick={() => handleApprove(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Approving…' : 'Approve'}</button>
                        )
                      }

                      if (isApproved) {
                        return (
                          <button
                            onClick={() => handleStartProcessing(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Starting…' : 'Start Processing'}</button>
                        )
                      }

                      if (isProcessing) {
                        if (isPickup) {
                          if (!hasToken) {
                            return (
                              <button
                                onClick={() => handleGenerateClaim(request)}
                                className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                                disabled={actionLoading === String(request.id)}
                              >{actionLoading === String(request.id) ? 'Generating…' : 'Generate Claim Token'}</button>
                            )
                          }
                          return (
                            <button
                              onClick={() => handleSetReady(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Updating…' : 'Mark Ready for Pickup'}</button>
                          )
                        }
                        if (!hasPdf) {
                          return (
                            <button
                              onClick={() => {
                                const edited = (request as any).admin_edited_content || {}
                                const resident = (request as any).resident_input || {}
                                const legacyNotes = (request as any).additional_notes
                                let remarks = ''
                                if (edited && edited.remarks) remarks = edited.remarks
                                else if (resident && resident.remarks) remarks = resident.remarks
                                else if (typeof legacyNotes === 'string') remarks = legacyNotes
                                const ageVal = (edited?.age ?? resident?.age)
                                setEditFor({ id: request.request_id, purpose: (edited?.purpose || request.purpose || ''), remarks: remarks || '', civil_status: (edited?.civil_status || request.civil_status || ''), age: (ageVal !== undefined && ageVal !== null) ? String(ageVal) : '' })
                              }}
                              className="w-full sm:w-auto px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                            >Edit / Generate PDF</button>
                          )
                        }
                        return (
                          <button
                            onClick={() => handleComplete(request)}
                            className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                            disabled={actionLoading === String(request.id)}
                          >{actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}</button>
                        )
                      }

                      if (isReady) {
                        if (isPickup) {
                          return (
                            <button
                              onClick={() => handlePickedUp(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Saving…' : 'Mark Picked Up'}</button>
                          )
                        }
                        return (
                          <>
                            <button
                              onClick={() => handleComplete(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}</button>
                            <button
                              onClick={() => handleViewPdf(request)}
                              className="w-full sm:w-auto px-3 py-2 bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-60"
                              disabled={actionLoading === String(request.id)}
                            >{actionLoading === String(request.id) ? 'Opening…' : 'View Document'}</button>
                          </>
                        )
                      }

                      return null
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Modal open={docTypeModalOpen} onOpenChange={(o) => { if (!o) closeDocTypeManager() }} title="Manage Document Types">
        <div className="space-y-4">
          {docTypeError && (
            <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2">{docTypeError}</div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">Existing Types</h3>
            <button
              className="px-3 py-1.5 rounded bg-ocean-600 hover:bg-ocean-700 text-white text-sm font-medium"
              onClick={() => setEditingDocType({ id: null, name: '', code: '', authority_level: 'municipal', description: '', fee: 0, processing_days: 3, supports_physical: true, supports_digital: true, is_active: true, requirements: [] })}
              disabled={docTypeSubmitting}
            >New Type</button>
          </div>
          {loadingDocTypes ? (
            <div className="text-sm text-neutral-600">Loading…</div>
          ) : docTypes.length === 0 ? (
            <div className="text-sm text-neutral-600">No document types yet.</div>
          ) : (
            <div className="space-y-2">
              {docTypes.map((t: any) => (
                <div key={t.id} className="border border-neutral-200 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900 truncate">{t.name}</div>
                    <div className="text-xs text-neutral-500 uppercase">{t.authority_level}</div>
                    <div className="text-xs text-neutral-600">Processing: {t.processing_days} day(s) • Fee: ₱{Number(t.fee || 0).toFixed(2)}</div>
                    {Array.isArray(t.requirements) && t.requirements.length > 0 && (
                      <div className="mt-1 text-xs text-neutral-600">Requirements: {t.requirements.join(', ')}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2.5 py-1 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs"
                      onClick={() => setEditingDocType({ ...t })}
                      disabled={docTypeSubmitting}
                    >Edit</button>
                    <button
                      className="px-2.5 py-1 rounded bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs"
                      onClick={() => handleDeleteDocType(t.id)}
                      disabled={docTypeSubmitting}
                    >Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {editingDocType !== null && (
            <div className="border-t border-neutral-200 pt-4 mt-4">
              <DocumentTypeForm
                key={editingDocType?.id ?? 'new'}
                initial={editingDocType}
                submitting={docTypeSubmitting}
                onCancel={() => setEditingDocType(null)}
                onSubmit={handleSaveDocType}
              />
            </div>
          )}
        </div>
      </Modal>
      {/* Verify Ticket Modal */}
      {verifyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onKeyDown={(e)=>{ if (e.key==='Escape') setVerifyOpen(false)}}>
          <div className="absolute inset-0 bg-black/40" onClick={()=> setVerifyOpen(false)} />
          <div className="relative bg-white w-[92%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Verify Claim Ticket</h3>
            <p className="text-sm text-neutral-600 mb-3">Paste the token from the QR, or enter the fallback code and request ID.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Token (preferred)</label>
                <input className="w-full border rounded px-3 py-2 text-sm" value={verifyToken} onChange={(e)=> setVerifyToken(e.target.value)} placeholder="Paste token here" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Fallback Code</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={verifyCode} onChange={(e)=> setVerifyCode(e.target.value)} placeholder="XXXX-XXXX" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Request ID</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={verifyRequestId} onChange={(e)=> setVerifyRequestId(e.target.value)} placeholder="e.g., 123" />
                </div>
              </div>
            </div>
            {verifyResult && (
              <div className="mt-4 p-3 rounded-lg bg-neutral-50 border text-sm">
                <div className="font-medium mb-1">Match found</div>
                <div>Request ID: <span className="font-mono">{verifyResult.id}</span></div>
                <div>Request No.: <span className="font-mono">{verifyResult.request_number}</span></div>
                <div>Resident: {verifyResult.resident}</div>
                <div>Document: {verifyResult.document}</div>
                <div>Status: <span className="capitalize">{verifyResult.status}</span></div>
              </div>
            )}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={()=> setVerifyOpen(false)}>Close</button>
              <button
                className="px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60"
                disabled={verifying || (!verifyToken && (!verifyCode || !verifyRequestId))}
                onClick={async ()=>{
                  try {
                    setVerifying(true)
                    const payload: any = {}
                    if (verifyToken) payload.token = verifyToken
                    if (!verifyToken) { payload.code = verifyCode; payload.request_id = Number(verifyRequestId) }
                    const res = await documentsAdminApi.verifyClaim(payload)
                    const ok = (res as any)?.ok || (res as any)?.data?.ok
                    if (ok) {
                      const request = (res as any)?.request || (res as any)?.data?.request
                      setVerifyResult(request)
                      showToast('Ticket verified', 'success')
                    } else {
                      showToast('Verification failed', 'error')
                    }
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setVerifying(false)
                  }
                }}
              >{verifying ? 'Verifying…' : 'Verify'}</button>
              {verifyResult && (
                <button
                  className="px-4 py-2 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-sm"
                  onClick={() => {
                    try {
                      const status = String(verifyResult.status || '').toLowerCase()
                      const normalized = status === 'in_progress' ? 'processing' : status === 'resolved' ? 'ready' : status === 'closed' ? 'completed' : status
                      setStatusFilter((normalized === 'pending' || normalized === 'processing' || normalized === 'ready' || normalized === 'completed') ? normalized as any : 'all')
                      setVerifyOpen(false)
                      setTimeout(() => {
                        const el = document.getElementById(`req-${verifyResult.id}`) || document.getElementById(`req-${verifyResult.request_id}`)
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      }, 350)
                    } catch {}
                  }}
                >Locate in list</button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Reject Modal */}
      {rejectForId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setRejectForId(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setRejectForId(null)} />
          <div className="relative bg-white w-[92%] max-w-md max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 pb-24 sm:pb-5" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Reject Request</h3>
            <p className="text-sm text-neutral-700 mb-3">Provide a reason to inform the resident.</p>
            <label htmlFor="reject-reason" className="block text-sm font-medium mb-1">Reason</label>
            <textarea id="reject-reason" name="reject_reason" className="w-full border border-neutral-300 rounded-md p-2 text-sm" rows={4} value={rejectReason} onChange={(e)=> setRejectReason(e.target.value)} placeholder="e.g., Missing required details" />
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setRejectForId(null)}>Cancel</button>
              <button className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm disabled:opacity-60" disabled={!rejectReason || actionLoading===String(rejectForId)} onClick={submitReject}>
                {actionLoading===String(rejectForId) ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Edit Content Modal */}
      {editFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setEditFor(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditFor(null)} />
          <div className="relative bg-white w-[92%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5 pb-24 sm:pb-5" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Edit Request Content</h3>
            <div className="space-y-3">
              <div>
                <label htmlFor="edit-purpose" className="block text-sm font-medium mb-1">Purpose</label>
                <input id="edit-purpose" name="edit_purpose" className="w-full border border-neutral-300 rounded-md p-2 text-sm" value={editFor.purpose} onChange={(e)=> setEditFor({ ...editFor, purpose: e.target.value })} />
              </div>
              <div>
                <label htmlFor="edit-remarks" className="block text-sm font-medium mb-1">Remarks or Additional Information</label>
                <textarea id="edit-remarks" name="edit_remarks" className="w-full border border-neutral-300 rounded-md p-2 text-sm" rows={4} value={editFor.remarks} onChange={(e)=> setEditFor({ ...editFor, remarks: e.target.value })} placeholder="Provide extra context or clarifications" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Civil Status / Age (optional)</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input id="edit-civil" name="edit_civil_status" className="w-full border border-neutral-300 rounded-md p-2 text-sm" value={editFor.civil_status} onChange={(e)=> setEditFor({ ...editFor, civil_status: e.target.value })} placeholder="e.g., single" />
                  <input id="edit-age" name="edit_age" className="w-full border border-neutral-300 rounded-md p-2 text-sm" type="number" min={0} value={editFor.age || ''} onChange={(e)=> setEditFor({ ...editFor, age: e.target.value })} placeholder="Age e.g., 22" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={() => setEditFor(null)}>Cancel</button>
              <button
                className="px-4 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60"
                disabled={savingEdit}
                onClick={async () => {
                  try {
                    setSavingEdit(true)
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    await refresh()
                    setEditFor(null)
                    showToast('Content saved', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEdit(false)
                  }
                }}
              >{savingEdit ? 'Saving…' : 'Save'}</button>
              <button
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-60"
                disabled={savingEdit}
                onClick={async () => {
                  try {
                    setSavingEdit(true)
                    await documentsAdminApi.updateContent(editFor.id, { purpose: editFor.purpose || undefined, remarks: editFor.remarks || undefined, civil_status: editFor.civil_status || undefined, age: (editFor.age && !Number.isNaN(Number(editFor.age))) ? Number(editFor.age) : undefined })
                    const res = await documentsAdminApi.generatePdf(editFor.id)
                    await refresh()
                    const url = (res as any)?.url || (res as any)?.data?.url
                    if (url) {
                      window.open(mediaUrl(url), '_blank')
                    }
                    setEditFor(null)
                    showToast('Saved and generated', 'success')
                  } catch (e: any) {
                    showToast(handleApiError(e), 'error')
                  } finally {
                    setSavingEdit(false)
                  }
                }}
              >{savingEdit ? 'Working…' : 'Save & Generate'}</button>
            </div>
          </div>
        </div>
      )}
      {/* History Modal */}
      {historyFor !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true" onKeyDown={(e)=> { if (e.key==='Escape') setHistoryFor(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={()=> setHistoryFor(null)} />
          <div className="relative bg-white w-[92%] max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-xl border p-5" tabIndex={-1} autoFocus>
            <h3 className="text-lg font-semibold mb-2">Request History</h3>
            <div className="text-sm text-neutral-600 mb-3">Request ID: {historyFor}</div>
            {loadingHistory ? (
              <div className="text-sm">Loading…</div>
            ) : historyRows.length === 0 ? (
              <div className="text-sm text-neutral-600">No entries.</div>
            ) : (
              <div className="space-y-2 text-sm">
                {historyRows.map((l, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-neutral-500 min-w-[11ch]">{String(l.created_at||'').replace('T',' ').slice(0,19)}</span>
                    <span className="capitalize">{String(l.action||'').replace(/_/g,' ')}</span>
                    <span className="text-neutral-600">{l.actor_role||'admin'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-end">
              <button className="px-4 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-sm" onClick={()=> setHistoryFor(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



type DocumentTypeFormProps = {
  initial: any
  submitting: boolean
  onSubmit: (payload: any) => void
  onCancel: () => void
}

function DocumentTypeForm({ initial, submitting, onSubmit, onCancel }: DocumentTypeFormProps) {
  const defaults = {
    name: '',
    code: '',
    authority_level: 'municipal',
    description: '',
    fee: 0,
    processing_days: 3,
    supports_physical: true,
    supports_digital: true,
    is_active: true,
    requirements: [],
  }

  const initialData = { ...defaults, ...(initial || {}) }
  const [form, setForm] = useState<any>(initialData)
  const initialRequirements = Array.isArray(initialData.requirements) && initialData.requirements.length > 0
    ? initialData.requirements.slice(0, 5)
    : ['']
  const [requirements, setRequirements] = useState<string[]>(initialRequirements)

  const updateRequirement = (index: number, value: string) => {
    setRequirements((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const addRequirement = () => {
    setRequirements((prev) => (prev.length >= 5 ? prev : [...prev, '']))
  }

  const removeRequirement = (index: number) => {
    setRequirements((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [''] : next
    })
  }

  const disabled = !(form.name && form.code)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (disabled || submitting) return
        const payload = {
          name: String(form.name || '').trim(),
          code: String(form.code || '').trim(),
          authority_level: String(form.authority_level || 'municipal').toLowerCase(),
          description: form.description || '',
          fee: form.fee === '' ? 0 : Number(form.fee),
          processing_days: form.processing_days === '' ? 3 : Number(form.processing_days),
          supports_physical: !!form.supports_physical,
          supports_digital: !!form.supports_digital,
          is_active: !!form.is_active,
          requirements: requirements.map((r) => String(r || '').trim()).filter(Boolean),
        }
        onSubmit(payload)
      }}
      className="space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((prev: any) => ({ ...prev, name: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Code</label>
          <input
            value={form.code}
            onChange={(e) => setForm((prev: any) => ({ ...prev, code: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Authority Level</label>
          <select
            value={form.authority_level}
            onChange={(e) => setForm((prev: any) => ({ ...prev, authority_level: e.target.value }))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="municipal">Municipal</option>
            <option value="barangay">Barangay</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Processing Days</label>
          <input
            type="number"
            min={1}
            value={form.processing_days}
            onChange={(e) => setForm((prev: any) => ({ ...prev, processing_days: e.target.value === '' ? '' : Number(e.target.value) }))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev: any) => ({ ...prev, description: e.target.value }))}
          className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          rows={3}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1">Fee (₱)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.fee}
            onChange={(e) => setForm((prev: any) => ({ ...prev, fee: e.target.value === '' ? '' : Number(e.target.value) }))}
            className="w-full border border-neutral-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.supports_physical}
            onChange={(e) => setForm((prev: any) => ({ ...prev, supports_physical: e.target.checked }))}
          />
          Supports Physical/Pickup
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.supports_digital}
            onChange={(e) => setForm((prev: any) => ({ ...prev, supports_digital: e.target.checked }))}
          />
          Supports Digital
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={form.is_active}
          onChange={(e) => setForm((prev: any) => ({ ...prev, is_active: e.target.checked }))}
        />
        Active
      </label>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-neutral-700">Requirements (max 5)</label>
          <button type="button" className="px-2 py-1 text-xs bg-neutral-100 rounded hover:bg-neutral-200" onClick={addRequirement} disabled={requirements.length >= 5}>Add</button>
        </div>
        <div className="space-y-2">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={req}
                onChange={(e) => updateRequirement(index, e.target.value)}
                className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
                placeholder="Requirement description"
              />
              <button
                type="button"
                className="px-2 py-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 rounded"
                onClick={() => removeRequirement(index)}
                disabled={requirements.length <= 1 && !requirements[index]}
              >Remove</button>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <button type="button" className="px-3 py-1.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-sm" onClick={onCancel}>Cancel</button>
        <button type="submit" className="px-3 py-1.5 rounded bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60" disabled={disabled || submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

