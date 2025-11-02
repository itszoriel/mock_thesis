import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import GatedAction from '@/components/GatedAction'
import { marketplaceApi, mediaUrl, showToast, handleApiError } from '@/lib/api'
import { useAppStore } from '@/lib/store'

type Item = {
  id: number
  title: string
  category: string
  transaction_type: 'donate' | 'lend' | 'sell'
  price?: number
  images?: string[]
  municipality_id?: number
}

const CATEGORIES = ['All', 'Electronics','Furniture','Clothing','Home & Garden','Vehicles','Services','Other']
const UPLOAD_CATEGORIES = ['Electronics','Furniture','Clothing','Home & Garden','Vehicles','Services','Other']
const TYPES = ['All', 'donate', 'lend', 'sell'] as const

export default function MarketplacePage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const user = useAppStore((s) => s.user)
  const userMunicipalityId = Number((user as any)?.municipality_id)
  const [category, setCategory] = useState<string>('All')
  const [type, setType] = useState<typeof TYPES[number]>('All')
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [creatingTxId, setCreatingTxId] = useState<number | null>(null)
  const [myPending, setMyPending] = useState<Record<number, string>>({})
  const [listError, setListError] = useState<string | null>(null)
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null)
  const isViewingMismatch = !!userMunicipalityId && !!selectedMunicipality?.id && userMunicipalityId !== selectedMunicipality.id
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)

  const params = useMemo(() => {
    const p: any = { status: 'available', page: 1, per_page: 24 }
    if (selectedMunicipality?.id) p.municipality_id = selectedMunicipality.id
    if (category !== 'All') p.category = category
    if (type !== 'All') p.transaction_type = type
    return p
  }, [selectedMunicipality?.id, category, type])

  const loadMarketplace = useCallback(async (cancelRef?: { current: boolean }) => {
    const isCancelled = () => cancelRef?.current === true
    setLoading(true)
    if (!isCancelled()) {
      setListError(null)
      setBlockedMessage(null)
    }
    try {
      const res = await marketplaceApi.getItems(params)
      if (!isCancelled()) setItems(res.data?.items || [])

      if (isAuthenticated) {
        try {
          const tx = await marketplaceApi.getMyTransactions()
          const asBuyer = (tx as any)?.data?.as_buyer || (tx as any)?.as_buyer || []
          const pendingMap: Record<number, string> = {}
          for (const t of asBuyer) {
            if (t.status === 'pending' && typeof t.item_id === 'number') pendingMap[t.item_id] = 'pending'
          }
          if (!isCancelled()) setMyPending(pendingMap)
        } catch (err: any) {
          if (!isCancelled()) showToast(handleApiError(err, 'Failed to load marketplace activity'), 'error')
        }
      } else if (!isCancelled()) {
        setMyPending({})
      }
    } catch (err: any) {
      if (!isCancelled()) {
        const status = err?.response?.status ?? err?.status ?? null
        if (status === 403) {
          setBlockedMessage('Your account is waiting for admin approval. Marketplace posting and requests are disabled until approval is complete.')
        }
        const message = handleApiError(err, 'Failed to load marketplace items')
        setListError(message)
        showToast(message, 'error')
      }
    } finally {
      if (!isCancelled()) setLoading(false)
    }
  }, [isAuthenticated, params])

  useEffect(() => {
    const cancelRef = { current: false }
    loadMarketplace(cancelRef)
    return () => { cancelRef.current = true }
  }, [loadMarketplace])

  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({ title: '', description: '', category: '', condition: 'good', transaction_type: 'sell', price: '' })
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string>('')
  const retryLoad = useCallback(() => {
    void loadMarketplace()
  }, [loadMarketplace])

  return (
    <div className="container-responsive py-12">
      <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-3 mb-8">
        <h1 className="text-fluid-3xl font-serif font-semibold">Marketplace</h1>
        <div className="w-full xs:w-auto min-w-[140px]">
          <GatedAction
            required="fullyVerified"
            onAllowed={() => {
              if (!userMunicipalityId) {
                alert('Set your municipality in your profile before posting items')
                return
              }
              if (isViewingMismatch) {
                alert('Posting is limited to your registered municipality')
                return
              }
              setOpen(true)
            }}
          >
            <button className="btn btn-primary w-full xs:w-auto" disabled={isViewingMismatch} title={isViewingMismatch ? 'Posting is limited to your municipality' : undefined}>+ Post Item</button>
          </GatedAction>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 xs:grid-cols-2 gap-3">
        <select className="input-field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select className="input-field" value={type} onChange={(e) => setType(e.target.value as any)}>
          {TYPES.map((t) => (
            <option key={t} value={t}>{t === 'All' ? 'All Types' : t.charAt(0).toUpperCase()+t.slice(1)}</option>
          ))}
        </select>
      </div>

      {blockedMessage && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm">
          {blockedMessage}
        </div>
      )}

      {listError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-3">
          <span>{listError}</span>
          <button type="button" className="btn-secondary text-sm" onClick={retryLoad}>Retry</button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="aspect-[4/3] skeleton-image" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map((item) => (
            <div key={item.id} className="card">
              <div className="w-full aspect-[4/3] bg-gray-200 rounded-lg mb-4 overflow-hidden relative">
                <Link to={`/marketplace/${item.id}`} aria-label={`View ${item.title}`} className="absolute inset-0">
                  {item.images?.[0] ? (
                    <img src={mediaUrl(item.images[0])} alt={item.title} loading="lazy" className="responsive-img h-full" />
                  ) : (
                    <div className="w-full h-full" />
                  )}
                </Link>
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-white/90 text-neutral-800 shadow">{(item as any).municipality_name || (selectedMunicipality as any)?.name || 'Province-wide'}</span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow ${
                    item.transaction_type === 'sell'
                      ? 'bg-ocean-600 text-white'
                      : item.transaction_type === 'lend'
                        ? 'bg-forest-600 text-white'
                        : 'bg-sunset-600 text-white'
                  }`}>{item.transaction_type}</span>
                </div>
                <div className="absolute bottom-3 right-3">
                  <Link to={`/marketplace/${item.id}`} className="px-2.5 py-1 rounded-lg text-xs bg-white/90 hover:bg-white shadow">View</Link>
                </div>
              </div>
              <h3 className="font-bold mb-2"><Link to={`/marketplace/${item.id}`} className="hover:underline">{item.title}</Link></h3>
              <p className="text-sm text-gray-600 mb-2">Category: {item.category}</p>
              {(() => {
                const u = (item as any).user
                const photo = u?.profile_picture
                return (
                  <div className="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    {photo ? (
                      <img src={mediaUrl(photo)} alt="profile" className="w-6 h-6 rounded-full object-cover border" />
                    ) : (
                      <span className="text-[10px] text-gray-600 border border-gray-200 rounded-full px-2 py-0.5">No photo</span>
                    )}
                    <span>{u?.username || 'User'}</span>
                  </div>
                )
              })()}
              <p className="text-primary-500 font-bold capitalize">{item.transaction_type}{item.transaction_type==='sell'&& item.price?` • ₱${item.price}`:''}</p>
              <div className="mt-4">
                {(() => {
                  const currentUserId = Number((user as any)?.id ?? (user as any)?.user_id)
                  const isOwner = !!currentUserId && currentUserId === Number((item as any).user_id)
                  if (isOwner) {
                    return (
                      <div className="text-xs text-gray-500">This is your item.</div>
                    )
                  }
                  return (
                <GatedAction
                  required="fullyVerified"
                  onAllowed={async () => {
                        try {
                          if (!window.confirm('Submit this request? The seller/donor will be notified and must accept.')) return
                          setCreatingTxId(item.id)
                          await marketplaceApi.createTransaction({ item_id: item.id })
                          showToast('Request submitted. Awaiting seller/donor response.', 'success')
                          setMyPending((prev) => ({ ...prev, [item.id]: 'pending' }))
                        } catch (e: any) {
                          showToast(handleApiError(e, 'Failed to create transaction request'), 'error')
                        } finally {
                          setCreatingTxId(null)
                        }
                  }}
                >
                  {(() => {
                    const isCross = !!userMunicipalityId && !!item.municipality_id && userMunicipalityId !== item.municipality_id
                    return (
                      <button
                        className="btn btn-primary w-full"
                            disabled={creatingTxId === item.id || isCross || !!myPending[item.id]}
                            title={isCross ? 'Transactions are limited to your municipality' : (myPending[item.id] ? 'You already requested this item' : undefined)}
                      >
                            {creatingTxId === item.id
                              ? 'Submitting...'
                              : myPending[item.id]
                                ? 'Requested'
                                : (item.transaction_type === 'sell' ? 'Request to Buy' : item.transaction_type === 'lend' ? 'Request to Borrow' : 'Request Donation')}
                      </button>
                    )
                  })()}
                </GatedAction>
                  )
                })()}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center text-gray-600">No items found.</div>
          )}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}>
          <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col max-h-[90vh]" tabIndex={-1} autoFocus>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-xl font-semibold">Post an Item</h2>
              <button onClick={() => setOpen(false)} className="text-neutral-500 hover:text-neutral-700" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto">
            {error && (
              <div className="mb-3 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-3 py-2" role="alert">
                {error}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  <option value="">Select category</option>
                  {UPLOAD_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Condition</label>
                <select className="input-field" value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                  {['new','like_new','good','fair','poor'].map((c) => (<option key={c} value={c}>{c.replace('_',' ')}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select className="input-field" value={form.transaction_type} onChange={(e) => setForm({ ...form, transaction_type: e.target.value })}>
                  {['donate','lend','sell'].map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              {form.transaction_type === 'sell' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input className="input-field" type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input-field" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="post-images" className="block text-sm font-medium mb-1">Images (max 5)</label>
                <input id="post-images" name="post_images" className="input-field" type="file" accept="image/*" multiple onChange={(e) => setFiles((prev) => {
                  const next = [...prev, ...Array.from(e.target.files || [])]
                  return next.slice(0,5)
                })} />
                {files.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {files.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="relative">
                        <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-20 object-cover rounded border" />
                        <button type="button" className="absolute -top-2 -right-2 bg-white border rounded-full p-1 text-xs" aria-label="Remove image" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 border-t">
              <button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={creating || !form.title || !form.category || !form.description}
                onClick={async () => {
                  setCreating(true)
                  setError('')
                  try {
                    const payload: any = {
                      title: form.title,
                      description: form.description,
                      category: form.category,
                      condition: form.condition,
                      transaction_type: form.transaction_type,
                    }
                    if (form.transaction_type === 'sell') payload.price = Number(form.price || 0)
                    const res = await marketplaceApi.createItem(payload)
                    const id = res.data?.item?.id
                    if (id && files.length) {
                      const res2 = await marketplaceApi.uploadItemImages(id, files)
                      const up = (res2 as any)?.data?.uploaded?.length || 0
                      const skipped = (((res2 as any)?.data?.errors || []) as any[]).length + Number(((res2 as any)?.data?.skipped_over_limit || 0))
                      if (skipped) {
                        showToast(`Uploaded ${up} image(s), ${skipped} skipped`, 'info')
                      }
                    }
                    setOpen(false)
                    showToast('Your listing is live! It\'s now visible in the marketplace.', 'success')
                    const fresh = await marketplaceApi.getItems(params)
                    setItems(fresh.data?.items || [])
                    setFiles([])
                    setForm({ title: '', description: '', category: '', condition: 'good', transaction_type: 'sell', price: '' })
                  } catch (e: any) {
                    const msg = handleApiError(e, 'Failed to create item')
                    setError(msg)
                    showToast(msg, 'error')
                  } finally {
                    setCreating(false)
                  }
                }}>
                {creating ? 'Posting…' : 'Post Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

