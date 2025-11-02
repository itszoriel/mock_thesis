import { useEffect, useMemo, useState } from 'react'
import { handleApiError, userApi, mediaUrl, transferAdminApi, showToast, municipalitiesApi, adminApi } from '../lib/api'
import { useLocation } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'
import { DataTable, Modal, Button } from '@munlink/ui'
import { Check, RotateCcw, Pause, ExternalLink, Hourglass, Users, UserCheck, UserMinus, Clock } from 'lucide-react'
import TransferRequestCard from '../components/transfers/TransferRequestCard'
import TransferRequestModal from '../components/transfers/TransferRequestModal'

type ResidentFilter = 'all' | 'verified' | 'pending' | 'needs_revision' | 'suspended'

export default function Residents() {
  const location = useLocation()
  const adminMunicipalityName = useAdminStore((state: AdminState) => state.user?.admin_municipality_name || state.user?.municipality_name)
  const adminMunicipalitySlug = useAdminStore((state: AdminState) => state.user?.admin_municipality_slug || state.user?.municipality_slug)
  const adminMunicipalityId = useAdminStore((state: AdminState) => state.user?.admin_municipality_id ?? state.user?.municipality_id ?? null)
  const [activeTab, setActiveTab] = useState<'residents'|'transfers'>('residents')
  const [filter, setFilter] = useState<ResidentFilter>('all')
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
          ...pending.map((u: any) => ({ ...u, __status: ((u.verification_status || 'pending') as string).toLowerCase() })),
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
          status: (() => {
            if (u.is_active === false) return 'suspended'
            const derived = (u.__status || u.verification_status || '').toLowerCase()
            if (derived === 'needs_revision') return 'needs_revision'
            if (derived === 'verified') return 'verified'
            if (derived === 'pending') return 'pending'
            return u.admin_verified ? 'verified' : 'pending'
          })(),
          joined: (u.created_at || '').slice(0, 10),
          avatar: (u.first_name?.[0] || 'U') + (u.last_name?.[0] || ''),
          profile_picture: u.profile_picture,
          verification_notes: u.verification_notes,
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
    needs_revision: rows.filter((r) => r.status === 'needs_revision').length,
    suspended: rows.filter((r) => r.status === 'suspended').length,
  }), [rows])

  const overviewCards = useMemo(() => [
    {
      key: 'all' as ResidentFilter,
      label: 'Total Residents',
      value: counts.all,
      description: 'Profiles within your municipality',
      icon: Users,
      gradient: 'from-ocean-500/10 via-transparent to-forest-500/10',
      iconClass: 'bg-ocean-500/15 text-ocean-700',
    },
    {
      key: 'verified' as ResidentFilter,
      label: 'Verified',
      value: counts.verified,
      description: 'Email & ID verified residents',
      icon: UserCheck,
      gradient: 'from-forest-500/12 via-transparent to-forest-500/6',
      iconClass: 'bg-forest-500/15 text-forest-700',
    },
    {
      key: 'pending' as ResidentFilter,
      label: 'Pending Review',
      value: counts.pending,
      description: 'Awaiting your approval',
      icon: Clock,
      gradient: 'from-yellow-400/15 via-transparent to-yellow-400/5',
      iconClass: 'bg-yellow-400/20 text-yellow-700',
    },
    {
      key: 'needs_revision' as ResidentFilter,
      label: 'Needs Updates',
      value: counts.needs_revision,
      description: 'Sent back for revision',
      icon: Pause,
      gradient: 'from-orange-400/15 via-transparent to-orange-400/5',
      iconClass: 'bg-orange-400/20 text-orange-700',
    },
    {
      key: 'suspended' as ResidentFilter,
      label: 'Suspended',
      value: counts.suspended,
      description: 'Temporarily deactivated accounts',
      icon: UserMinus,
      gradient: 'from-red-500/12 via-transparent to-red-500/6',
      iconClass: 'bg-red-500/15 text-red-700',
    },
  ], [counts])

  const openResident = (resident: any) => {
    setSelected(resident)
    setDetailOpen(true)
  }

  // openResidentByUserId removed in favor of dedicated transfer modal

  const updateRowStatus = (userId: string, status: 'verified' | 'pending' | 'needs_revision' | 'suspended', notes?: string | null) => {
    setRows((prev: any[]) => prev.map((r: any) => (String(r.id) === String(userId) ? { ...r, status, verification_notes: notes ?? r.verification_notes } : r)))
    // If details are open for this user, keep basic status in sync
    setSelected((prev: any | null) => (prev && String(prev.id) === String(userId) ? { ...prev, status, verification_notes: notes ?? prev.verification_notes } : prev))
  }

  const handleApprove = async (e: any, resident: any) => {
    e.stopPropagation()
    const id = String(resident.id)
    try {
      setError(null)
      setActionLoading(id)
      await userApi.verifyUser(Number(id))
      updateRowStatus(id, 'verified', null)
      showToast('Resident marked as verified.', 'success')
    } catch (err: any) {
      const msg = handleApiError(err)
      setError(msg)
      showToast(msg, 'error')
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
      updateRowStatus(id, 'needs_revision', reason)
      showToast('Resident asked to update their information. They have been notified via email.', 'success')
    } catch (err: any) {
      const msg = handleApiError(err)
      setError(msg)
      showToast(msg, 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="relative">
        <div className="absolute inset-x-0 top-0 h-[280px] bg-gradient-to-br from-ocean-100/60 via-white to-forest-100/50" aria-hidden="true" />
        <div className="relative px-4 pb-16 sm:px-6 lg:px-10">
          <div className="pt-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-ocean-700/80">Admin · Residents</p>
                <h1 className="text-3xl font-bold text-neutral-900">Residents</h1>
                <p className="max-w-2xl text-neutral-600">
                  Manage verified residents and municipality transfer requests
                  {adminMunicipalityName ? ` for ${adminMunicipalityName}` : ''}.
                </p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {overviewCards.map((card) => {
                const Icon = card.icon
                const isActive = filter === card.key
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setFilter(card.key)}
                    className={`group relative overflow-hidden rounded-2xl border border-transparent bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500/70 ${isActive ? 'ring-2 ring-ocean-500/60 shadow-lg' : ''}`}
                    aria-pressed={isActive}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${card.gradient}`} />
                    <div className="relative">
                      <div className={`mb-3 inline-flex items-center justify-center rounded-xl p-3 ${card.iconClass}`}>
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-500">{card.label}</span>
                        <span className="text-lg font-semibold text-neutral-900">{card.value}</span>
                      </div>
                      <p className="mt-2 text-sm text-neutral-500">{card.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex items-center gap-1 rounded-full bg-white p-1 shadow-sm ring-1 ring-neutral-200">
              {[
                { key: 'residents', label: 'Residents' },
                { key: 'transfers', label: 'Transfer Requests' },
              ].map((t: any) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${activeTab === t.key ? 'bg-ocean-500 text-white shadow' : 'text-neutral-600 hover:bg-neutral-100/70'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {adminMunicipalityName && (
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-neutral-600 shadow-sm ring-1 ring-neutral-200">
                <svg className="h-4 w-4 text-neutral-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z" /></svg>
                <span className="truncate">{adminMunicipalityName}</span>
              </div>
            )}
          </div>

          {activeTab === 'residents' && (
            <>
              <div className="mt-6 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-lg backdrop-blur">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="w-full xl:max-w-md">
                    <label htmlFor="resident-search" className="sr-only">Search residents</label>
                    <div className="relative">
                      <input
                        type="search"
                        name="resident_search"
                        id="resident-search"
                        aria-label="Search residents by name, email, or ID number"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by name, email, or ID number..."
                        className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 pl-12 pr-4 py-3 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20 transition-all"
                      />
                      <svg className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                  </div>
                  <div className="w-full xl:flex-1 xl:min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {[
                        { value: 'all', label: 'All Status', count: counts.all },
                        { value: 'verified', label: 'Verified', count: counts.verified },
                        { value: 'pending', label: 'Pending', count: counts.pending },
                        { value: 'needs_revision', label: 'Needs Updates', count: counts.needs_revision },
                        { value: 'suspended', label: 'Suspended', count: counts.suspended },
                      ].map((status) => (
                        <button
                          key={status.value}
                          onClick={() => setFilter(status.value as ResidentFilter)}
                          aria-pressed={filter === status.value}
                          className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${filter === status.value ? 'border-ocean-500 bg-ocean-50 text-ocean-700 shadow-sm' : 'border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200/80'}`}
                        >
                          <span>{status.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${filter === status.value ? 'bg-ocean-500/10 text-ocean-700' : 'bg-white text-neutral-500'}`}>{status.count}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {error && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              <div className="mt-6">
                <DataTable
                  className="data-table rounded-2xl border border-white/60 bg-white/90 backdrop-blur shadow-xl"
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
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      r.status === 'verified'
                        ? 'bg-forest-100 text-forest-700'
                        : r.status === 'needs_revision'
                          ? 'bg-orange-100 text-orange-700'
                          : r.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {r.status === 'verified' && <Check className="w-4 h-4" aria-hidden="true" />}
                    {r.status === 'pending' && <Hourglass className="w-4 h-4" aria-hidden="true" />}
                    {r.status === 'needs_revision' && <Pause className="w-4 h-4" aria-hidden="true" />}
                    <span>{r.status.split('_').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')}</span>
                  </span>
                </div>
              ) },
              { key: 'actions', header: 'Actions', className: 'md:col-span-2 xl:col-span-2 text-right', render: (r: any) => (
                <div className="flex items-center justify-end h-10 gap-1 whitespace-nowrap">
                  {r.status === 'pending' || r.status === 'needs_revision' ? (
                    <>
                      <button
                        title="Request changes"
                        aria-label="Request changes"
                        className="icon-btn danger"
                        onClick={(e: React.MouseEvent) => { e.stopPropagation(); handleReject(e as any, r) }}
                        disabled={actionLoading === String(r.id)}
                      >
                        <Pause className="w-4 h-4" aria-hidden="true" />
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
                          const id = Number(r.id)
                          try {
                            setActionLoading(String(id))
                            const res = await adminApi.suspendResident(id)
                            const updated = (res as any)?.user || (res as any)?.data?.user || (res as any)
                            const derived = (updated?.verification_status || '').toLowerCase()
                            const nextStatus: 'verified' | 'pending' | 'needs_revision' | 'suspended' = updated?.is_active === false
                              ? 'suspended'
                              : derived === 'needs_revision'
                                ? 'needs_revision'
                                : (updated?.admin_verified ? 'verified' : 'pending')
                            updateRowStatus(String(id), nextStatus, updated?.verification_notes ?? null)
                            showToast(nextStatus === 'suspended' ? 'Resident suspended' : 'Resident reactivated', 'success')
                          } catch (err: any) {
                            const msg = handleApiError(err as any) || 'Failed to update resident status'
                            showToast(msg, 'error')
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
              </div>
            </>
          )}
          {activeTab === 'transfers' && (
            <div className="mt-6 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-neutral-900">Municipality Transfer Requests</h2>
                  <p className="text-sm text-neutral-600">Approve outgoing or accept incoming transfers for {adminMunicipalityName}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 min-w-0">
                  <label htmlFor="transfer-search" className="sr-only">Search transfers</label>
                  <input
                    id="transfer-search"
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 px-4 py-3 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20 transition-all"
                    value={transferQuery}
                    onChange={(e) => { setTransferPage(1); setTransferQuery(e.target.value) }}
                    placeholder="Search by resident, email, or transfer #"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
                    value={transferStatus}
                    onChange={(e) => { setTransferPage(1); setTransferStatus(e.target.value as any) }}
                  >
                    <option value="all">All</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Denied</option>
                    <option value="accepted">Completed</option>
                  </select>
                  <select
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
                    value={transferSort}
                    onChange={(e) => setTransferSort(e.target.value as any)}
                  >
                    <option value="created_at">Newest</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
                    value={transferOrder}
                    onChange={(e) => setTransferOrder(e.target.value as any)}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>
              <div className="mt-6">
                {loadingTransfers ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-600">Loading transfers…</div>
                ) : transfers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-500">No transfer requests right now.</div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
            </div>
          )}
        </div>
      </div>
      {/* Detail Modal */}
      {detailOpen && activeTab==='residents' && (
        <ResidentDetailModal
          userId={Number(selected?.id)}
          basic={selected}
          onClose={() => setDetailOpen(false)}
          onStatusChange={(id, status, notes) => updateRowStatus(String(id), status, notes)}
        />
      )}
      {detailOpen && activeTab==='transfers' && (
        <TransferRequestModal open={true} onClose={() => setDetailOpen(false)} transfer={selected} />
      )}
    </div>
  )
}


// Detail modal embedded for simplicity
function ResidentDetailModal({ userId, basic, onClose, onStatusChange }: { userId: number; basic: any; onClose: () => void; onStatusChange: (id: number, status: 'verified' | 'pending' | 'needs_revision' | 'suspended', notes?: string | null) => void }) {
  const [data, setData] = useState<any>(basic)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)

  // Derive current status from latest data
  const status: 'verified' | 'pending' | 'needs_revision' | 'suspended' = ((): any => {
    const u = data || basic
    if (!u) return 'pending'
    if (u?.is_active === false) return 'suspended'
    const derived = (u?.verification_status || '').toLowerCase()
    if (derived === 'needs_revision') return 'needs_revision'
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
      onStatusChange(userId, 'verified', null)
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), admin_verified: true, is_active: true, verification_status: 'verified', verification_notes: null }))
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
      onStatusChange(userId, 'needs_revision', reason)
      // Reflect locally in modal
      setData((prev: any) => ({ ...(prev || {}), is_active: true, admin_verified: false, verification_status: 'needs_revision', verification_notes: reason }))
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
          {(status === 'pending' || status === 'needs_revision') ? (
            <>
              <Button variant="danger" size="sm" onClick={rejectFromModal} disabled={actionLoading}>
                {actionLoading ? 'Processing…' : 'Request changes'}
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
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${status === 'verified' ? 'bg-forest-100 text-forest-700' : status === 'needs_revision' ? 'bg-orange-100 text-orange-700' : status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {status === 'verified' ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Verified</span>
                </>
              ) : status === 'needs_revision' ? (
                <>
                  <Pause className="w-4 h-4" aria-hidden="true" />
                  <span>Needs updates</span>
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
          {status === 'needs_revision' && data?.verification_notes && (
            <div className="mt-3 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded px-3 py-2">
              <span className="font-medium">Resident feedback:</span> {data.verification_notes}
            </div>
          )}
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

