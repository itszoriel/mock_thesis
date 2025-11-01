import { useEffect, useMemo, useState } from 'react'
import { handleApiError, userApi, mediaUrl, transferAdminApi, showToast, municipalitiesApi } from '../lib/api'
import { useLocation } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'
import { DataTable, Modal, Button } from '@munlink/ui'
import { X, Check, RotateCcw, Pause, ExternalLink, Hourglass } from 'lucide-react'
import TransferRequestCard from '../components/transfers/TransferRequestCard'
import TransferRequestModal from '../components/transfers/TransferRequestModal'

export default function Residents() {
  const location = useLocation()
  const adminMunicipalityName = useAdminStore((state: AdminState) => state.user?.admin_municipality_name || state.user?.municipality_name)
  const adminMunicipalitySlug = useAdminStore((state: AdminState) => state.user?.admin_municipality_slug || state.user?.municipality_slug)
  const adminMunicipalityId = useAdminStore((state: AdminState) => state.user?.admin_municipality_id ?? state.user?.municipality_id ?? null)
  const [activeTab, setActiveTab] = useState<'residents'|'transfers'>('residents')
  const [filter, setFilter] = useState<'all' | 'verified' | 'pending' | 'suspended'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const perPage = 10
  const [transfers, setTransfers] = useState<any[]>([])
  const [loadingTransfers, setLoadingTransfers] = useState(false)
  const [munMap, setMunMap] = useState<Record<number, string>>({})

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        // Load verified and pending users in parallel
        const [verifiedRes, pendingRes] = await Promise.all([
          userApi.getVerifiedUsers(1, 100),
          userApi.getPendingUsers(),
        ])

        const verified = (verifiedRes as any)?.data || (verifiedRes as any)?.users || []
        const pending = (pendingRes as any)?.users || (pendingRes as any)?.data?.users || []

        let unified = [
          ...verified.map((u: any) => ({ ...u, __status: 'verified' })),
          ...pending.map((u: any) => ({ ...u, __status: 'pending' })),
        ]

        // Scope to admin's municipality (prefer numeric id to avoid string mismatches)
        if (adminMunicipalityId) {
          unified = unified.filter((u: any) => Number(u.municipality_id) === Number(adminMunicipalityId))
        } else if (adminMunicipalityName || adminMunicipalitySlug) {
          unified = unified.filter((u: any) => {
            const name = (u.municipality_name || '').toLowerCase()
            const slug = (u.municipality_slug || '').toLowerCase()
            const wantName = (adminMunicipalityName || '').toLowerCase()
            const wantSlug = (adminMunicipalitySlug || '').toLowerCase()
            return (wantName && name === wantName) || (wantSlug && slug === wantSlug)
          })
        }

        const mapped = unified.map((u: any) => ({
          id: u.id ? String(u.id) : u.user_id ? String(u.user_id) : u.username || 'USER',
          name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email || 'Unknown',
          email: u.email || '',
          phone: u.phone_number || '',
          municipality: u.municipality_name || '—',
          status: u.__status || (u.is_active === false ? 'suspended' : (u.admin_verified ? 'verified' : (u.admin_verified === false ? 'pending' : 'pending'))),
          joined: (u.created_at || '').slice(0, 10),
          avatar: (u.first_name?.[0] || 'U') + (u.last_name?.[0] || ''),
          profile_picture: u.profile_picture,
        }))
        if (mounted) setRows(mapped)
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Transfers filters & pagination
  const [transferStatus, setTransferStatus] = useState<'all'|'pending'|'approved'|'rejected'|'accepted'>('all')
  const [transferQuery, setTransferQuery] = useState('')
  const [transferSort, setTransferSort] = useState<'created_at'|'status'>('created_at')
  const [transferOrder, setTransferOrder] = useState<'asc'|'desc'>('desc')
  const [transferPage, setTransferPage] = useState(1)
  const transferPerPage = 12

  // Load transfer requests scoped to admin municipality with filters
  useEffect(() => {
    let cancelled = false
    const loadTransfers = async () => {
      try {
        setLoadingTransfers(true)
        const params: any = { page: transferPage, per_page: transferPerPage, sort: transferSort, order: transferOrder }
        if (transferStatus !== 'all') params.status = transferStatus
        if (transferQuery) params.q = transferQuery
        const res = await transferAdminApi.list(params)
        const data = (res as any)?.data || res
        if (!cancelled) setTransfers(data?.transfers || [])
      } catch (e) {
        if (!cancelled) console.error('Failed to load transfers', e)
      } finally {
        if (!cancelled) setLoadingTransfers(false)
      }
    }
    loadTransfers()
    return () => { cancelled = true }
  }, [transferStatus, transferQuery, transferSort, transferOrder, transferPage])

  // Load municipalities map for ID -> name
  useEffect(() => {
    let cancelled = false
    const loadMuns = async () => {
      try {
        const res = await municipalitiesApi.list()
        const data = (res as any)?.data || res
        const list = data?.municipalities || data || []
        const map: Record<number, string> = {}
        for (const m of list) {
          if (m?.id) map[Number(m.id)] = m.name || m.slug || String(m.id)
        }
        if (!cancelled) setMunMap(map)
      } catch {}
    }
    loadMuns()
    return () => { cancelled = true }
  }, [])

  const updateTransferStatus = async (id: number, status: 'approved'|'rejected'|'accepted') => {
    try {
      setActionLoading(`t-${id}`)
      await transferAdminApi.updateStatus(id, status)
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, status, updated_at: new Date().toISOString() } : t))
      showToast(`Transfer ${status}`, 'success')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Auto-open from query param ?open=<id>
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const openId = params.get('open')
    if (!openId) return
    const found = rows.find((r) => String(r.id) === String(openId))
    if (found) openResident(found)
  }, [location.search, rows])

  const filtered = useMemo(() => rows.filter((r) =>
    (filter === 'all' || r.status === filter) &&
    (r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.email.toLowerCase().includes(searchQuery.toLowerCase()) || String(r.id).toLowerCase().includes(searchQuery.toLowerCase()))
  ), [rows, filter, searchQuery])

  // Reset to first page on filter/search changes
  useEffect(() => { setPage(1) }, [filter, searchQuery])

  // Pagination calculations
  // DataTable handles pagination UI; we keep only page indices
  const startIdx = (page - 1) * perPage
  const endIdx = Math.min(startIdx + perPage, filtered.length)
  const visible = filtered.slice(startIdx, endIdx)
  

  const counts = useMemo(() => ({
    all: rows.length,
    verified: rows.filter((r) => r.status === 'verified').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  }), [rows])

  const openResident = (resident: any) => {
    setSelected(resident)
    setDetailOpen(true)
  }

  // openResidentByUserId removed in favor of dedicated transfer modal

  const updateRowStatus = (userId: string, status: 'verified' | 'pending' | 'suspended') => {
    setRows((prev: any[]) => prev.map((r: any) => (String(r.id) === String(userId) ? { ...r, status } : r)))
    // If details are open for this user, keep basic status in sync
    setSelected((prev: any | null) => (prev && String(prev.id) === String(userId) ? { ...prev, status } : prev))
  }

  const handleApprove = async (e: any, resident: any) => {
    e.stopPropagation()
    const id = String(resident.id)
    try {
      setError(null)
      setActionLoading(id)
      await userApi.verifyUser(Number(id))
      updateRowStatus(id, 'verified')
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (e: any, resident: any) => {
    e.stopPropagation()
    const id = String(resident.id)
    try {
      const reason = window.prompt('Enter a reason for rejection (optional):', 'Verification rejected by admin') || 'Verification rejected by admin'
      setError(null)
      setActionLoading(id)
      await userApi.rejectUser(Number(id), reason)
      updateRowStatus(id, 'suspended')
    } catch (err: any) {
      setError(handleApiError(err))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="">
        <div className="">
          <div className="flex items-start justify-between gap-3 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">Residents</h1>
              <p className="text-neutral-600">Manage verified residents, and municipality transfer requests</p>
            </div>
          </div>
          <div className="mb-6">
            <div className="inline-flex rounded-xl border border-neutral-200 bg-white overflow-hidden">
              {[
                { key: 'residents', label: 'Residents' },
                { key: 'transfers', label: 'Transfer Requests' },
              ].map((t: any) => (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-4 py-2 text-sm font-medium ${activeTab===t.key? 'bg-ocean-600 text-white' : 'bg-white text-neutral-700 hover:bg-neutral-50'}`}
                >{t.label}</button>
              ))}
            </div>
          </div>

          {/* Residents Toolbar: Search + Filters */}
          {activeTab==='residents' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 md:p-6 shadow-lg border border-white/50 mb-6">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <input type="search" name="resident_search" id="resident-search" aria-label="Search residents by name, email, or ID number" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, email, or ID number..." className="w-full pl-12 pr-4 py-3 bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:border-ocean-500 focus:ring-2 focus:ring-ocean-500/20 transition-all" />
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>
              <div className="w-full lg:w-auto -mx-2 px-2 overflow-x-auto lg:overflow-visible">
                <div className="inline-flex items-center gap-2">
                  {[
                    { value: 'all', label: 'All Status', count: counts.all },
                    { value: 'verified', label: 'Verified', count: counts.verified },
                    { value: 'pending', label: 'Pending', count: counts.pending },
                    { value: 'suspended', label: 'Suspended', count: counts.suspended },
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setFilter(status.value as any)}
                      aria-pressed={filter === status.value}
                      className={`shrink-0 px-4 py-2 rounded-xl font-medium transition-all ${filter === status.value ? 'bg-ocean-gradient text-white shadow-lg' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'}`}
                    >
                      {status.label}
                      <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${filter === status.value ? 'bg-white/20' : 'bg-neutral-200'}`}>{status.count}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Municipality is scoped by admin permissions; show a locked chip instead of a selector */}
              {adminMunicipalityName && (
                <div className="chip-locked w-full lg:w-auto">
                  <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>
                  <span className="truncate">{adminMunicipalityName}</span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Transfer Requests Tab */}
          {activeTab==='transfers' && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/50 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Municipality Transfer Requests</h2>
                <p className="text-neutral-600 text-sm">Approve (outgoing) or accept (incoming) transfers for {adminMunicipalityName}</p>
              </div>
            </div>
            {/* Filters */}
            <div className="mb-4 flex flex-col md:flex-row gap-3 md:items-center">
              <div className="flex-1 min-w-0">
                <input className="w-full border rounded px-3 py-2 text-sm" value={transferQuery} onChange={(e)=> { setTransferPage(1); setTransferQuery(e.target.value) }} placeholder="Search by resident, email, or transfer #" />
              </div>
              <div className="flex gap-2">
                <select className="border rounded px-2 py-1 text-sm" value={transferStatus} onChange={(e)=> { setTransferPage(1); setTransferStatus(e.target.value as any) }}>
                  <option value="all">All</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Denied</option>
                  <option value="accepted">Completed</option>
                </select>
                <select className="border rounded px-2 py-1 text-sm" value={transferSort} onChange={(e)=> setTransferSort(e.target.value as any)}>
                  <option value="created_at">Newest</option>
                  <option value="status">Status</option>
                </select>
                <select className="border rounded px-2 py-1 text-sm" value={transferOrder} onChange={(e)=> setTransferOrder(e.target.value as any)}>
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>
            {loadingTransfers ? (
              <div className="text-sm text-neutral-600">Loading transfers…</div>
            ) : transfers.length === 0 ? (
              <div className="text-sm text-neutral-600">No transfer requests.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {transfers.map((t: any) => {
                  const canApprove = Number(t.from_municipality_id) === Number(adminMunicipalityId)
                  const canAccept = Number(t.to_municipality_id) === Number(adminMunicipalityId)
                  return (
                    <TransferRequestCard
                      key={t.id}
                      t={t}
                      munMap={munMap}
                      canApprove={canApprove}
                      canDeny={canApprove}
                      canAccept={canAccept}
                      onApprove={() => updateTransferStatus(t.id, 'approved')}
                      onDeny={() => updateTransferStatus(t.id, 'rejected')}
                      onAccept={() => updateTransferStatus(t.id, 'accepted')}
                      onView={() => { setSelected(t); setDetailOpen(true) }}
                      onHistory={async () => { setSelected(t); setDetailOpen(true) }}
                    />
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* Residents Table */}
          {activeTab==='residents' && (
          <DataTable
            className="data-table bg-white/70 backdrop-blur-xl"
            columns={[
              { key: 'resident', header: 'Resident', className: 'md:col-span-3 xl:col-span-3', render: (r: any) => (
                <div className="flex items-center h-10 gap-3 min-w-0">
                  {r.profile_picture ? (
                    <img src={mediaUrl(r.profile_picture)} alt={r.name} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-ocean-gradient text-white flex items-center justify-center font-bold">{r.avatar}</div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                  </div>
                </div>
              ) },
              { key: 'contact', header: 'Contact', className: 'md:col-span-2 xl:col-span-3', render: (r: any) => (
                <div className="flex items-center h-10 min-w-0">
                  <span className="truncate" title={`${r.email}${r.phone ? ` • ${r.phone}` : ''}`}>{r.email}{r.phone ? ` • ${r.phone}` : ''}</span>
                </div>
              ) },
              { key: 'municipality', header: 'Municipality', className: 'md:col-span-2 xl:col-span-2', render: (r: any) => (
                <div className="flex items-center h-10">{r.municipality}</div>
              ) },
              { key: 'status', header: 'Status', className: 'md:col-span-3 xl:col-span-2', render: (r: any) => (
                <div className="flex items-center h-10">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${r.status === 'verified' ? 'bg-forest-100 text-forest-700' : r.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {r.status === 'verified' && <Check className="w-4 h-4" aria-hidden="true" />}
                    {r.status === 'pending' && <Hourglass className="w-4 h-4" aria-hidden="true" />}
                    <span>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</span>
                  </span>
                </div>
              ) },
              { key: 'actions', header: 'Actions', className: 'md:col-span-2 xl:col-span-2 text-right', render: (r: any) => (
                <div className="flex items-center justify-end h-10 gap-1 whitespace-nowrap">
                  {r.status === 'pending' ? (
                    <>
                      <button title="Reject" aria-label="Reject" className="icon-btn danger" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleReject(e as any, r) }} disabled={actionLoading === String(r.id)}>
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button title="Approve" aria-label="Approve" className="icon-btn primary" onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleApprove(e as any, r) }} disabled={actionLoading === String(r.id)}>
                        <Check className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className={`icon-btn ${r.status==='suspended' ? 'success' : 'danger'}`}
                        onClick={async (e: React.MouseEvent) => {
                          e.stopPropagation()
                          const id = String(r.id)
                          try {
                            setActionLoading(id)
                            const res = await fetch(`${(import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000'}/api/admin/users/${id}/suspend`, {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${useAdminStore.getState().accessToken}` }
                            })
                            const ok = res.ok
                            if (ok) updateRowStatus(id, r.status==='suspended' ? 'verified' : 'suspended')
                          } finally {
                            setActionLoading(null)
                          }
                        }}
                        disabled={actionLoading === String(r.id)}
                        title={r.status==='suspended' ? 'Unsuspend' : 'Suspend'}
                        aria-label={r.status==='suspended' ? 'Unsuspend' : 'Suspend'}
                      >
                        {r.status==='suspended' ? (
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Pause className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                      <button title="Open" aria-label="Open" className="icon-btn" onClick={(e: React.MouseEvent) => { e.stopPropagation(); openResident(r) }}>
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                </div>
              ) },
            ]}
            data={visible}
            onRowClick={(row: any) => openResident(row)}
            emptyState={loading ? 'Loading…' : (error ? error : 'No residents found')}
            pagination={{ page, pageSize: perPage, total: filtered.length, onChange: (p: number) => setPage(p) }}
          />
          )}
        </div>
      </div>
      {/* Detail Modal */}
      {detailOpen && activeTab==='residents' && (
        <ResidentDetailModal
          userId={Number(selected?.id)}
          basic={selected}
          onClose={() => setDetailOpen(false)}
          onStatusChange={(id, status) => updateRowStatus(String(id), status)}
        />
      )}
      {detailOpen && activeTab==='transfers' && (
        <TransferRequestModal open={true} onClose={() => setDetailOpen(false)} transfer={selected} />
      )}
    </div>
  )
}


// Detail modal embedded for simplicity
function ResidentDetailModal({ userId, basic, onClose, onStatusChange }: { userId: number; basic: any; onClose: () => void; onStatusChange: (id: number, status: 'verified' | 'pending' | 'suspended') => void }) {
  const [data, setData] = useState<any>(basic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  // Derive current status from latest data
  const status: 'verified' | 'pending' | 'suspended' = ((): any => {
    const u = data || basic
    if (!u) return 'pending'
    if (u?.is_active === false) return 'suspended'
    if (u?.admin_verified) return 'verified'
    return 'pending'
  })()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await userApi.getUserById(userId)
        const u = (res as any)?.data || res
        if (mounted && u) setData(u)
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [userId])

  const approveFromModal = async () => {
    try {
      setError(null)
      setActionLoading(true)
      await userApi.verifyUser(Number(userId))
      onStatusChange(userId, 'verified')
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), admin_verified: true, is_active: true }))
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(false)
    }
  }

  const rejectFromModal = async () => {
    const reason = window.prompt('Enter a reason for rejection (optional):', 'Verification rejected by admin') || 'Verification rejected by admin'
    try {
      setError(null)
      setActionLoading(true)
      await userApi.rejectUser(Number(userId), reason)
      onStatusChange(userId, 'suspended')
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), is_active: false, admin_verified: false }))
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Modal
      open={true}
      onOpenChange={(o) => { if (!o) onClose() }}
      title="Resident Details"
      footer={(
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
          {status === 'pending' ? (
            <>
              <Button variant="danger" size="sm" onClick={rejectFromModal} disabled={actionLoading}>
                {actionLoading ? 'Processing…' : 'Reject'}
              </Button>
              <Button size="sm" onClick={approveFromModal} disabled={actionLoading}>
                {actionLoading ? 'Processing…' : 'Approve'}
              </Button>
            </>
          ) : null}
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
      )}
    >
      {loading && <div className="text-sm text-neutral-600">Loading...</div>}
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>}
      <div className="flex items-start gap-4">
        {data?.profile_picture ? (
          <img src={mediaUrl(data.profile_picture)} alt={data?.name || ''} className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl object-cover" />
        ) : (
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-ocean-gradient rounded-xl flex items-center justify-center text-white font-bold">{(data?.first_name?.[0]||'U')+(data?.last_name?.[0]||'')}</div>
        )}
        <div>
          <h3 className="text-lg font-semibold">{[data?.first_name, data?.last_name].filter(Boolean).join(' ')}</h3>
          <p className="text-sm text-neutral-600">@{data?.username} • {data?.email}</p>
          {data?.municipality_name && (<p className="text-sm text-neutral-600">{data.municipality_name}</p>)}
          <div className="mt-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status === 'verified' ? 'bg-forest-100 text-forest-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {status === 'verified' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Verified</span>
                </>
              ) : status === 'pending' ? (
                <>
                  <Hourglass className="w-4 h-4" aria-hidden="true" />
                  <span>Pending</span>
                </>
              ) : (
                <span>Suspended</span>
              )}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-sm font-semibold mb-3">ID Verification</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data?.valid_id_front && (
            <div>
              <p className="text-xs text-neutral-500 mb-2">Front</p>
              <img src={mediaUrl(data.valid_id_front)} alt="ID Front" className="w-full h-44 sm:h-48 object-cover rounded border" />
            </div>
          )}
          {data?.valid_id_back && (
            <div>
              <p className="text-xs text-neutral-500 mb-2">Back</p>
              <img src={mediaUrl(data.valid_id_back)} alt="ID Back" className="w-full h-44 sm:h-48 object-cover rounded border" />
            </div>
          )}
          {!data?.valid_id_front && !data?.valid_id_back && (
            <p className="text-sm text-neutral-500">No ID documents uploaded.</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

