import { useState } from 'react'
import { exportAdminApi, mediaUrl, showToast, handleApiError } from '../../lib/api'

export default function ExportArchive({ defaultRange, onRangeChange }: { defaultRange: string; onRangeChange: (r: string)=>void }) {
  const [working, setWorking] = useState<string>('')
  const [range, setRange] = useState<string>(defaultRange)
  const [lastArchiveUrl, setLastArchiveUrl] = useState<string>('')
  const entities: Array<{ key: any; label: string; desc: string }> = [
    { key: 'users', label: 'Users', desc: 'All residents in your municipality' },
    { key: 'benefits', label: 'Benefits', desc: 'Active benefits and programs' },
    { key: 'requests', label: 'Document Requests', desc: 'Requests in selected range' },
    { key: 'issues', label: 'Issues', desc: 'Reported issues' },
    { key: 'items', label: 'Marketplace Items', desc: 'Uploaded items' },
    { key: 'announcements', label: 'Announcements', desc: 'Published announcements' },
  ]

  const run = async (entity: any, fmt: 'pdf'|'xlsx') => {
    setWorking(`${entity}.${fmt}`)
    try {
      const filters = { range }
      const res = fmt==='pdf' ? await exportAdminApi.exportPdf(entity, filters) : await exportAdminApi.exportExcel(entity, filters)
      const url = (res as any)?.url || (res as any)?.data?.url
      if (url) window.open(mediaUrl(url), '_blank')
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setWorking('')
    }
  }

  const [cleanupEntity, setCleanupEntity] = useState<'announcements'|'requests'|'users'|'benefits'|'issues'|'items'|''>('')
  const [cleanupBefore, setCleanupBefore] = useState<string>('')
  const [confirm, setConfirm] = useState<string>('')
  const [archive, setArchive] = useState<boolean>(true)

  const doCleanup = async () => {
    if (!cleanupEntity || confirm !== 'DELETE') return
    setWorking('cleanup')
    try {
      const res = await exportAdminApi.cleanup({ entity: cleanupEntity as any, before: cleanupBefore || undefined, confirm: 'DELETE', archive })
      const archivedUrl = (res as any)?.archived_url
      const msg = `Deleted ${((res as any)?.deleted_count) ?? 0}${archivedUrl ? ' • Archived' : ''}`
      showToast(msg, 'success')
      if (archivedUrl) {
        setLastArchiveUrl(archivedUrl)
        try { window.open(mediaUrl(archivedUrl), '_blank') } catch {}
      }
    } catch (e: any) {
      showToast(handleApiError(e), 'error')
    } finally {
      setWorking('')
      setConfirm('')
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <select value={range} onChange={(e)=> { setRange(e.target.value); onRangeChange(e.target.value) }} className="px-4 py-2 bg-white border rounded-lg text-sm">
          <option value="last_7_days">Last 7 days</option>
          <option value="last_30_days">Last 30 days</option>
          <option value="last_90_days">Last 90 days</option>
          <option value="this_year">This Year</option>
        </select>
        <span className="text-sm text-neutral-600">Select the range for time-based exports</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {entities.map((e) => (
          <div key={e.key} className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
            <div className="font-semibold mb-1">{e.label}</div>
            <div className="text-sm text-neutral-600 mb-4">{e.desc}</div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-lg bg-ocean-600 hover:bg-ocean-700 text-white text-sm disabled:opacity-60" disabled={working===`${e.key}.pdf`} onClick={()=> run(e.key, 'pdf')}>{working===`${e.key}.pdf`?'Generating…':'Export PDF'}</button>
              <button className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm disabled:opacity-60" disabled={working===`${e.key}.xlsx`} onClick={()=> run(e.key, 'xlsx')}>{working===`${e.key}.xlsx`?'Generating…':'Export Excel'}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-5 border border-white/50 shadow-lg">
        <div className="font-semibold mb-1">Archive & Cleanup</div>
        <div className="text-sm text-neutral-600 mb-4">Clear data after exporting to free up space. Type DELETE to confirm.</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium mb-1">Entity</label>
            <select value={cleanupEntity} onChange={(e)=> setCleanupEntity(e.target.value as any)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="">Select</option>
              <option value="announcements">Announcements</option>
              <option value="requests">Document Requests</option>
              <option value="users" disabled>Users (disabled)</option>
              <option value="benefits" disabled>Benefits (soon)</option>
              <option value="issues" disabled>Issues (soon)</option>
              <option value="items" disabled>Items (soon)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Delete before (ISO date)</label>
            <input type="datetime-local" className="w-full border rounded px-3 py-2 text-sm" value={cleanupBefore} onChange={(e)=> setCleanupBefore(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Confirm</label>
            <input placeholder="Type DELETE" className="w-full border rounded px-3 py-2 text-sm" value={confirm} onChange={(e)=> setConfirm(e.target.value)} />
          </div>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={archive} onChange={(e)=> setArchive(e.target.checked)} /> Archive before delete</label>
            <button className="ml-auto px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm disabled:opacity-60" disabled={!cleanupEntity || confirm!=='DELETE' || working==='cleanup'} onClick={doCleanup}>{working==='cleanup'?'Cleaning…':'Run Cleanup'}</button>
          </div>
          {lastArchiveUrl && (
            <div className="sm:col-span-2 lg:col-span-4 text-xs text-neutral-600 mt-1">
              Last archive: <a className="text-ocean-700 hover:underline" href={mediaUrl(lastArchiveUrl)} target="_blank" rel="noreferrer">Open</a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


