import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { marketplaceApi, mediaUrl, showToast } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'

type MyItem = {
  id: number
  title: string
  description?: string
  status: string
  images?: string[]
  transaction_type: 'donate' | 'lend' | 'sell'
  price?: number
  created_at?: string
}

type MyTx = {
  id: number
  item_id: number
  status: string
  transaction_type: string
  created_at?: string
  as?: 'buyer' | 'seller'
  pickup_at?: string
}

export default function MyMarketplacePage() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const isAuthBootstrapped = useAppStore((s) => s.isAuthBootstrapped)
  const [tab, setTab] = useState<'items' | 'transactions'>('items')
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState<MyItem[]>([])
  const [txs, setTxs] = useState<MyTx[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [acceptingId, setAcceptingId] = useState<number | null>(null)
  const [editItem, setEditItem] = useState<MyItem | null>(null)
  const [editForm, setEditForm] = useState<{ title: string; description: string; price?: string; images: string[] }>({ title: '', description: '', price: '', images: [] })
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [acceptingTx, setAcceptingTx] = useState<MyTx | null>(null)
  const [acceptPickupAt, setAcceptPickupAt] = useState<string>('')
  const [acceptPickupLocation, setAcceptPickupLocation] = useState<string>('')
  const [auditOpen, setAuditOpen] = useState<{ id: number, logs: any[] } | null>(null)

  const minPickupLocal = useMemo(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    const yyyy = d.getFullYear()
    const mm = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const hh = pad(d.getHours())
    const mi = pad(d.getMinutes())
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        if (!isAuthBootstrapped || !isAuthenticated) { if (!cancelled) { setItems([]); setTxs([]) } return }
        const [myItemsRes, myTxRes] = await Promise.all([
          marketplaceApi.getMyItems(),
          marketplaceApi.getMyTransactions(),
        ])
        if (!cancelled) {
          setItems((myItemsRes.data?.items || []) as MyItem[])
          const asBuyer = (myTxRes.data?.as_buyer || []).map((t: any) => ({ ...t, as: 'buyer' }))
          const asSeller = (myTxRes.data?.as_seller || []).map((t: any) => ({ ...t, as: 'seller' }))
          setTxs([...(asBuyer as any[]), ...(asSeller as any[])])
        }
      } catch {
        if (!cancelled) { setItems([]); setTxs([]) }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [isAuthenticated, isAuthBootstrapped])

  // Initialize tab from query param (?tab=transactions)
  useEffect(() => {
    const t = (searchParams.get('tab') || '').toLowerCase()
    if (t === 'transactions') setTab('transactions')
    if (t === 'items') setTab('items')
  }, [searchParams])

  const reloadItems = async () => {
    try {
      if (!isAuthBootstrapped || !isAuthenticated) { setItems([]); return }
      const myItemsRes = await marketplaceApi.getMyItems()
      setItems((myItemsRes.data?.items || []) as MyItem[])
    } catch {}
  }

  // removed unused sellerPending calculation to satisfy noUnusedLocals

  return (
    <div className="container-responsive py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-fluid-3xl font-serif font-semibold">My Marketplace</h1>
        <div className="inline-flex rounded-lg border overflow-hidden">
          <button onClick={() => setTab('items')} className={`px-4 py-2 text-sm ${tab==='items'?'bg-ocean-600 text-white':'bg-white hover:bg-neutral-50'}`}>My Items</button>
          <button onClick={() => setTab('transactions')} className={`px-4 py-2 text-sm ${tab==='transactions'?'bg-ocean-600 text-white':'bg-white hover:bg-neutral-50'}`}>My Transactions</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="aspect-[4/3] skeleton-image" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-2/3 skeleton" />
                <div className="h-4 w-1/2 skeleton" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === 'items' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((it) => (
            <div key={it.id} className="card">
              <div className="w-full aspect-[4/3] bg-gray-100 rounded-lg mb-3 overflow-hidden">
                {it.images?.[0] && (
                  <img src={mediaUrl(it.images[0])} alt={it.title} loading="lazy" className="w-full h-full object-contain" />
                )}
              </div>
              <h3 className="font-semibold mb-1 truncate">{it.title}</h3>
              {it.description && (
                <p className="text-sm text-gray-600 mb-2 line-clamp-2 whitespace-pre-line">{it.description}</p>
              )}
              <div className="text-xs text-gray-600 mb-2 capitalize">{it.transaction_type}{it.transaction_type==='sell'&& it.price?` • ₱${Number(it.price).toLocaleString()}`:''}</div>
              <div className="flex items-center justify-between text-xs mb-3">
                <span className={`px-2 py-0.5 rounded-full ${it.status==='available'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{it.status}</span>
                <span className="text-gray-500">{(it.created_at || '').slice(0,10)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary flex-1"
                  onClick={() => {
                    setEditItem(it)
                    setEditForm({
                      title: it.title,
                      description: it.description || '',
                      price: it.price !== undefined ? String(it.price) : '',
                      images: Array.isArray(it.images) ? [...it.images] : [],
                    })
                    setUploadFiles([])
                  }}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger flex-1"
                  disabled={deletingId === it.id}
                  onClick={async () => {
                    if (!window.confirm('Delete this item? This cannot be undone.')) return
                    setDeletingId(it.id)
                    try {
                      await marketplaceApi.deleteItem(it.id)
                      setItems((prev) => prev.filter((p) => p.id !== it.id))
                      showToast('Item deleted', 'success')
                    } catch (e: any) {
                      const msg = e?.response?.data?.error || 'Failed to delete item'
                      showToast(msg, 'error')
                    } finally {
                      setDeletingId(null)
                    }
                  }}
                >
                  {deletingId === it.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="col-span-full text-center text-gray-600">You have no items yet.</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {txs.map((t) => (
            <div key={`${t.id}-${t.as || 'role'}`} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3 sm:flex-nowrap sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="font-medium capitalize truncate">{t.transaction_type}</div>
                <div className="text-xs text-gray-600">{(t.created_at || '').slice(0,10)} • {t.as === 'seller' ? 'You are the seller' : 'You are the buyer'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                <span className={`px-2 py-1 text-xs rounded-full ${t.status==='accepted'?'bg-emerald-50 text-emerald-700': (t.status==='awaiting_buyer'?'bg-blue-50 text-blue-700':'bg-amber-50 text-amber-700')}`}>{t.status}</span>
                {(t.status === 'accepted' || t.status === 'awaiting_buyer') && t.pickup_at && (
                  <span className="text-xs text-gray-600">Pickup: {new Date(t.pickup_at).toLocaleString()}</span>
                )}
                {(t.status === 'accepted' || t.status === 'awaiting_buyer') && (t as any).pickup_location && (
                  <span className="text-xs text-gray-600">Location: {(t as any).pickup_location}</span>
                )}
                {t.as === 'seller' && t.status === 'pending' && (
                  <>
                    <button
                      className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      disabled={acceptingId === t.id}
                      onClick={() => {
                        setAcceptingId(t.id)
                        setAcceptingTx(t)
                        setAcceptPickupAt(minPickupLocal)
                        setAcceptPickupLocation('')
                      }}
                    >
                      {acceptingId === t.id ? 'Accepting…' : 'Accept'}
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={async () => {
                        try {
                          await marketplaceApi.rejectTransaction(t.id)
                          setTxs((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'rejected' } : x))
                          showToast('Transaction rejected. Others can now request this item.', 'success')
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to reject transaction'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {t.as === 'buyer' && t.status === 'awaiting_buyer' && (
                  <>
                    <button
                      className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      onClick={async () => {
                        try {
                          await marketplaceApi.confirmTransaction(t.id)
                          setTxs((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'accepted' } : x))
                          showToast('You confirmed the pickup. Transaction accepted.', 'success')
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to confirm'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Confirm
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                      onClick={async () => {
                        try {
                          await marketplaceApi.buyerRejectProposal(t.id)
                          setTxs((prev) => prev.map((x) => x.id === t.id ? { ...x, status: 'rejected' } : x))
                          showToast('Proposal rejected. The item is available again.', 'success')
                        } catch (e: any) {
                          const msg = e?.response?.data?.error || 'Failed to reject'
                          showToast(msg, 'error')
                        }
                      }}
                    >
                      Reject
                    </button>
                  </>
                )}
                {t.as === 'seller' && t.status === 'accepted' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.handoverSeller(t.id)
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'handed_over' } : x))
                        showToast('Marked as handed over', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Handed over
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'handed_over' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.handoverBuyer(t.id)
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'received' } : x))
                        showToast('Received confirmed', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    I Received
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'received' && t.transaction_type !== 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.complete(t.id)
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'completed' } : x))
                        showToast('Transaction completed', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Complete
                  </button>
                )}
                {t.as === 'buyer' && t.status === 'received' && t.transaction_type === 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.returnBuyer(t.id)
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'returned' } : x))
                        showToast('Marked as returned', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Mark Returned
                  </button>
                )}
                {t.as === 'seller' && t.status === 'returned' && t.transaction_type === 'lend' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    onClick={async () => {
                      try {
                        await marketplaceApi.returnSeller(t.id)
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'completed' } : x))
                        showToast('Return confirmed', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Confirm Received Back
                  </button>
                )}
                <button
                  className="text-xs px-2 py-1 rounded border border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  onClick={async () => {
                    try {
                      const res = await marketplaceApi.getAudit(t.id)
                      const logs = (res.data?.audit || []) as any[]
                      setAuditOpen({ id: t.id, logs })
                    } catch {}
                  }}
                >
                  History
                </button>
                {t.status !== 'completed' && t.status !== 'cancelled' && t.status !== 'disputed' && (
                  <button
                    className="text-xs px-2 py-1 rounded border border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={async () => {
                      const reason = window.prompt('Describe the issue (required)') || ''
                      if (!reason.trim()) return
                      try {
                        await marketplaceApi.dispute(t.id, reason.trim())
                        setTxs(prev => prev.map(x => x.id === t.id ? { ...x, status: 'disputed' } : x))
                        showToast('Reported to admin', 'success')
                      } catch (e: any) {
                        const msg = e?.response?.data?.error || 'Failed to report'
                        showToast(msg, 'error')
                      }
                    }}
                  >
                    Report
                  </button>
                )}
              </div>
            </div>
          ))}
          {txs.length === 0 && (
            <div className="text-center text-gray-600">No transactions yet.</div>
          )}
        </div>
      )}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setEditItem(null) }}>
          <div className="bg-white rounded-xl w-full max-w-2xl p-6" tabIndex={-1} autoFocus>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Item</h2>
              <button onClick={() => setEditItem(null)} className="text-neutral-500 hover:text-neutral-700" aria-label="Close">
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Title</label>
                <input className="input-field" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea className="input-field" rows={4} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              {editItem.transaction_type === 'sell' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Price</label>
                  <input type="number" min="0" step="0.01" className="input-field" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label htmlFor="edit-images" className="block text-sm font-medium mb-1">Images</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {editForm.images.map((img, idx) => (
                    <div key={`${img}-${idx}`} className="relative">
                      <img src={mediaUrl(img)} className="w-20 h-20 rounded object-cover border" />
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-white border rounded-full p-1"
                        onClick={() => setEditForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))}
                        aria-label="Remove image"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <input id="edit-images" name="edit_images" className="input-field" type="file" accept="image/*" multiple onChange={(e) => setUploadFiles((prev) => {
                  const next = [...prev, ...Array.from(e.target.files || [])]
                  return next.slice(0,5)
                })} />
                {uploadFiles.length > 0 && (
                  <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {uploadFiles.map((f, i) => (
                      <div key={`${f.name}-${i}`} className="relative">
                        <img src={URL.createObjectURL(f)} className="w-20 h-20 rounded object-cover border" />
                        <button type="button" className="absolute -top-2 -right-2 bg-white border rounded-full p-1" aria-label="Remove image" onClick={() => setUploadFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setEditItem(null)}>Cancel</button>
              <button
                className="btn btn-primary"
                disabled={saving || !editForm.title}
                onClick={async () => {
                  if (!editItem) return
                  setSaving(true)
                  try {
                    const payload: any = { title: editForm.title }
                    if (editForm.description) payload.description = editForm.description
                    if (editItem.transaction_type === 'sell' && editForm.price !== undefined) payload.price = Number(editForm.price || 0)
                    // Persist image removals
                    payload.images = editForm.images
                    await marketplaceApi.updateItem(editItem.id, payload)
                    // Upload new files (respect remaining slots)
                    if (uploadFiles.length) {
                      const remaining = Math.max(0, 5 - (Array.isArray(editForm.images) ? editForm.images.length : 0))
                      const toUpload = uploadFiles.slice(0, remaining)
                      if (toUpload.length) {
                        const res2 = await marketplaceApi.uploadItemImages(editItem.id, toUpload)
                        const up = (res2 as any)?.data?.uploaded?.length || 0
                        const skipped = (((res2 as any)?.data?.errors || []) as any[]).length + Number(((res2 as any)?.data?.skipped_over_limit || 0))
                        if (skipped) {
                          showToast(`Uploaded ${up} image(s), ${skipped} skipped`, 'info')
                        }
                      } else {
                        showToast('Maximum images reached (5)', 'error')
                      }
                    }
                    await reloadItems()
                    showToast('Item updated', 'success')
                    setEditItem(null)
                  } catch (e: any) {
                    const msg = e?.response?.data?.error || 'Failed to update item'
                    showToast(msg, 'error')
                  } finally {
                    setSaving(false)
                  }
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept transaction modal */}
      <_AcceptModal
        tx={acceptingTx}
        value={acceptPickupAt || minPickupLocal}
        locationValue={acceptPickupLocation}
        min={minPickupLocal}
        onChange={setAcceptPickupAt}
        onChangeLocation={setAcceptPickupLocation}
        onCancel={() => { setAcceptingTx(null); setAcceptingId(null) }}
        onConfirm={async () => {
          if (!acceptingTx) return
          try {
            const isoUtc = new Date(acceptPickupAt || minPickupLocal).toISOString()
            await marketplaceApi.proposeTransaction(acceptingTx.id, { pickup_at: isoUtc, pickup_location: acceptPickupLocation })
            setTxs((prev) => prev.map((x) => x.id === acceptingTx.id ? { ...x, status: 'awaiting_buyer', pickup_at: isoUtc, pickup_location: acceptPickupLocation } : x))
            showToast('Pickup details proposed. Awaiting buyer confirmation.', 'success')
            setAcceptingTx(null)
            setAcceptingId(null)
          } catch (e: any) {
            const msg = e?.response?.data?.error || 'Failed to accept transaction'
            showToast(msg, 'error')
          }
        }}
      />
      {auditOpen && (
        <Modal
          isOpen={!!auditOpen}
          onClose={() => setAuditOpen(null)}
          title={`Transaction History`}
          footer={<button className="btn-secondary" onClick={() => setAuditOpen(null)}>Close</button>}
        >
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {(auditOpen.logs || []).map((l, i) => (
              <div key={i} className="text-sm flex items-start gap-2">
                <span className="text-gray-500 min-w-[11ch]">{(l.created_at || '').replace('T',' ').slice(0,19)}</span>
                <span className="font-medium capitalize">{l.action.replace(/_/g,' ')}</span>
                <span className="text-gray-600">{l.from_status} → {l.to_status}</span>
                {l.notes && <span className="text-gray-700">• {l.notes}</span>}
              </div>
            ))}
            {auditOpen.logs?.length ? null : <div className="text-sm text-gray-600">No history yet.</div>}
          </div>
        </Modal>
      )}
    </div>
  )
}

// Accept modal
// Rendered at end of component to avoid layout shifts
function _AcceptModal({ tx, value, locationValue, min, onChange, onChangeLocation, onCancel, onConfirm }: { tx: MyTx | null, value: string, locationValue: string, min: string, onChange: (v: string) => void, onChangeLocation: (v: string) => void, onCancel: () => void, onConfirm: () => void }) {
  if (!tx) return null
  return (
    <Modal
      isOpen={!!tx}
      onClose={onCancel}
      title="Schedule Pickup"
      footer={(
        <div className="flex items-center justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm}>Confirm</button>
        </div>
      )}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600">Select a pickup date and time for this transaction. This will be shared with the other party.</p>
        <label className="block text-sm font-medium mb-1">Pickup date & time</label>
        <input
          type="datetime-local"
          value={value}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <label className="block text-sm font-medium mb-1 mt-2">Pickup location</label>
        <input
          type="text"
          value={locationValue}
          placeholder="Enter pickup location (e.g., municipal hall lobby)"
          onChange={(e) => onChangeLocation(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
      </div>
    </Modal>
  )
}


