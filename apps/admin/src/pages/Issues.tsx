import { useEffect, useMemo, useState } from 'react'
import { issueApi, handleApiError, mediaUrl } from '../lib/api'
import { AdminPageShell, AdminPageHeader, AdminSection } from '../components/layout/Page'

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

  const statusCounts = useMemo(() => {
    const counters = {
      all: items.length,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0,
    }
    for (const issue of items) {
      const raw = String(issue.status || '').toLowerCase()
      if (raw === 'pending' || raw === 'submitted' || raw === 'under_review') counters.pending += 1
      else if (raw === 'in_progress') counters.in_progress += 1
      else if (raw === 'resolved') counters.resolved += 1
      else if (raw === 'closed') counters.closed += 1
    }
    return counters
  }, [items])

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
    <AdminPageShell>
      <AdminPageHeader
        overline="Admin • Community Care"
        title="Issues"
        description="Monitor community concerns and keep resolutions moving." 
        stats={[
          { label: 'Total Issues', value: statusCounts.all },
          { label: 'Pending', value: statusCounts.pending },
          { label: 'In Progress', value: statusCounts.in_progress },
          { label: 'Resolved', value: statusCounts.resolved },
        ]}
      />

      <AdminSection
        title="Reported Issues"
        description="Filter by status or category to triage community requests."
        actions={(
          <select
            className="rounded-lg border border-white/80 bg-white/80 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
            ))}
          </select>
        )}
        padding="none"
      >
        <div className="border-b border-white/60 bg-neutral-50/60 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'pending', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${status === s ? 'bg-ocean-600 text-white shadow' : 'bg-white/80 text-neutral-700 hover:bg-neutral-100'}`}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="px-6 py-3 text-sm text-red-700">{error}</div>}
        <div className="divide-y divide-neutral-200">
          {loading && (
            <div className="px-6 py-6">
              <div className="mb-4 h-6 w-40 skeleton rounded" />
              <div className="space-y-2">{[...Array(5)].map((_, i) => (<div key={i} className="h-16 skeleton rounded" />))}</div>
            </div>
          )}
          {!loading && items.map((it) => (
            <div key={it.id} className="px-6 py-5 transition-colors hover:bg-ocean-50/30">
              <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-12">
                <div className="min-w-0 sm:col-span-5">
                  <p className="mb-1 truncate font-bold text-neutral-900">{it.title}</p>
                  <p className="text-sm text-neutral-700 line-clamp-2">{it.description}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    {(it.category?.name || it.category_label) && (
                      <span className="inline-flex items-center rounded-full border border-neutral-200 bg-neutral-100 px-2 py-0.5">{it.category?.name || it.category_label}</span>
                    )}
                  </div>
                  {it.attachments && it.attachments.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {it.attachments.slice(0, 3).map((a, idx) => (
                        <img key={idx} src={mediaUrl(a)} alt="Attachment" className="h-16 w-full rounded border bg-white object-contain" />
                      ))}
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{[it.user?.first_name, it.user?.last_name].filter(Boolean).join(' ') || 'Resident'}</p>
                  <p className="text-xs text-neutral-600">{it.municipality_name || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-neutral-700">{(it.created_at || '').slice(0, 10)}</p>
                  <p className="text-xs text-neutral-600">{it.status.replace('_', ' ')}</p>
                </div>
                <div className="flex flex-col gap-2 sm:col-span-3 sm:flex-row sm:justify-end">
                  {(['submitted', 'pending', 'under_review'].includes(it.status)) && (
                    <button
                      onClick={() => updateStatus(it.id, 'in_progress')}
                      disabled={actionLoading === it.id}
                      className="rounded-lg bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-200 disabled:opacity-60"
                    >
                      {actionLoading === it.id ? 'Updating…' : 'Mark In Progress'}
                    </button>
                  )}
                  {it.status === 'in_progress' && (
                    <button
                      onClick={() => updateStatus(it.id, 'resolved')}
                      disabled={actionLoading === it.id}
                      className="rounded-lg bg-forest-100 px-3 py-1.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-200 disabled:opacity-60"
                    >
                      {actionLoading === it.id ? 'Updating…' : 'Mark Resolved'}
                    </button>
                  )}
                  {it.status === 'resolved' && (
                    <button
                      onClick={() => { if (window.confirm('Close this issue? This will finalize the issue and prevent further status changes.')) updateStatus(it.id, 'closed') }}
                      disabled={actionLoading === it.id}
                      className="rounded-lg bg-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-300 disabled:opacity-60"
                    >
                      {actionLoading === it.id ? 'Updating…' : 'Close Issue'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </AdminSection>
    </AdminPageShell>
  )
}


