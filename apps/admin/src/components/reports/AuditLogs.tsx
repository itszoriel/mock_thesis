import { useEffect, useState } from 'react'
import apiClient, { auditAdminApi, exportAdminApi, mediaUrl, showToast } from '../../lib/api'

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [filters, setFilters] = useState<{ entity_type?: string; actor_role?: string; action?: string; from?: string; to?: string }>({})
  const [working, setWorking] = useState('')
  const [meta, setMeta] = useState<{ entity_types: string[]; actions: string[]; actor_roles: string[] }|null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await auditAdminApi.list({ ...filters, page, per_page: 20 })
      const data: any = (res as any)
      setLogs(data.logs || data.data?.logs || [])
      setPages(data.pages || 1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  useEffect(() => {
    let cancelled = false
    const fetchMeta = async () => {
      try {
        const res = await apiClient.get('/api/admin/audit/meta')
        const data: any = (res as any)?.data || res
        if (!cancelled) setMeta(data)
      } catch {
        // ignore; fall back to free-text inputs
      }
    }
    fetchMeta()
    return () => { cancelled = true }
  }, [])

  const exportIt = async (fmt: 'pdf'|'xlsx') => {
    setWorking(fmt)
    try {
      const res = fmt==='pdf' ? await exportAdminApi.exportPdf('audit', filters) : await exportAdminApi.exportExcel('audit', filters)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast('Export failed', 'error')
    } finally {
      setWorking('')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">Entity Type</label>
          {meta?.entity_types ? (
            <select className="border rounded px-3 py-2 text-sm" value={filters.entity_type||''} onChange={(e)=> setFilters(f=>({...f, entity_type: e.target.value||undefined}))}>
              <option value="">Any</option>
              {meta.entity_types.map((et)=> (<option key={et} value={et}>{et}</option>))}
            </select>
          ) : (
            <input className="border rounded px-3 py-2 text-sm" placeholder="e.g., document_request" value={filters.entity_type||''} onChange={(e)=> setFilters(f=>({...f, entity_type: e.target.value||undefined}))} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Actor Role</label>
          <select className="border rounded px-3 py-2 text-sm" value={filters.actor_role||''} onChange={(e)=> setFilters(f=>({...f, actor_role: e.target.value||undefined}))}>
            <option value="">Any</option>
            <option value="admin">admin</option>
            <option value="resident">resident</option>
            <option value="system">system</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Action</label>
          {meta?.actions ? (
            <select className="border rounded px-3 py-2 text-sm" value={filters.action||''} onChange={(e)=> setFilters(f=>({...f, action: e.target.value||undefined}))}>
              <option value="">Any</option>
              {meta.actions.map((a)=> (<option key={a} value={a}>{a}</option>))}
            </select>
          ) : (
            <input className="border rounded px-3 py-2 text-sm" placeholder="e.g., status_processing" value={filters.action||''} onChange={(e)=> setFilters(f=>({...f, action: e.target.value||undefined}))} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">From</label>
          <input type="datetime-local" className="border rounded px-3 py-2 text-sm" value={filters.from||''} onChange={(e)=> setFilters(f=>({...f, from: e.target.value||undefined}))} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">To</label>
          <input type="datetime-local" className="border rounded px-3 py-2 text-sm" value={filters.to||''} onChange={(e)=> setFilters(f=>({...f, to: e.target.value||undefined}))} />
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:self-end sm:justify-end">
          <button className="px-3 py-2 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-sm" onClick={()=> { setPage(1); load() }}>Apply</button>
          <button className="px-3 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60" disabled={working==='pdf'} onClick={()=> exportIt('pdf')}>{working==='pdf'?'Exporting…':'Export PDF'}</button>
          <button className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60" disabled={working==='xlsx'} onClick={()=> exportIt('xlsx')}>{working==='xlsx'?'Exporting…':'Export Excel'}</button>
        </div>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
        {loading ? (
          <div>Loading…</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-neutral-600">No audit entries.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-600">
                  <th className="p-2">Time</th>
                  <th className="p-2">Actor</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Entity</th>
                  <th className="p-2">ID</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className={i%2? 'bg-neutral-50':''}>
                    <td className="p-2">{String(l.created_at||'').replace('T',' ').slice(0,19)}</td>
                    <td className="p-2">{l.user_id||'—'}</td>
                    <td className="p-2">{l.actor_role||'—'}</td>
                    <td className="p-2">{l.entity_type}</td>
                    <td className="p-2">{l.entity_id||'—'}</td>
                    <td className="p-2">{String(l.action||'').replace(/_/g,' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2">
              <button className="px-3 py-1 rounded border" disabled={page<=1} onClick={()=> setPage(p=> Math.max(1, p-1))}>Prev</button>
              <div className="text-sm">Page {page} / {pages}</div>
              <button className="px-3 py-1 rounded border" disabled={page>=pages} onClick={()=> setPage(p=> p+1)}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


