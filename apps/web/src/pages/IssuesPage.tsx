import { StatusBadge, Card, EmptyState } from '@munlink/ui'
import { useEffect, useMemo, useState } from 'react'
import GatedAction from '@/components/GatedAction'
import { useAppStore } from '@/lib/store'
import { issuesApi, mediaUrl, showToast } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import FileUploader from '@/components/ui/FileUploader'

type Issue = {
  id: string | number
  title: string
  description: string
  municipality?: string
  category?: string
  category_label?: string
  status: 'submitted' | 'under_review' | 'in_progress' | 'resolved' | 'closed' | 'rejected'
  created_at?: string
}

const statusLabel: Record<Issue['status'], string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  rejected: 'Rejected',
}

export default function IssuesPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const user = useAppStore((s) => s.user)
  const [issues, setIssues] = useState<Issue[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<any>({ category_id: '', title: '', description: '', specific_location: '', latitude: '', longitude: '' })
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [categories, setCategories] = useState<any[]>([])
  const [tab, setTab] = useState<'all' | 'mine'>('all')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [openId, setOpenId] = useState<string | number | null>(null)
  const isMismatch = !!(user as any)?.municipality_id && !!selectedMunicipality?.id && (user as any).municipality_id !== selectedMunicipality.id

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        // Load categories once
        if (categories.length === 0) {
          try { const c = await issuesApi.getCategories(); if (!cancelled) setCategories(c.data?.categories || []) } catch {}
        }
        if (tab === 'mine') {
          const res = await issuesApi.getMine()
          if (!cancelled) { setIssues(res.data?.issues || []); setPages(1); setPage(1) }
        } else {
          const params: any = { page }
          if (selectedMunicipality?.id) params.municipality_id = selectedMunicipality.id
          if (statusFilter !== 'all') params.status = statusFilter
          if (categoryFilter !== 'all') params.category = categoryFilter
          const res = await issuesApi.getAll(params)
          if (!cancelled) {
            setIssues(res.data?.issues || [])
            setPages(res.data?.pagination?.pages || 1)
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMunicipality?.id, statusFilter, categoryFilter, tab, page])

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return issues
    return issues.filter(i => i.status === statusFilter)
  }, [issues, statusFilter])

  return (
    <div className="container-responsive py-12">
      <div className="mb-3">
        <h1 className="text-fluid-3xl font-serif font-semibold">Community Issues</h1>
      </div>

      {isMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          You are viewing {selectedMunicipality?.name}. Reporting is limited to your registered municipality.
        </div>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-3">
          <p>Browse reported community issues. Viewing is open to everyone. To file a new report, create an account and get verified.</p>
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Status</label>
              <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Category</label>
              <select className="input-field" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All</option>
                {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
            <div className="md:ml-auto flex items-center gap-2">
              <div className="flex items-center gap-2">
                <button className={`btn ${tab==='all'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('all')}>All Issues</button>
                <button className={`btn ${tab==='mine'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('mine')}>My Reports</button>
              </div>
              <GatedAction
                required="fullyVerified"
                onAllowed={() => {
                  if (isMismatch) { alert('Reporting is limited to your registered municipality'); return }
                  setOpen(true)
                }}
                tooltip="Login required to use this feature"
              >
                <button className="btn btn-primary" disabled={isMismatch} title={isMismatch ? 'Reporting is limited to your municipality' : undefined}>Report an Issue</button>
              </GatedAction>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card h-40" />
          ))}
        </div>
      ) : (
        <>
          {filtered.length === 0 ? (
            <EmptyState title="No issues found" description="Adjust filters or check back later." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((i: any) => (
                <Card key={i.id}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold">{i.title}</h3>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={statusLabel[(i.status as Issue['status'])]} />
                      <button className="btn-ghost text-blue-700" onClick={() => setOpenId(openId===i.id?null:i.id)} aria-expanded={openId===i.id}>{openId===i.id? 'Hide':'View details'}</button>
                    </div>
                  </div>
                  <p className={`text-sm text-gray-700 mt-1 mb-2 ${openId===i.id ? '' : 'line-clamp-2'}`}>{i.description}</p>
                  {openId===i.id && (
                    <div className="mt-2 space-y-2">
                      <div className="text-xs text-gray-500">
                        {i.municipality || 'Zambales'}
                        {(() => {
                          const cat = i?.category_label || (i?.category && (i.category.name || i.category))
                          return cat ? ` • ${cat}` : ''
                        })()}
                      </div>
                      {!!(i.attachments && i.attachments.length) && (
                        <div className="mt-2 flex gap-2 overflow-x-auto">
                          {i.attachments.slice(0,5).map((p: string, idx: number) => (
                            <img key={idx} src={mediaUrl(p)} alt="attachment" className="h-16 w-16 object-contain rounded border bg-white" />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
          {tab==='all' && pages>1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button className="btn btn-secondary" disabled={page<=1} onClick={() => setPage(p => Math.max(1, p-1))}>Prev</button>
              <div className="text-sm">Page {page} / {pages}</div>
              <button className="btn btn-secondary" disabled={page>=pages} onClick={() => setPage(p => Math.min(pages, p+1))}>Next</button>
            </div>
          )}
        </>
      )}
      <Modal isOpen={open} onClose={() => { setOpen(false); setForm({ category_id: '', title: '', description: '' }); setCreatedId(null) }} title="Report an Issue">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select className="input-field" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">Select category</option>
              {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input className="input-field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea className="input-field" rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Address / Specific Location</label>
            <input className="input-field" placeholder="e.g., Sitio A, Barangay B (near landmark)" value={form.specific_location} onChange={(e) => setForm({ ...form, specific_location: e.target.value })} />
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className="input-field" placeholder="Latitude (optional)" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              <input className="input-field" placeholder="Longitude (optional)" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end">
            <button className="btn btn-primary" disabled={creating || !form.category_id || !form.title || !form.description} onClick={async () => {
              if (isMismatch) return
              setCreating(true)
              try {
                if (!form.specific_location.trim()) { showToast('Please enter the address or specific location.', 'error'); setCreating(false); return }
                const payload: any = { category_id: Number(form.category_id), title: form.title, description: form.description, specific_location: form.specific_location }
                if (form.latitude) payload.latitude = parseFloat(form.latitude)
                if (form.longitude) payload.longitude = parseFloat(form.longitude)
                const res = await issuesApi.create(payload)
                const id = res?.data?.issue?.id
                setCreatedId(id || null)
                showToast('Issue reported successfully', 'success')
              } finally {
                setCreating(false)
              }
            }}>{creating ? 'Submitting...' : 'Submit Report'}</button>
          </div>
          {createdId && (
            <div className="pt-2 border-t">
              <div className="text-sm mb-2">Upload evidence (optional)</div>
              <FileUploader accept="image/*,.pdf" multiple onFiles={async (files) => {
                const max = 5
                const toUpload = Array.from(files).slice(0, max)
                for (const f of toUpload) {
                  const formData = new FormData()
                  formData.set('file', f)
                  try {
                    await issuesApi.upload(createdId, formData)
                  } catch {}
                }
                setOpen(false)
              }} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}


