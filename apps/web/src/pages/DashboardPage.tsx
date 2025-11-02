import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { marketplaceApi, documentsApi, benefitsApi, handleApiError, showToast } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import { StatusBadge } from '@munlink/ui'
import ClaimTicketModal from '@/components/ClaimTicketModal'
import { useAppStore } from '@/lib/store'
import { FileText, Package, ShoppingBag, Plus, ArrowRight, User, AlertTriangle } from 'lucide-react'

type MyItem = { id: number, title: string, status: string }
type MyTx = { id: number, status: string, transaction_type: string, as: 'buyer' | 'seller' }
type MyReq = { id: number, request_number: string, status: string, delivery_method?: string, document_type?: { name: string } }
type MyBenefitApp = { id: number, status: string, application_number: string, created_at?: string, supporting_documents?: string[], program?: { name?: string } }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<MyItem[]>([])
  const [txs, setTxs] = useState<MyTx[]>([])
  const [reqs, setReqs] = useState<MyReq[]>([])
  const [apps, setApps] = useState<MyBenefitApp[]>([])
  const [appModalOpen, setAppModalOpen] = useState(false)
  const [selectedApp, setSelectedApp] = useState<MyBenefitApp | null>(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimFor, setClaimFor] = useState<number | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [reqError, setReqError] = useState<string | null>(null)
  const [appsError, setAppsError] = useState<string | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const user = useAppStore((s) => s.user)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  const loadDashboardData = useCallback(async () => {
    if (!isAuthBootstrapped || !isAuthenticated) {
      setItems([])
      setTxs([])
      setReqs([])
      setApps([])
      setItemsError(null)
      setTxError(null)
      setReqError(null)
      setAppsError(null)
      setBlockedMessage(null)
      return
    }

    setLoading(true)
    setBlockedMessage(null)
    setItemsError(null)
    setTxError(null)
    setReqError(null)
    setAppsError(null)

    const extractStatus = (err: any) => err?.response?.status ?? err?.status ?? null

    const [itemsRes, txRes, reqRes, appsRes] = await Promise.allSettled([
      marketplaceApi.getMyItems(),
      marketplaceApi.getMyTransactions(),
      documentsApi.getMyRequests(),
      benefitsApi.getMyApplications(),
    ])

    if (itemsRes.status === 'fulfilled') {
      setItems((itemsRes.value.data?.items || []).slice(0, 5))
    } else {
      const status = extractStatus(itemsRes.reason)
      if (status === 403) {
        setBlockedMessage('Your account is still under admin review. You can browse but cannot submit new requests yet.')
      }
      setItemsError(handleApiError(itemsRes.reason, 'Unable to load your marketplace items.'))
    }

    if (txRes.status === 'fulfilled') {
      const asBuyer = (txRes.value.data?.as_buyer || []).map((t: any) => ({ ...t, as: 'buyer' }))
      const asSeller = (txRes.value.data?.as_seller || []).map((t: any) => ({ ...t, as: 'seller' }))
      setTxs([...(asBuyer as any[]), ...(asSeller as any[])].slice(0, 5))
    } else {
      setTxError(handleApiError(txRes.reason, 'Unable to load your transactions.'))
    }

    if (reqRes.status === 'fulfilled') {
      setReqs((reqRes.value.data?.requests || []).slice(0, 5))
    } else {
      setReqError(handleApiError(reqRes.reason, 'Unable to load your document requests.'))
    }

    if (appsRes.status === 'fulfilled') {
      setApps(((appsRes.value.data?.applications || []) as any[]))
    } else {
      setAppsError(handleApiError(appsRes.reason, 'Unable to load your benefit applications.'))
    }

    setLoading(false)
  }, [isAuthBootstrapped, isAuthenticated])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (cancelled) return
      await loadDashboardData()
    })()
    return () => { cancelled = true }
  }, [loadDashboardData])

  const retryLoad = useCallback(async () => {
    await loadDashboardData()
  }, [loadDashboardData])

  return (
    <div className="container-responsive py-8 md:py-10">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-r from-sky-50 via-blue-50 to-emerald-50 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-ocean-gradient text-white flex items-center justify-center shadow-md">
                <User size={20} />
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold">Welcome{user?.username ? `, ${user.username}` : ''}</h1>
            </div>
            <p className="text-sm md:text-base text-gray-600 mt-2 max-w-2xl">Quickly manage your marketplace items, follow transactions, and track document requests—all in one place.</p>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-1 xs:grid-cols-3 gap-3 w-full md:w-auto">
            <Link to="/documents" className="group rounded-xl border bg-white/80 backdrop-blur shadow-sm px-4 py-3 flex items-center gap-2 hover:shadow transition">
              <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                <FileText size={16} />
              </div>
              <span className="text-sm font-medium">Request Document</span>
              <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
            </Link>
            <Link to="/marketplace" className="group rounded-xl border bg-white/80 backdrop-blur shadow-sm px-4 py-3 flex items-center gap-2 hover:shadow transition">
              <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Plus size={16} />
              </div>
              <span className="text-sm font-medium">Post Item</span>
              <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
            </Link>
            <Link to="/issues" className="group rounded-xl border bg-white/80 backdrop-blur shadow-sm px-4 py-3 flex items-center gap-2 hover:shadow transition">
              <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                <AlertTriangle size={16} />
              </div>
              <span className="text-sm font-medium">Report Issue</span>
              <ArrowRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition" />
            </Link>
          </div>
        </div>

        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-emerald-200/40 blur-3xl" />
      </div>

      {blockedMessage && (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          {blockedMessage}
        </div>
      )}

      {(itemsError || txError || reqError || appsError) && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>Some sections failed to load. You can keep browsing with the latest available data.</span>
          <button type="button" className="btn-secondary text-sm" onClick={retryLoad}>
            Try again
          </button>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 xs:grid-cols-3 gap-4 mt-6">
        <StatCard icon={<Package size={16} />} label="Items" value={items.length} hint="latest 5 shown" />
        <StatCard icon={<ShoppingBag size={16} />} label="Transactions" value={txs.length} hint="recent activity" />
        <StatCard icon={<FileText size={16} />} label="Requests" value={reqs.length} hint="in progress" />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card p-6">
              <div className="h-5 w-1/3 skeleton mb-3" />
              <div className="space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <div className="space-y-2">
            <ListCard
              title="My Items"
              icon={<Package size={18} />}
              emptyLabel="No items yet."
              footer={<Link to="/my-marketplace" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">View My Marketplace<ArrowRight size={14} /></Link>}
              entries={items.map((it) => ({ id: it.id, primary: it.title, status: it.status }))}
              renderAction={(e) => (
                <button
                  className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                  onClick={async () => {
                    if (!window.confirm('Delete this item? This cannot be undone.')) return
                    try {
                      await marketplaceApi.deleteItem(Number(e.id))
                      setItems((prev) => prev.filter((i) => i.id !== e.id))
                    } catch (err: any) {
                      const msg = handleApiError(err, 'Unable to delete item right now.')
                      showToast(msg, 'error')
                    }
                  }}
                >
                  Delete
                </button>
              )}
            />
            {itemsError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{itemsError}</p>
            )}
          </div>

          <div className="space-y-2">
            <ListCard
              title="My Transactions"
              icon={<ShoppingBag size={18} />}
              emptyLabel="No transactions yet."
              footer={<Link to="/my-marketplace?tab=transactions" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">See all<ArrowRight size={14} /></Link>}
              entries={txs.map((t) => ({ id: t.id, primary: t.transaction_type, status: t.status, extra: { as: t.as } }))}
              renderAction={(e) => (
                e.status === 'pending' && e.extra?.as === 'seller' ? (
                  <Link
                    to="/my-marketplace?tab=transactions"
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    Accept
                  </Link>
                ) : null
              )}
            />
            {txError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{txError}</p>
            )}
          </div>

          <div className="space-y-2">
            <ListCard
              title="My Document Requests"
              icon={<FileText size={18} />}
              emptyLabel="No requests yet."
              footer={<Link to="/documents?tab=requests" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">Open documents<ArrowRight size={14} /></Link>}
              entries={reqs.map((r: any) => ({ id: r.id, primary: `${r.document_type?.name || 'Document'} • ${r.request_number || ''}`.trim(), status: r.status, href: `/dashboard/requests/${r.id}`, extra: r }))}
              renderAction={(e) => {
                const extra = (e as any).extra || {}
                const isReadyPickup = String(extra.status || '').toLowerCase() === 'ready' && String(extra.delivery_method || '').toLowerCase() !== 'digital'
                if (!isReadyPickup) return null
                return (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => { setClaimFor(Number(extra.id)); setClaimOpen(true) }}
                  >View Claim Ticket</button>
                )
              }}
            />
            {reqError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{reqError}</p>
            )}
          </div>

          <div className="space-y-2">
            <ListCard
              title="My Benefit Applications"
              icon={<FileText size={18} />}
              emptyLabel="No applications yet."
              footer={<Link to="/benefits?tab=applications" className="text-sm text-blue-700 hover:underline inline-flex items-center gap-1">Open benefits<ArrowRight size={14} /></Link>}
              entries={apps.map((a) => ({ id: a.id, primary: a.program?.name || a.application_number, status: a.status, extra: a }))}
              renderAction={(e) => (
                <button
                  className="text-xs px-2 py-1 rounded border border-ocean-200 text-ocean-700 hover:bg-ocean-50"
                  onClick={() => { setSelectedApp(e.extra as MyBenefitApp); setAppModalOpen(true) }}
                >
                  View Proof
                </button>
              )}
            />
            {appsError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{appsError}</p>
            )}
          </div>
        </div>
      )}

      {/* Proof Modal */}
        <Modal
          isOpen={appModalOpen && !!selectedApp}
          onClose={() => { setAppModalOpen(false); setSelectedApp(null) }}
          title={selectedApp?.program?.name ? `Application: ${selectedApp.program.name}` : 'Application Details'}
          footer={(
            <div className="flex items-center justify-end gap-2">
              <button
                className="btn-secondary"
                onClick={() => window.print()}
              >
                Print
              </button>
              <button className="btn-primary" onClick={() => { setAppModalOpen(false); setSelectedApp(null) }}>Close</button>
            </div>
          )}
        >
          {selectedApp && (
            <div className="space-y-2 text-sm">
              <div><span className="font-medium">Application No:</span> {selectedApp.application_number}</div>
              <div><span className="font-medium">Program:</span> {selectedApp.program?.name || '—'}</div>
              <div className="flex items-center gap-2"><span className="font-medium">Status:</span> <StatusBadge status={selectedApp.status} /></div>
              {selectedApp.created_at && (<div><span className="font-medium">Submitted:</span> {selectedApp.created_at.slice(0,10)}</div>)}
              {Array.isArray(selectedApp.supporting_documents) && selectedApp.supporting_documents.length > 0 && (
                <div className="mt-3">
                  <div className="font-medium mb-1">Uploaded Documents</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.supporting_documents.map((p, i) => (
                      <a key={i} href={`${(import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000'}/uploads/${String(p).replace(/^uploads\//,'')}`} target="_blank" rel="noreferrer" className="text-xs underline text-blue-700">Document {i+1}</a>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 text-gray-600">You can print this page as proof of your application. Keep your Application No. for reference.</div>
            </div>
          )}
        </Modal>

      {/* Claim Ticket Modal */}
      <ClaimTicketModal requestId={claimFor} isOpen={claimOpen} onClose={() => { setClaimOpen(false); setClaimFor(null) }} />
    </div>
  )
}

type StatCardProps = {
  icon: ReactNode
  label: string
  value: number | string
  hint?: string
}

function StatCard({ icon, label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white shadow-sm border p-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-ocean-gradient text-white flex items-center justify-center shadow">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        {hint && <div className="text-xs text-gray-500">{hint}</div>}
      </div>
    </div>
  )
}

type ListEntry = { id: number | string, primary: string, status: string, href?: string, extra?: any }

type ListCardProps = {
  title: string
  icon?: ReactNode
  entries: ListEntry[]
  emptyLabel: string
  footer?: ReactNode
  renderAction?: (entry: ListEntry) => ReactNode | null
}

function ListCard({ title, icon, entries, emptyLabel, footer, renderAction }: ListCardProps) {
  return (
    <div className="rounded-2xl border bg-white shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon && <div className="h-8 w-8 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center">{icon}</div>}
        <h3 className="text-base md:text-lg font-semibold">{title}</h3>
      </div>
      <div className="space-y-2">
        {entries.map((e, idx) => (
          <div
            key={`${String(e.id)}-${idx}`}
            className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-1 sm:gap-3 rounded-lg border px-3 py-2 items-center"
          >
            <div className="min-w-0">
              {e.href ? (
                <Link
                  to={e.href}
                  className="block font-medium capitalize break-words line-clamp-2 sm:line-clamp-1 text-blue-700 hover:underline"
                >
                  {e.primary}
                </Link>
              ) : (
                <div className="block font-medium capitalize break-words line-clamp-2 sm:line-clamp-1">
                  {e.primary}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 sm:justify-end shrink-0">
              <StatusBadge status={e.status} />
              {renderAction ? renderAction(e) : null}
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="text-sm text-gray-600 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            {emptyLabel}
          </div>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  )
}

// Using shared StatusBadge from @munlink/ui

