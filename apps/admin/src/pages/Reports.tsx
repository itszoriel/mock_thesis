import { useEffect, useMemo, useState } from 'react'
import { handleApiError, dashboardApi, userApi, marketplaceApi, announcementApi, documentsAdminApi } from '../lib/api'
import ExportArchive from '../components/reports/ExportArchive.tsx'
import AuditLogs from '../components/reports/AuditLogs.tsx'
import { AdminPageShell, AdminPageHeader } from '../components/layout/Page'

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<any>(null)
  const [range, setRange] = useState<string>('last_30_days')
  
  const [tab, setTab] = useState<'overview'|'export'|'audit'>('overview')

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const [dashRes, userRes, marketRes, annRes, docsRes, growthRes] = await Promise.allSettled([
          dashboardApi.getDashboardStats(),
          userApi.getUserStats(),
          marketplaceApi.getMarketplaceStats(),
          announcementApi.getAnnouncementStats(),
          documentsAdminApi.getStats(range),
          dashboardApi.getUserGrowth(range),
        ])

        const dashboard = dashRes.status === 'fulfilled' ? ((dashRes.value as any).data || dashRes.value) : undefined
        const users = userRes.status === 'fulfilled' ? ((userRes.value as any).data || userRes.value) : undefined
        const marketplace = marketRes.status === 'fulfilled' ? ((marketRes.value as any).data || marketRes.value) : undefined
        const announcements = annRes.status === 'fulfilled' ? ((annRes.value as any).data || annRes.value) : undefined
        const documents = docsRes.status === 'fulfilled' ? ((docsRes.value as any).data || docsRes.value) : undefined
        
        const usersGrowth = growthRes.status === 'fulfilled' ? ((growthRes.value as any).data || growthRes.value) : undefined
        if (mounted) setReport({ dashboard, users, marketplace, announcements, documents, usersGrowth })
      } catch (e: any) {
        setError(handleApiError(e))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [range])

  const metrics = useMemo(() => ([
    { label: 'Total Users', value: String(report?.users?.total_users ?? '—'), change: '+0%', trend: 'up', icon: '👥', color: 'ocean' },
    { label: 'Active Listings', value: String(report?.marketplace?.total_items ?? '—'), change: '+0%', trend: 'up', icon: '🛍️', color: 'forest' },
    // Backend returns { total_requests, top_requested }. Use total_requests as the displayed count
    { label: 'Documents Issued', value: String((report?.documents?.total_requests ?? report?.documents?.issued_total) ?? '—'), change: '+0%', trend: 'up', icon: '📄', color: 'purple' },
    { label: 'Active Announcements', value: String(report?.announcements?.active_announcements ?? '—'), change: '+0%', trend: 'up', icon: '📢', color: 'sunset' },
  ] as const), [report])
  const headerStats = useMemo(() => (
    loading
      ? [
          { label: 'Total Users', value: '…' },
          { label: 'Active Listings', value: '…' },
          { label: 'Documents Issued', value: '…' },
          { label: 'Active Announcements', value: '…' },
        ]
      : metrics.map((metric) => ({ label: metric.label, value: metric.value }))
  ), [loading, metrics])

  const documents = (report?.documents?.top_requested as any[]) || []

  
  const growth = ((report as any)?.usersGrowth?.series as any[]) || []

  return (
    <AdminPageShell>
      <AdminPageHeader
        overline="Admin • Reports"
        title="Reports & Analytics"
        description="Platform insights and performance metrics."
        stats={headerStats}
        actions={(
          <select
            name="reportRange"
            id="report-range"
            aria-label="Select report date range"
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-xl border border-neutral-200 bg-white/80 px-4 py-2 font-medium shadow-sm focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-500/20"
          >
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="last_90_days">Last 90 days</option>
            <option value="this_year">This Year</option>
          </select>
        )}
      />

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="mb-6 inline-flex rounded-xl border overflow-hidden">
        {(['overview','export','audit'] as const).map((t) => (
          <button key={t} onClick={()=> setTab(t)} className={`px-4 py-2 text-sm ${tab===t?'bg-ocean-600 text-white':'bg-white hover:bg-neutral-50'}`}>{t==='overview'?'Overview':t==='export'?'Export & Archive':'Audit Logs'}</button>
        ))}
      </div>
      <div className="mb-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {(loading ? [...Array(4)] : metrics).map((metric: any, i: number) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-lg hover:scale-105 transition-transform">
            {loading ? (
              <>
                <div className="h-12 w-12 skeleton rounded-xl mb-4" />
                <div className="h-6 w-24 skeleton rounded mb-2" />
                <div className="h-3 w-20 skeleton rounded" />
              </>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 bg-${metric.color}-100 rounded-xl flex items-center justify-center text-2xl`}>{metric.icon}</div>
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${metric.trend === 'up' ? 'bg-forest-100 text-forest-700' : 'bg-red-100 text-red-700'}`}>{metric.trend === 'up' ? '↑' : '↓'} {metric.change}</span>
                </div>
                <p className="text-3xl font-bold text-neutral-900 mb-1">{metric.value}</p>
                <p className="text-sm text-neutral-600">{metric.label}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {tab==='overview' && (
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl shadow-xl border border-white/50 bg-gradient-to-br from-ocean-600 via-ocean-500 to-forest-600">
          <div className="px-6 py-5 border-b border-white/20">
            <h2 className="text-xl font-bold text-white">User Growth</h2>
            <p className="text-sm text-white/80 mt-1">New registrations over time</p>
          </div>
          <div className="p-6 bg-white/10">
            {growth.length === 0 ? (
              <div className="h-64 rounded-2xl flex items-center justify-center text-sm text-white/80">No data</div>
            ) : (
              <div className="h-64 w-full">
                {(() => {
                  const padding = 24
                  const width = 640
                  const height = 240
                  const points = growth.map((g: any, i: number) => ({ x: i, y: Number(g.count || 0), label: g.day }))
                  const maxY = Math.max(1, ...points.map(p => p.y))
                  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0
                  const scaleX = (i: number) => padding + i * stepX
                  const scaleY = (v: number) => padding + (height - padding * 2) * (1 - (v / maxY))
                  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.x)} ${scaleY(p.y)}`).join(' ')
                  const areaD = `${pathD} L ${scaleX(points[points.length - 1]?.x || 0)} ${scaleY(0)} L ${scaleX(points[0]?.x || 0)} ${scaleY(0)} Z`
                  const ticks = 4
                  const yTicks = Array.from({ length: ticks + 1 }).map((_, i) => Math.round((maxY / ticks) * i))
                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                      <defs>
                        <linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                          <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                        </linearGradient>
                      </defs>
                      {yTicks.map((t, i) => (
                        <g key={i}>
                          <line x1={padding} y1={scaleY(t)} x2={width - padding} y2={scaleY(t)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                          <text x={8} y={scaleY(t) + 4} fontSize="10" fill="rgba(255,255,255,0.7)">{t}</text>
                        </g>
                      ))}
                      <path d={areaD} fill="url(#growth-fill)" />
                      <path d={pathD} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                      {points.map((p, i) => (
                        <circle key={i} cx={scaleX(p.x)} cy={scaleY(p.y)} r="3" fill="#fff" />
                      ))}
                      {points.length > 0 && (
                        <>
                          <text x={padding} y={height - 4} fontSize="10" fill="rgba(255,255,255,0.85)">{points[0].label}</text>
                          <text x={width - padding - 40} y={height - 4} fontSize="10" fill="rgba(255,255,255,0.85)" textAnchor="end">{points[points.length - 1].label}</text>
                        </>
                      )}
                    </svg>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl border border-white/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-neutral-200"><h2 className="text-xl font-bold text-neutral-900">Marketplace Activity</h2><p className="text-sm text-neutral-600 mt-1">Transaction type breakdown</p></div>
          <div className="p-6 space-y-4">
            {(() => {
              const stats = (report?.marketplace || {}) as any
              const total = Math.max(1, Number(stats.total_items || 0))
              const buckets = [
                { label: 'Pending', value: Number(stats.pending_items || 0), color: 'sunset' },
                { label: 'Approved', value: Number(stats.approved_items || 0), color: 'forest' },
                { label: 'Rejected', value: Number(stats.rejected_items || 0), color: 'red' },
              ]
              return buckets.map((item, i) => {
                const pct = Math.round((item.value / total) * 100)
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium text-neutral-700">{item.label}</span><span className="text-sm font-bold text-neutral-900">{item.value} ({pct}%)</span></div>
                    <div className="h-3 bg-neutral-100 rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 rounded-full transition-all duration-1000`} style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </div>
      )}

      <div className="mb-8 overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-xl backdrop-blur">
        <div className="px-6 py-5 border-b border-neutral-200"><h2 className="text-xl font-bold text-neutral-900">Document Requests</h2><p className="text-sm text-neutral-600 mt-1">Most requested documents</p></div>
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_,i)=> (<div key={i} className="h-28 skeleton rounded-2xl" />))}
            </div>
          ) : documents.length === 0 ? (
            <div className="text-sm text-neutral-600">No document requests in the selected range.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {documents.map((doc: any) => (
                <div key={doc.name} className="bg-neutral-50 rounded-2xl p-4 hover:bg-ocean-50 transition-colors">
                  <div className="flex items-start justify-between mb-3"><div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-2xl shadow-sm">📋</div><span className="text-2xl font-bold text-neutral-900">{doc.count}</span></div>
                  <h3 className="font-semibold text-sm text-neutral-900 mb-2">{doc.name}</h3>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      
      {tab==='export' && (
        <ExportArchive defaultRange={range} onRangeChange={setRange} />
      )}
      {tab==='audit' && (
        <AuditLogs />
      )}

      
    </AdminPageShell>
  )
}


