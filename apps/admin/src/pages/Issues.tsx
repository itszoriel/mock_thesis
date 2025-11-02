import { useEffect, useState } from 'react'
import { issueApi, handleApiError, mediaUrl } from '../lib/api'

type Issue = {
  id: number
  title: string
  description: string
  status: string
  created_at?: string
  municipality_name?: string
  user?: { first_name?: string; last_name?: string }
  category?: { name?: string }
  category_label?: string
  attachments?: string[]
}

export default function Issues() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Issue[]>([])
  const [status, setStatus] = useState<'all' | 'pending' | 'in_progress' | 'resolved' | 'closed'>('all')
  const [category, setCategory] = useState<string>('all')
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await issueApi.getIssues({
          status: status === 'all' ? undefined : status,
          category: category === 'all' ? undefined : category,
          page: 1,
          per_page: 50,
        })
        const list = ((res as any)?.issues || (res as any)?.data?.issues || []) as Issue[]
        if (mounted) setItems(list)
      } catch (e: any) {
        setError(handleApiError(e))
        if (mounted) setItems([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [status, category])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await issueApi.getCategories()
        const list = ((res as any)?.categories || (res as any)?.data?.categories || []) as Array<{ id: number; name: string }>
        if (mounted) setCategories(list)
      } catch {
        if (mounted) setCategories([])
      }
    })()
    return () => { mounted = false }
  }, [])

  const updateStatus = async (id: number, next: 'pending' | 'in_progress' | 'resolved' | 'closed') => {
    try {
      setActionLoading(id)
      await issueApi.updateIssueStatus(id, next)
      setItems((prev) => prev.map((it) => it.id === id ? { ...it, status: next } : it))
    } catch (e: any) {
      alert(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900 mb-2">Issues</h1>
        <p className="text-neutral-600">Manage resident-submitted issues</p>
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 bg-neutral-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-neutral-900">Reported Issues</h2>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="inline-flex gap-2 overflow-x-auto">
              {['all','pending','in_progress','resolved','closed'].map((s) => (
                <button key={s} onClick={()=> setStatus(s as any)} className={`px-3 py-1.5 rounded-full text-sm font-medium ${status===s? 'bg-ocean-600 text-white' : 'bg-white border border-neutral-200 text-neutral-700'}`}>{s.replace('_',' ')}</button>
              ))}
            </div>
            <select
              className="px-3 py-1.5 rounded-full border border-neutral-200 text-sm font-medium bg-white"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
              ))}
            </select>
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
          {!loading && items.map((it) => (
            <div key={it.id} className="px-6 py-5 hover:bg-ocean-50/30 transition-colors">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 min-w-0">
                  <p className="font-bold text-neutral-900 mb-1 truncate">{it.title}</p>
                  <p className="text-sm text-neutral-700 line-clamp-2">{it.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    {(it.category?.name || it.category_label) && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-neutral-100 border border-neutral-200">{it.category?.name || it.category_label}</span>
                    )}
                  </div>
                  {it.attachments && it.attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {it.attachments.slice(0,3).map((a, idx) => (
                        <img key={idx} src={mediaUrl(a)} alt="Attachment" className="w-full h-16 object-contain rounded border bg-white" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{[it.user?.first_name, it.user?.last_name].filter(Boolean).join(' ') || 'Resident'}</p>
                  <p className="text-xs text-neutral-600">{it.municipality_name || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{(it.created_at || '').slice(0,10)}</p>
                  <p className="text-xs text-neutral-600">{it.status.replace('_',' ')}</p>
                </div>
                <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2 sm:justify-end">
                  {(['submitted','pending','under_review'].includes(it.status)) && (
                    <button onClick={()=> updateStatus(it.id, 'in_progress')} disabled={actionLoading===it.id} className="px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm disabled:opacity-60">{actionLoading===it.id? 'Updating…':'Mark In Progress'}</button>
                  )}
                  {it.status === 'in_progress' && (
                    <button onClick={()=> updateStatus(it.id, 'resolved')} disabled={actionLoading===it.id} className="px-3 py-1.5 rounded-lg bg-forest-100 hover:bg-forest-200 text-forest-700 text-sm disabled:opacity-60">{actionLoading===it.id? 'Updating…':'Mark Resolved'}</button>
                  )}
                  {it.status === 'resolved' && (
                    <button
                      onClick={()=> { if (window.confirm('Close this issue? This will finalize the issue and prevent further status changes.')) updateStatus(it.id, 'closed') }}
                      disabled={actionLoading===it.id}
                      className="px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-neutral-300 text-neutral-800 text-sm disabled:opacity-60"
                    >
                      {actionLoading===it.id? 'Updating…':'Close Issue'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


