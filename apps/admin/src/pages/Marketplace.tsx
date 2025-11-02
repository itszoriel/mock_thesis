import { useEffect, useMemo, useState } from 'react'
import { handleApiError, marketplaceApi, mediaUrl, transactionsAdminApi, userApi } from '../lib/api'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'
import { ShoppingBag, Store, BadgeDollarSign, Handshake, Gift, Check, X } from 'lucide-react'

export default function Marketplace() {
  const [tab, setTab] = useState<'items' | 'transactions'>('items')
  const [filter, setFilter] = useState<'all' | 'sell' | 'lend' | 'donate'>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [stats, setStats] = useState<{ total_items: number; pending_items: number; approved_items: number; rejected_items: number } | null>(null)
  const adminMunicipalityName = useAdminStore((state: AdminState) => state.user?.admin_municipality_name || state.user?.municipality_name)
  const adminMunicipalityId = useAdminStore((state: AdminState) => state.user?.admin_municipality_id)
  const [reviewItem, setReviewItem] = useState<any | null>(null)
  // Status moderation removed; show available items by default

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const [statsRes, itemsRes] = await Promise.allSettled([
          marketplaceApi.getMarketplaceStats(),
          marketplaceApi.listPublicItems({
            municipality_id: adminMunicipalityId,
            status: 'available',
            page: 1,
            per_page: 50,
          }),
        ]) 

        if (itemsRes.status === 'fulfilled') {
          const payload: any = (itemsRes.value as any)?.data || itemsRes.value
          const items = payload?.items || payload || []
          const scoped = Array.isArray(items)
            ? items.filter((it: any) => {
                if (!adminMunicipalityId) return true
                const parsed = Number(it?.municipality_id ?? it?.municipality?.id)
                return Number.isFinite(parsed) && parsed === Number(adminMunicipalityId)
              })
            : []
          const mapped = scoped.map((it: any) => {
            const u = it.user || it.seller || {}
            const displayName = (
              [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || it.owner_name || 'User'
            )
            const initial = (displayName || 'U').trim().charAt(0).toUpperCase()
            return {
              id: it.id || it.item_id || it.code || 'ITEM',
              title: it.title || it.name || 'Untitled',
              user: displayName,
              userInitial: initial,
              userPhoto: u.profile_picture || null,
              type: (it.type || it.transaction_type || 'sell').toLowerCase(),
              category: it.category || 'General',
              image: (Array.isArray(it.images) && it.images[0]) || it.image_url || null,
              images: Array.isArray(it.images) ? it.images : (it.image_url ? [it.image_url] : []),
              description: it.description || '',
              views: it.view_count || it.views || 0,
              inquiries: it.inquiries || 0,
              posted: (it.created_at || '').slice(0, 10),
              status: it.status || 'active',
            }
          })
          if (mounted) setRows(mapped)
        } else if (mounted) {
          setRows([])
        }

        if (statsRes.status === 'fulfilled') {
          const data = (statsRes.value as any)?.data || statsRes.value
          if (mounted) setStats(data)
        }
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [adminMunicipalityId])

  const filtered = useMemo(() => rows.filter((i) => filter === 'all' || i.type === filter), [rows, filter])

  const [txRows, setTxRows] = useState<any[]>([])
  const [txLoading, setTxLoading] = useState(false)
  const [txStatus, setTxStatus] = useState<string>('')
  const [selectedTx, setSelectedTx] = useState<{ tx: any, audit: any[] } | null>(null)

  useEffect(() => {
    let active = true
    if (tab !== 'transactions') return
    ;(async () => {
      setTxLoading(true)
      try {
        const res = await transactionsAdminApi.list(txStatus ? { status: txStatus } : {})
        if (!active) return
        const list = (res as any).transactions || (res as any)?.data?.transactions || []
        setTxRows(list)
      } finally {
        if (active) setTxLoading(false)
      }
    })()
    return () => { active = false }
  }, [tab, txStatus])

  return (
    <div className="min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">Marketplace Management</h1>
          <p className="text-neutral-600">Monitor and moderate community marketplace listings</p>
        </div>
        <div className="inline-flex rounded-xl border overflow-hidden">
          <button className={`px-4 py-2 text-sm ${tab==='items'?'bg-ocean-600 text-white':'bg-white hover:bg-neutral-50'}`} onClick={()=>setTab('items')}>Items</button>
          <button className={`px-4 py-2 text-sm ${tab==='transactions'?'bg-ocean-600 text-white':'bg-white hover:bg-neutral-50'}`} onClick={()=>setTab('transactions')}>Transactions</button>
        </div>
      </div>

      {tab === 'items' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        {[
          { icon: 'total', label: 'Total Items', value: String(stats?.total_items ?? '—'), color: 'ocean' },
        ].map((stat, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-lg hover:-translate-y-1 transition-transform">
            <div className={`inline-flex w-12 h-12 bg-${stat.color}-100 rounded-xl items-center justify-center mb-3`}>
              {stat.icon === 'total' && <ShoppingBag className="w-6 h-6" aria-hidden="true" />}
            </div>
            <p className="text-3xl font-bold text-neutral-900 mb-1">{stat.value}</p>
            <p className="text-sm text-neutral-600 mb-2">{stat.label}</p>
          </div>
        ))}
      </div>
      )}

      {tab === 'items' && (
      <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 shadow-lg border border-white/60 mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'all', label: 'All Items', icon: 'store' },
              { value: 'sell', label: 'For Sale', icon: 'money' },
              { value: 'lend', label: 'For Lending', icon: 'handshake' },
              { value: 'donate', label: 'Free', icon: 'gift' },
            ].map((type) => (
              <button key={type.value} onClick={() => setFilter(type.value as any)} className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all ${filter === type.value ? 'bg-ocean-gradient text-white shadow-lg' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}>
                {type.icon === 'store' && <Store className="w-4 h-4" aria-hidden="true" />}
                {type.icon === 'money' && <BadgeDollarSign className="w-4 h-4" aria-hidden="true" />}
                {type.icon === 'handshake' && <Handshake className="w-4 h-4" aria-hidden="true" />}
                {type.icon === 'gift' && <Gift className="w-4 h-4" aria-hidden="true" />}
                <span>{type.label}</span>
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 border border-neutral-200 rounded-xl text-sm font-medium">
            <svg className="w-4 h-4 text-neutral-500" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 00-4 4v2H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V6a4 4 0 00-4-4zm-2 6V6a2 2 0 114 0v2H8z"/></svg>
            <span className="truncate max-w-[12rem]">{adminMunicipalityName || 'Municipality'}</span>
          </div>
        </div>
      </div>
      )}

      {tab === 'items' && error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</div>}
      {tab === 'items' && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
        {loading && [...Array(8)].map((_, i) => (
          <div key={`skeleton-${i}`} className="bg-white rounded-2xl overflow-hidden shadow-lg p-4">
            <div className="aspect-[4/3] skeleton rounded-xl mb-3" />
            <div className="h-4 w-40 skeleton rounded mb-2" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        ))}
        {!loading && filtered.map((item) => (
          <div key={item.id} className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
            <div className="relative aspect-[4/3] bg-neutral-100">
              {item.image && (
                <img
                  src={mediaUrl(item.image)}
                  alt={item.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )}
              <div className="absolute top-3 left-3 z-10">
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-md ${item.type === 'sell' ? 'bg-forest-500/90' : item.type === 'lend' ? 'bg-ocean-500/90' : 'bg-sunset-500/90'}`}>
                  {item.type === 'sell' && <><BadgeDollarSign className="w-4 h-4" aria-hidden="true" /><span>For Sale</span></>}
                  {item.type === 'lend' && <><Handshake className="w-4 h-4" aria-hidden="true" /><span>For Lending</span></>}
                  {item.type === 'donate' && <><Gift className="w-4 h-4" aria-hidden="true" /><span>Free</span></>}
                </span>
              </div>
              <div className="absolute bottom-3 left-3"><span className="inline-flex items-center gap-1 px-3 py-1 bg-forest-100 text-forest-700 rounded-full text-xs font-semibold"><Check className="w-4 h-4" aria-hidden="true" /> Active</span></div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-neutral-900 line-clamp-2 flex-1 group-hover:text-ocean-600 transition-colors">{item.title}</h3>
              </div>
              <p className="text-xs text-neutral-600 mb-2">{item.category}</p>
              {item.description && (
                <p className="text-sm text-neutral-700 mb-3 line-clamp-3 whitespace-pre-line flex-1">{item.description}</p>
              )}
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-neutral-200">
                {item.userPhoto ? (
                  <img src={mediaUrl(item.userPhoto)} alt="profile" className="w-8 h-8 rounded-full object-cover border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-ocean-gradient text-white text-sm font-bold flex items-center justify-center border">
                    {item.userInitial || 'U'}
                  </div>
                )}
                <div className="text-xs text-neutral-700 truncate">{item.user}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div><p className="text-xs text-neutral-600">Views</p><p className="text-sm font-bold text-neutral-900">{item.views}</p></div>
                <div><p className="text-xs text-neutral-600">Inquiries</p><p className="text-sm font-bold text-neutral-900">{item.inquiries}</p></div>
                <div><p className="text-xs text-neutral-600">Posted</p><p className="text-xs font-medium text-neutral-700">{item.posted}</p></div>
              </div>
              <div className="flex">
                <button onClick={() => setReviewItem(item)} className="flex-1 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-lg text-xs font-medium transition-colors">View</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && (
          <div className="col-span-full text-center text-neutral-600 py-10">No items yet.</div>
        )}
      </div>
      )}


      {tab === 'transactions' && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-4 shadow-lg border border-white/50">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Transactions</h2>
            <select className="border rounded px-2 py-1" value={txStatus} onChange={(e)=>setTxStatus(e.target.value)}>
              <option value="">All</option>
              <option value="pending">pending</option>
              <option value="awaiting_buyer">awaiting_buyer</option>
              <option value="accepted">accepted</option>
              <option value="handed_over">handed_over</option>
              <option value="received">received</option>
              <option value="returned">returned</option>
              <option value="completed">completed</option>
              <option value="disputed">disputed</option>
            </select>
          </div>
          {txLoading ? (
            <div>Loading…</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left p-2 border">ID</th>
                    <th className="text-left p-2 border">Item</th>
                    <th className="text-left p-2 border">Type</th>
                    <th className="text-left p-2 border">Buyer</th>
                    <th className="text-left p-2 border">Seller</th>
                    <th className="text-left p-2 border">Status</th>
                    <th className="text-left p-2 border">Created</th>
                    <th className="text-left p-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {txRows.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-2 border">{r.id}</td>
                      <td className="p-2 border">{r.item_title || r.item_id}</td>
                      <td className="p-2 border">{r.transaction_type}</td>
                      <td className="p-2 border">{r.buyer_name || r.buyer_id}</td>
                      <td className="p-2 border">{r.seller_name || r.seller_id}</td>
                      <td className="p-2 border">{r.status}</td>
                      <td className="p-2 border">{(r.created_at || '').slice(0, 19).replace('T',' ')}</td>
                      <td className="p-2 border">
                        <button className="text-xs px-2 py-1 border rounded" onClick={async ()=>{
                          const res = await transactionsAdminApi.get(r.id)
                          const tx = (res as any).transaction
                          const audit = (res as any).audit || []
                          try {
                            const [b, s] = await Promise.allSettled([
                              userApi.getUserById(Number(tx.buyer_id)),
                              userApi.getUserById(Number(tx.seller_id)),
                            ])
                            const buyer = b.status === 'fulfilled' ? (b.value as any).data : undefined
                            const seller = s.status === 'fulfilled' ? (s.value as any).data : undefined
                            setSelectedTx({ tx: { ...tx, buyer, seller }, audit })
                          } catch {
                            setSelectedTx({ tx, audit })
                          }
                        }}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {txRows.length === 0 && <div className="text-sm text-gray-600 mt-4">No transactions found.</div>}
            </div>
          )}
        </div>
      )}

      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setReviewItem(null) }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setReviewItem(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-full sm:max-w-2xl xl:max-w-3xl p-4 sm:p-6 pb-24 sm:pb-6 shadow-2xl max-h-[90vh] overflow-y-auto" tabIndex={-1} autoFocus>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold">Listing Details</h2>
                <p className="text-xs text-neutral-600">Read-only view of the listing.
                </p>
              </div>
              <button onClick={() => setReviewItem(null)} className="text-neutral-500 hover:text-neutral-700" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="aspect-[4/3] bg-neutral-100 rounded-xl overflow-hidden">
                  {Array.isArray(reviewItem.image ? [reviewItem.image] : reviewItem.images) && (reviewItem.image || reviewItem.images?.[0]) ? (
                    <img src={mediaUrl(reviewItem.image || reviewItem.images?.[0])} alt={reviewItem.title} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">No image</div>
                  )}
                </div>
                {Array.isArray(reviewItem.images) && reviewItem.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pt-1">
                    {reviewItem.images.slice(1).map((img: string, idx: number) => (
                      <img key={idx} src={mediaUrl(img)} alt="thumb" className="w-16 h-16 rounded-lg object-contain border bg-neutral-50" />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">Type</p>
                <p className="font-semibold capitalize">{reviewItem.type || reviewItem.transaction_type}</p>
                <p className="text-xs text-neutral-500 mt-3">Title</p>
                <p className="font-semibold">{reviewItem.title}</p>
                <p className="text-xs text-neutral-500 mt-3">Category</p>
                <p className="font-medium">{reviewItem.category}</p>
                {reviewItem.description && (
                  <>
                    <p className="text-xs text-neutral-500 mt-3">Description</p>
                    <p className="text-sm whitespace-pre-line text-neutral-700">{reviewItem.description}</p>
                  </>
                )}
                <p className="text-xs text-neutral-500 mt-3">Posted</p>
                <p className="font-medium">{reviewItem.posted}</p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button onClick={() => setReviewItem(null)} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={()=>setSelectedTx(null)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-5 sm:p-6" onClick={(e)=>e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Transaction #{selectedTx.tx.id}</h2>
                <div className="mt-1 inline-flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${selectedTx.tx.status==='completed'?'bg-emerald-100 text-emerald-700': selectedTx.tx.status==='disputed'?'bg-rose-100 text-rose-700': selectedTx.tx.status==='accepted'?'bg-blue-100 text-blue-700':'bg-neutral-100 text-neutral-700'}`}>{selectedTx.tx.status}</span>
                  {selectedTx.tx.transaction_type && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-50 border border-neutral-200 capitalize">{selectedTx.tx.transaction_type}</span>
                  )}
                </div>
              </div>
              <button className="text-sm px-3 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50" onClick={()=>setSelectedTx(null)}>Close</button>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              {[{label:'Buyer', user:selectedTx.tx.buyer, id:selectedTx.tx.buyer_id, hue:'ocean', fallback:selectedTx.tx.buyer_name, photo:selectedTx.tx.buyer?.profile_picture || selectedTx.tx.buyer_profile_picture},{label:'Seller', user:selectedTx.tx.seller, id:selectedTx.tx.seller_id, hue:'sunset', fallback:selectedTx.tx.seller_name, photo:selectedTx.tx.seller?.profile_picture || selectedTx.tx.seller_profile_picture}].map((u,i)=>{
                const name = u.user?.first_name ? `${u.user.first_name} ${u.user.last_name}` : (u.fallback || `#${u.id}`)
                const initials = (u.user?.first_name||name||'').split(' ').map((s: string)=>s.charAt(0)).join('').slice(0,2)
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-200 bg-white/80">
                    {u.photo ? (
                      <img src={mediaUrl(u.photo)} alt={`${u.label} avatar`} className="w-10 h-10 rounded-full object-cover border" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${u.hue==='ocean'?'bg-ocean-500':'bg-sunset-500'}`}>{(initials||'U')}</div>
                    )}
                    <div className="min-w-0">
                      <div className="text-xs text-neutral-500">{u.label}</div>
                      <div className="font-medium truncate">{name}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Timeline */}
            <div className="max-h-[60vh] overflow-auto">
              <div className="relative pl-4">
                <div className="absolute left-1 top-0 bottom-0 w-px bg-neutral-200" />
                {(selectedTx.audit || []).map((a, i) => {
                  const isDispute = String(a.action||'') === 'dispute'
                  const actorId = a.actor_id
                  const buyerId = selectedTx.tx.buyer_id
                  const sellerId = selectedTx.tx.seller_id
                  const reporterName = actorId === buyerId
                    ? (selectedTx.tx.buyer ? `${selectedTx.tx.buyer.first_name} ${selectedTx.tx.buyer.last_name}` : (selectedTx.tx.buyer_name || `#${buyerId}`))
                    : (selectedTx.tx.seller ? `${selectedTx.tx.seller.first_name} ${selectedTx.tx.seller.last_name}` : (selectedTx.tx.seller_name || `#${sellerId}`))
                  const reportedId = a.metadata?.reported_user_id || (actorId === buyerId ? sellerId : buyerId)
                  const reportedName = reportedId === buyerId
                    ? (selectedTx.tx.buyer ? `${selectedTx.tx.buyer.first_name} ${selectedTx.tx.buyer.last_name}` : (selectedTx.tx.buyer_name || `#${buyerId}`))
                    : (selectedTx.tx.seller ? `${selectedTx.tx.seller.first_name} ${selectedTx.tx.seller.last_name}` : (selectedTx.tx.seller_name || `#${sellerId}`))
                  const reporterRole = actorId === buyerId ? 'Buyer' : 'Seller'
                  const reportedRole = reportedId === buyerId ? 'Buyer' : 'Seller'
                  const chip = String(a.action||'')
                  const chipCls = chip==='dispute'?'bg-rose-100 text-rose-700': chip==='complete'?'bg-emerald-100 text-emerald-700': chip.includes('handover')?'bg-blue-100 text-blue-700':'bg-neutral-100 text-neutral-700'
                  return (
                    <div key={i} className="relative pl-4 py-2">
                      <div className="absolute left-0 top-3 w-2 h-2 rounded-full bg-neutral-400" />
                      <div className="text-xs text-neutral-500">{(a.created_at || '').replace('T',' ').slice(0,19)}</div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${chipCls}`}>{String(a.action || '').replace(/_/g,' ')}</span>
                        <span className="text-sm text-neutral-700">{a.from_status} → {a.to_status}</span>
                        {a.notes && <span className="text-sm text-neutral-800">• {a.notes}</span>}
                        {isDispute && <span className="text-sm text-rose-700">• Reported by {reporterRole} {reporterName} against {reportedRole} {reportedName}</span>}
                      </div>
                    </div>
                  )
                })}
                {selectedTx.audit?.length ? null : <div className="text-sm text-gray-600">No audit entries.</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


