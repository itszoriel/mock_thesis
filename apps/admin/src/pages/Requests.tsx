import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Modal } from '@munlink/ui'
import { adminApi, handleApiError, documentsAdminApi, mediaUrl, showToast, auditAdminApi } from '../lib/api'
import { ClipboardList, Hourglass, Cog, CheckCircle, PartyPopper, Smartphone, Package as PackageIcon, Search } from 'lucide-react'
import { AdminPageShell, AdminPageHeader, AdminSection } from '../components/layout/Page'

type Status = 'all' | 'pending' | 'processing' | 'ready' | 'completed' | 'picked_up'

export default function Requests() {
  const [statusFilter, setStatusFilter] = useState<Status>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<{ total_requests: number; pending_requests: number; processing_requests: number; ready_requests: number; completed_requests: number; picked_up_requests?: number } | null>(null)
  const [deliveryFilter, setDeliveryFilter] = useState<'all' | 'digital' | 'pickup'>('all')
  const [docTypeModalOpen, setDocTypeModalOpen] = useState(false)
  const [docTypes, setDocTypes] = useState<any[]>([])
  const [loadingDocTypes, setLoadingDocTypes] = useState(false)
  const [editingDocType, setEditingDocType] = useState<any | null>(null)
  const [docTypeSubmitting, setDocTypeSubmitting] = useState(false)
  const [docTypeError, setDocTypeError] = useState<string | null>(null)
  const [claimTokens, setClaimTokens] = useState<Record<string, { token?: string; code?: string }>>({})
  const claimTokensRef = useRef<Record<string, { token?: string; code?: string }>>({})

  useEffect(() => {
    claimTokensRef.current = claimTokens
  }, [claimTokens])

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
          const qrCodePath = r.qr_code || (r.claim?.qr_path) || null
          const qrUrl = qrCodePath ? mediaUrl(qrCodePath) : null
          const rowKey = String(r.id ?? r.request_number ?? '')
          const storedClaim = claimTokensRef.current[rowKey] || {}
          const ticketToken = storedClaim.token || (r.qr_data?.token)
          const ticketLink = ticketToken ? `/verify-ticket?token=${encodeURIComponent(ticketToken)}` : null
          const claimCodeMasked = storedClaim.code || (r.qr_data?.code_masked)
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
            has_claim_token: !!((r as any).qr_code || ticketToken),
            qr_code: qrCodePath,
            qr_url: qrUrl,
            ticket_token: ticketToken || null,
            ticket_link: ticketLink,
            claim_code_masked: claimCodeMasked || null,
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
        const [allRes, pendingRes, processingRes, readyRes, completedRes, pickedUpRes] = await Promise.allSettled([
          adminApi.getRequests({ page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'pending', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'processing', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'ready', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'completed', page: 1, per_page: 1 }),
          adminApi.getRequests({ status: 'picked_up', page: 1, per_page: 1 }),
        ])
        
        const total = allRes.status === 'fulfilled' ? (allRes.value.pagination?.total || 0) : 0
        const pending = pendingRes.status === 'fulfilled' ? (pendingRes.value.pagination?.total || 0) : 0
        const processing = processingRes.status === 'fulfilled' ? (processingRes.value.pagination?.total || 0) : 0
        const ready = readyRes.status === 'fulfilled' ? (readyRes.value.pagination?.total || 0) : 0
        const completed = completedRes.status === 'fulfilled' ? (completedRes.value.pagination?.total || 0) : 0
        const pickedUp = pickedUpRes.status === 'fulfilled' ? (pickedUpRes.value.pagination?.total || 0) : 0
        
        if (mounted) setStats({ 
          total_requests: total,
          pending_requests: pending,
          processing_requests: processing,
          ready_requests: ready,
          completed_requests: completed + pickedUp,
          picked_up_requests: pickedUp,
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
    const effectiveDelivery = deliveryFilter
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
        const qrCodePath = r.qr_code || (r.claim?.qr_path) || null
        const qrUrl = qrCodePath ? mediaUrl(qrCodePath) : null
        const rowKey = String(r.id ?? r.request_number ?? '')
        const storedClaim = claimTokensRef.current[rowKey] || {}
        const ticketToken = storedClaim.token || (r.qr_data?.token)
        const ticketLink = ticketToken ? `/verify-ticket?token=${encodeURIComponent(ticketToken)}` : null
        const claimCodeMasked = storedClaim.code || (r.qr_data?.code_masked)
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
          has_claim_token: !!((r as any).qr_code || ticketToken),
          qr_code: qrCodePath,
          qr_url: qrUrl,
          ticket_token: ticketToken || null,
          ticket_link: ticketLink,
          claim_code_masked: claimCodeMasked || null,
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
      const res = await documentsAdminApi.claimToken(row.request_id)
      const data: any = res as any
      const claim = data?.claim || data?.data?.claim
      const updatedRequest = data?.request || data?.data?.request
      if (claim?.token) {
        const key = String(row.id)
        setClaimTokens((prev) => {
          const previous = prev[key] || {}
          if (previous.token === claim.token && previous.code === claim.code_masked) return prev
          return {
            ...prev,
            [key]: {
              token: claim.token,
              code: claim.code_masked ?? previous.code,
            },
          }
        })
        claimTokensRef.current = {
          ...claimTokensRef.current,
          [key]: {
            token: claim.token,
            code: claim.code_masked ?? claimTokensRef.current[key]?.code,
          },
        }
      }
      setRows((prev) => prev.map((r) => {
        if (String(r.id) !== String(row.id)) return r
        const qrPath = updatedRequest?.qr_code || r.qr_code
        const qrUrl = claim?.qr_path ? mediaUrl(claim.qr_path) : qrPath ? mediaUrl(qrPath) : r.qr_url
        return {
          ...r,
          has_claim_token: !!(qrPath || claim?.qr_path || r.has_claim_token),
          qr_code: qrPath,
          qr_url: qrUrl,
          ticket_token: claim?.token || r.ticket_token,
          ticket_link: claim?.token ? `/verify-ticket?token=${encodeURIComponent(claim.token)}` : r.ticket_link,
          claim_code_masked: claim?.code_masked || r.claim_code_masked,
        }
      }))
      await refresh()
      showToast(claim?.code_masked ? `Claim token generated. Code: ${claim.code_masked}` : 'Claim token generated', 'success')
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
      const data: any = res as any
      const claim = data?.claim || data?.data?.claim
      const updatedRequest = data?.request || data?.data?.request
      if (claim?.token) {
        const key = String(row.id)
        setClaimTokens((prev) => {
          const previous = prev[key] || {}
          if (previous.token === claim.token && previous.code === claim.code_masked) return prev
          return {
            ...prev,
            [key]: {
              token: claim.token,
              code: claim.code_masked ?? previous.code,
            },
          }
        })
        claimTokensRef.current = {
          ...claimTokensRef.current,
          [key]: {
            token: claim.token,
            code: claim.code_masked ?? claimTokensRef.current[key]?.code,
          },
        }
      }
      setRows((prev) => prev.map((r) => {
        if (String(r.id) !== String(row.id)) return r
        const qrPath = updatedRequest?.qr_code || r.qr_code
        const qrUrl = claim?.qr_path ? mediaUrl(claim.qr_path) : qrPath ? mediaUrl(qrPath) : r.qr_url
        return {
          ...r,
          status: 'ready',
          has_claim_token: !!(qrPath || claim?.qr_path || r.has_claim_token),
          qr_code: qrPath,
          qr_url: qrUrl,
          ticket_token: claim?.token || r.ticket_token,
          ticket_link: claim?.token ? `/verify-ticket?token=${encodeURIComponent(claim.token)}` : r.ticket_link,
          claim_code_masked: claim?.code_masked || r.claim_code_masked,
        }
      }))
      await refresh()
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

  const handleViewTicket = async (row: any) => {
    if (row.delivery_method === 'digital') {
      return handleViewPdf(row)
    }
    const stored = claimTokensRef.current[String(row.id)] || {}
    const token = stored.token || row.ticket_token
    if (token) {
      window.open(`/verify-ticket?token=${encodeURIComponent(token)}`, '_blank', 'noopener')
      return
    }
    if (row.ticket_link) {
      window.open(row.ticket_link, '_blank', 'noopener')
      return
    }
    if (row.qr_url) {
      window.open(row.qr_url, '_blank', 'noopener')
      return
    }
    if (row.qr_code) {
      window.open(mediaUrl(row.qr_code), '_blank', 'noopener')
      return
    }
    showToast('No ticket available yet. Generate a claim token first.', 'info')
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
    <AdminPageShell>
      <AdminPageHeader
        overline="Admin • Services"
        title="Document Requests"
        description="Process and track resident document requests across every status."
        stats={[
          { label: 'Total Requests', value: stats?.total_requests ?? '—' },
          { label: 'Pending', value: stats?.pending_requests ?? '—' },
          { label: 'Processing', value: stats?.processing_requests ?? '—' },
          { label: 'Ready', value: stats?.ready_requests ?? '—' },
          { label: 'Completed', value: stats?.completed_requests ?? '—' },
        ]}
      />

      <AdminSection padding="sm" borderlessHeader>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {[
            { status: 'all', label: 'All Requests', count: stats?.total_requests ?? '—', icon: ClipboardList },
            { status: 'pending', label: 'Pending Review', count: stats?.pending_requests ?? '—', icon: Hourglass },
            { status: 'processing', label: 'Processing', count: stats?.processing_requests ?? '—', icon: Cog },
            { status: 'ready', label: 'Ready for Pickup', count: stats?.ready_requests ?? '—', icon: CheckCircle },
            { status: 'completed', label: 'Completed', count: stats?.completed_requests ?? '—', icon: PartyPopper },
          ].map((item) => {
            const Icon = item.icon
            const active = statusFilter === item.status
            return (
              <button
                key={item.status}
                onClick={() => setStatusFilter(item.status as Status)}
                className={`group relative overflow-hidden rounded-2xl border border-white/60 bg-white/90 p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500/70 ${active ? 'ring-2 ring-ocean-500/60 shadow-lg' : ''}`}
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-ocean-100/20 opacity-0 transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-center justify-between">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-ocean-500/10 text-ocean-700 ${active ? 'bg-ocean-600/20 text-white' : ''}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className={`text-2xl font-bold ${active ? 'text-ocean-600' : 'text-neutral-900'}`}>{item.count}</span>
                </div>
                <p className="relative mt-4 text-sm font-medium text-neutral-700">{item.label}</p>
              </button>
            )
          })}
        </div>
      </AdminSection>

      <AdminSection
        title="Recent Requests"
        description="Review the latest submissions and keep residents informed."
        actions={(
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              name="deliveryFilter"
              id="requests-delivery-filter"
              aria-label="Filter by delivery method"
              value={deliveryFilter}
              onChange={(e) => setDeliveryFilter(e.target.value as any)}
              className="rounded-lg border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium shadow-sm transition-all focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
            >
              <option value="all">All Delivery Types</option>
              <option value="digital">Digital</option>
              <option value="pickup">Pickup</option>
            </select>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-ocean-500 hover:text-ocean-700"
              onClick={() => setVerifyOpen(true)}
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              Verify Ticket
            </button>
            <button
              className="rounded-lg border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition-colors hover:border-ocean-500 hover:text-ocean-700"
              onClick={openDocTypeManager}
            >
              Manage Document Types
            </button>
          </div>
        )}
        padding="none"
      >
        {error && <div className="px-6 py-3 text-sm text-red-700">{error}</div>}
        <div className="divide-y divide-neutral-200">
          {loading && (
            <div className="px-6 py-6">
              <div className="mb-4 h-6 w-40 skeleton rounded" />
              <div className="space-y-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded" />))}</div>
            </div>
          )}
          {!loading && visibleRows.map((request) => (
            <div key={request.id} id={`req-${request.request_id}`} className="px-6 py-5 transition-colors hover:bg-ocean-50/30">
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
                <div className={`h-6 w-1 rounded-full sm:col-span-1 sm:h-16 ${request.priority === 'urgent' ? 'bg-red-500' : request.priority === 'high' ? 'bg-yellow-500' : 'bg-neutral-300'}`} />
                <div className="min-w-0 grid grid-cols-1 items-center gap-4 sm:col-span-11 sm:grid-cols-12">
                  <div className="min-w-0 sm:col-span-3">
                    <p className="mb-1 font-bold text-neutral-900">{request.id}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-neutral-600">{request.document}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${request.delivery_method === 'digital' ? 'bg-ocean-100 text-ocean-700' : 'bg-purple-100 text-purple-700'}`}>
                        {request.delivery_method === 'digital' ? (
                          <>
                            <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Digital</span>
                          </>
                        ) : (
                          <>
                            <PackageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Pickup</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <p className="text-sm text-neutral-700">{request.resident}</p>
                    <p className="text-xs text-neutral-600">Requester</p>
                  </div>
                  <div className="min-w-0 sm:col-span-3">
                    <p className="truncate text-sm text-neutral-700">{request.purpose}</p>
                    {(request.civil_status || request.details) && (
                      <p className="truncate text-xs text-neutral-600">{[request.civil_status, request.details].filter(Boolean).join(' • ')}</p>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <p className="text-sm text-neutral-700">{request.submitted}</p>
                    <p className="text-xs text-neutral-600">Submitted</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium sm:text-xs ${request.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : request.status === 'processing' ? 'bg-ocean-100 text-ocean-700' : request.status === 'ready' ? 'bg-forest-100 text-forest-700' : request.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'}`}>
                      {request.status === 'pending' && <Hourglass className="h-3.5 w-3.5" aria-hidden="true" />}
                      {request.status === 'processing' && <Cog className="h-3.5 w-3.5" aria-hidden="true" />}
                      {request.status === 'ready' && <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{request.status === 'picked_up' ? 'Picked Up' : request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
                    </span>
                  </div>
                  <div className="relative space-y-2 text-left sm:col-span-1 sm:flex sm:flex-wrap sm:justify-end sm:gap-2 sm:space-y-0 sm:text-right">
                    <button
                      className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50 sm:w-auto sm:text-sm"
                      onClick={() => setMoreForId(moreForId === request.request_id ? null : request.request_id)}
                    >
                      More
                    </button>
                    {moreForId === request.request_id && (
                      <div className="absolute right-0 top-10 z-10 w-40 rounded-lg border border-neutral-200 bg-white py-1 shadow-md">
                        <button className="block w-full px-3 py-2 text-left text-xs hover:bg-neutral-50" onClick={async () => {
                          try {
                            setLoadingHistory(true)
                            setHistoryFor(request.request_id)
                            setMoreForId(null)
                            const res = await auditAdminApi.list({ entity_type: 'document_request', entity_id: request.request_id, per_page: 50 })
                            const data: any = res as any
                            setHistoryRows(data.logs || data.data?.logs || [])
                          } finally {
                            setLoadingHistory(false)
                          }
                        }}>History</button>
                        {request.document_file && (
                          <button className="block w-full px-3 py-2 text-left text-xs hover:bg-neutral-50" onClick={() => { setMoreForId(null); handleViewPdf(request) }}>View Document</button>
                        )}
                        <button className="block w-full px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-50" onClick={() => { setMoreForId(null); openReject(request) }}>Reject</button>
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
                      const actions: Array<{ key: string; element: ReactNode }> = []

                      if (isPending) {
                        actions.push({
                          key: 'approve',
                          element: (
                            <button
                              onClick={() => handleApprove(request)}
                              className="w-full rounded-lg bg-yellow-100 px-3 py-2 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                              disabled={actionLoading === String(request.id)}
                            >
                              {actionLoading === String(request.id) ? 'Approving…' : 'Approve'}
                            </button>
                          ),
                        })
                      } else if (isApproved) {
                        actions.push({
                          key: 'start-processing',
                          element: (
                            <button
                              onClick={() => handleStartProcessing(request)}
                              className="w-full rounded-lg bg-ocean-100 px-3 py-2 text-xs font-medium text-ocean-700 transition-colors hover:bg-ocean-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                              disabled={actionLoading === String(request.id)}
                            >
                              {actionLoading === String(request.id) ? 'Starting…' : 'Start Processing'}
                            </button>
                          ),
                        })
                      } else if (isProcessing) {
                        if (isPickup) {
                          if (!hasToken) {
                            actions.push({
                              key: 'generate-claim',
                              element: (
                                <button
                                  onClick={() => handleGenerateClaim(request)}
                                  className="w-full rounded-lg bg-forest-100 px-3 py-2 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                                  disabled={actionLoading === String(request.id)}
                                >
                                  {actionLoading === String(request.id) ? 'Generating…' : 'Generate Claim Token'}
                                </button>
                              ),
                            })
                          } else {
                            actions.push({
                              key: 'mark-ready',
                              element: (
                                <button
                                  onClick={() => handleSetReady(request)}
                                  className="w-full rounded-lg bg-forest-100 px-3 py-2 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                                  disabled={actionLoading === String(request.id)}
                                >
                                  {actionLoading === String(request.id) ? 'Updating…' : 'Mark Ready for Pickup'}
                                </button>
                              ),
                            })
                          }
                        } else if (!hasPdf) {
                          actions.push({
                            key: 'edit-generate',
                            element: (
                              <button
                                onClick={() => {
                                  const edited = (request as any).admin_edited_content || {}
                                  const resident = (request as any).resident_input || {}
                                  const legacyNotes = (request as any).additional_notes
                                  let remarks = ''
                                  if (edited && edited.remarks) remarks = edited.remarks
                                  else if (resident && resident.remarks) remarks = resident.remarks
                                  else if (typeof legacyNotes === 'string') remarks = legacyNotes
                                  const ageVal = edited?.age ?? resident?.age
                                  setEditFor({
                                    id: request.request_id,
                                    purpose: edited?.purpose || request.purpose || '',
                                    remarks: remarks || '',
                                    civil_status: edited?.civil_status || request.civil_status || '',
                                    age: ageVal !== undefined && ageVal !== null ? String(ageVal) : '',
                                  })
                                }}
                                className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-200 sm:w-auto sm:text-sm"
                              >
                                Edit / Generate PDF
                              </button>
                            ),
                          })
                        } else {
                          actions.push({
                            key: 'mark-completed-processing',
                            element: (
                              <button
                                onClick={() => handleComplete(request)}
                                className="w-full rounded-lg bg-forest-100 px-3 py-2 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                                disabled={actionLoading === String(request.id)}
                              >
                                {actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}
                              </button>
                            ),
                          })
                        }
                      } else if (isReady) {
                        if (isPickup) {
                          actions.push({
                            key: 'mark-picked-up',
                            element: (
                              <button
                                onClick={() => handlePickedUp(request)}
                                className="w-full rounded-lg bg-emerald-100 px-3 py-2 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                                disabled={actionLoading === String(request.id)}
                              >
                                {actionLoading === String(request.id) ? 'Saving…' : 'Mark Picked Up'}
                              </button>
                            ),
                          })
                        } else {
                          actions.push({
                            key: 'mark-completed-ready',
                            element: (
                              <button
                                onClick={() => handleComplete(request)}
                                className="w-full rounded-lg bg-forest-100 px-3 py-2 text-xs font-medium text-forest-700 transition-colors hover:bg-forest-200 disabled:opacity-60 sm:w-auto sm:text-sm"
                                disabled={actionLoading === String(request.id)}
                              >
                                {actionLoading === String(request.id) ? 'Completing…' : 'Mark Completed'}
                              </button>
                            ),
                          })
                        }
                      }

                      const canViewTicket = request.delivery_method === 'digital'
                        ? !!request.document_file
                        : !!request.has_claim_token || !!request.ticket_link || !!request.qr_url || !!request.qr_code

                      if (canViewTicket) {
                        actions.push({
                          key: 'view-ticket',
                          element: (
                            <button
                              onClick={() => handleViewTicket(request)}
                              className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-800 transition-colors hover:bg-neutral-50 disabled:opacity-60 sm:w-auto sm:text-sm"
                              disabled={actionLoading === String(request.id)}
                            >
                              {actionLoading === String(request.id) ? 'Opening…' : 'View Ticket'}
                            </button>
                          ),
                        })
                      }

                      if (!actions.length) return null

                      return actions.map(({ key, element }) => (
                        <div key={key} className="w-full sm:w-auto">
                          {element}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>

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
    </AdminPageShell>
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

