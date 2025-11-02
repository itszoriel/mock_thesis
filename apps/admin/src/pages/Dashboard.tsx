import { useEffect, useMemo, useState } from 'react'
import { adminApi, handleApiError, userApi, issueApi, marketplaceApi, announcementApi, showToast } from '../lib/api'
import UserVerificationList from '../components/UserVerificationList'
import { useNavigate } from 'react-router-dom'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'
import { StatCard, Card, Button, Select } from '@munlink/ui'
import { Hand, Users, AlertTriangle, ShoppingBag, Megaphone } from 'lucide-react'

type ActivityItem = { icon: string; text: string; who?: string; ts: number; color: 'ocean'|'forest'|'sunset'|'purple'|'red' }
type OverviewItem = { label: string; value: number; max: number; color: 'ocean'|'forest'|'sunset'|'red' }

export default function Dashboard() {
  const user = useAdminStore((state: AdminState) => state.user)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dash, setDash] = useState<{ pending_verifications?: number; active_issues?: number; marketplace_items?: number; announcements?: number } | null>(null)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [overview, setOverview] = useState<OverviewItem[]>([
    { label: 'Verifications', value: 0, max: 50, color: 'ocean' },
    { label: 'Documents', value: 0, max: 100, color: 'forest' },
    { label: 'Marketplace', value: 0, max: 50, color: 'sunset' },
    { label: 'Issues', value: 0, max: 50, color: 'red' },
  ])
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([])
  const [activityExpanded, setActivityExpanded] = useState(false)
  const [overviewExpanded, setOverviewExpanded] = useState(false)

  const adminMunicipalityId = useMemo(() => {
    const raw = user?.admin_municipality_id ?? user?.municipality_id
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [user?.admin_municipality_id, user?.municipality_id])

  // Map color token to explicit Tailwind gradient classes so JIT includes them
  const gradientClass = (color: 'ocean'|'forest'|'sunset'|'red') => {
    switch (color) {
      case 'ocean': return 'from-ocean-400 to-ocean-600'
      case 'forest': return 'from-forest-400 to-forest-600'
      case 'sunset': return 'from-sunset-400 to-sunset-600'
      case 'red': return 'from-red-400 to-red-600'
      default: return 'from-neutral-400 to-neutral-600'
    }
  }

  // Quick actions removed per design update

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        // Prefer admin reports; fallback to dashboard stats is implemented inside adminApi.getReports
        const data = await adminApi.getReports()
        const d = (data?.dashboard || data) as any
        if (mounted) setDash({
          pending_verifications: d?.pending_verifications ?? 0,
          active_issues: d?.active_issues ?? 0,
          marketplace_items: d?.marketplace_items ?? 0,
          announcements: d?.announcements ?? 0,
        })
      } catch (e: any) {
        const msg = handleApiError(e)
        setError(msg)
        showToast(msg, 'error')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  // Refresh stats when a verification action occurs
  const reloadStats = async () => {
    try {
      const data = await adminApi.getReports()
      const d = (data?.dashboard || data) as any
      setDash({
        pending_verifications: d?.pending_verifications ?? 0,
        active_issues: d?.active_issues ?? 0,
        marketplace_items: d?.marketplace_items ?? 0,
        announcements: d?.announcements ?? 0,
      })
    } catch {}
  }

  // Load recent activity and overview series
  const loadActivity = async () => {
    try {
      const [pendingUsersRes, issuesRes, itemsRes, announcementsRes, marketStatsRes] = await Promise.allSettled([
        userApi.getPendingUsers(),
        issueApi.getIssues({ page: 1, per_page: 20 }),
        marketplaceApi.listPublicItems({ page: 1, per_page: 20 }),
        announcementApi.getAnnouncements(),
        marketplaceApi.getMarketplaceStats(),
      ])

      const matchesMunicipality = (record: any): boolean => {
        if (!adminMunicipalityId) return true
        const value = record?.municipality_id ?? record?.municipality?.id ?? record?.admin_municipality_id
        const parsed = Number(value)
        return Number.isFinite(parsed) && parsed === adminMunicipalityId
      }

      const pendingUsersRaw = pendingUsersRes.status === 'fulfilled' ? ((pendingUsersRes.value as any)?.data?.users || (pendingUsersRes.value as any)?.users || []) : []
      const issuesRaw = issuesRes.status === 'fulfilled' ? ((issuesRes.value as any)?.data?.data || (issuesRes.value as any)?.data || (issuesRes.value as any)?.issues || []) : []
      const itemsRaw = itemsRes.status === 'fulfilled' ? (((itemsRes.value as any)?.data?.data?.items) || (itemsRes.value as any)?.data?.items || (itemsRes.value as any)?.items || []) : []
      const announcementsRaw = announcementsRes.status === 'fulfilled' ? (((announcementsRes.value as any)?.data?.announcements) || (announcementsRes.value as any)?.announcements || []) : []

      const pendingUsers = Array.isArray(pendingUsersRaw) ? pendingUsersRaw.filter(matchesMunicipality) : []
      const issues = Array.isArray(issuesRaw) ? issuesRaw.filter(matchesMunicipality) : []
      const items = Array.isArray(itemsRaw) ? itemsRaw.filter(matchesMunicipality) : []
      const announcements = Array.isArray(announcementsRaw) ? announcementsRaw.filter(matchesMunicipality) : []
      setRecentAnnouncements(announcements.slice(0, 3))

      // Update top-level counts as a fallback if dashboard stats are zero/missing
      const marketStats = marketStatsRes.status === 'fulfilled' ? ((marketStatsRes.value as any)?.data || marketStatsRes.value) : undefined
      const totalMarket = marketStats?.total_items ?? marketStats?.approved_items ?? items.length
      const pendingCount = Array.isArray(pendingUsers) ? pendingUsers.length : 0
      const activeIssuesCount = Array.isArray(issues)
        ? issues.filter((it: any) => {
            const s = String(it.status || it.state || '').toLowerCase()
            return s.includes('active') || s.includes('in_progress') || s.includes('under') || s === ''
          }).length
        : 0
      setDash((prev) => ({
        pending_verifications: pendingCount || prev?.pending_verifications || 0,
        active_issues: activeIssuesCount || prev?.active_issues || 0,
        marketplace_items: typeof totalMarket === 'number' ? totalMarket : (prev?.marketplace_items ?? 0),
        announcements: announcements.length || prev?.announcements || 0,
      }))

      // Build feed
      const feed: ActivityItem[] = []
      for (const u of pendingUsers) {
        const ts = new Date(u.created_at || u.updated_at || Date.now()).getTime()
        feed.push({ icon: '👥', text: 'New registration', who: `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(), ts, color: 'ocean' })
      }
      for (const i of issues) {
        const ts = new Date(i.created_at || i.updated_at || Date.now()).getTime()
        feed.push({ icon: '⚠️', text: `Issue: ${i.title ?? i.category ?? 'New issue'}`, who: i.created_by_name, ts, color: 'red' })
      }
      for (const it of items) {
        const ts = new Date(it.created_at || it.updated_at || Date.now()).getTime()
        feed.push({ icon: '🛍️', text: `Marketplace: ${it.title ?? 'New item'}`, who: it.seller_name, ts, color: 'sunset' })
      }
      for (const a of announcements) {
        const ts = new Date(a.created_at || a.updated_at || Date.now()).getTime()
        feed.push({ icon: '📢', text: `Announcement: ${a.title ?? 'New announcement'}`, who: a.created_by_name, ts, color: 'purple' })
      }

      feed.sort((a, b) => b.ts - a.ts)
      setActivity(feed.slice(0, 10))

      // Overview for last 7 days
      const since = Date.now() - 7 * 24 * 60 * 60 * 1000
      const in7 = (d?: any) => new Date(d || Date.now()).getTime() >= since
      const verifications7 = pendingUsers.filter((u: any) => in7(u.created_at)).length
      const documents7 = 0 // Placeholder: no admin documents endpoint; keep 0 for now
      const marketplace7 = items.filter((it: any) => in7(it.created_at)).length
      const issues7 = issues.filter((i: any) => in7(i.created_at)).length
      const overviewData: OverviewItem[] = [
        { label: 'Verifications', value: verifications7, max: Math.max(10, verifications7), color: 'ocean' },
        { label: 'Documents', value: documents7, max: Math.max(10, documents7 || 10), color: 'forest' },
        { label: 'Marketplace', value: marketplace7, max: Math.max(10, marketplace7), color: 'sunset' },
        { label: 'Issues', value: issues7, max: Math.max(10, issues7), color: 'red' },
      ]
      setOverview(overviewData.slice(0, 10))
    } catch (err: any) {
      setActivity([])
      showToast(handleApiError(err), 'error')
    }
  }

  // Combined reload for polling
  const reloadAll = async () => {
    await Promise.allSettled([reloadStats(), loadActivity()])
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      await loadActivity()
    })()
    const id = window.setInterval(() => { if (mounted) reloadAll() }, 30000)
    return () => { mounted = false; window.clearInterval(id) }
  }, [])

  // KPI cards rendered via shared StatCard

  const timeAgo = (ts: number) => {
    const diff = Math.max(0, Date.now() - ts)
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hour${hrs>1?'s':''} ago`
    const days = Math.floor(hrs / 24)
    return `${days} day${days>1?'s':''} ago`
  }

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const visibleActivity = activityExpanded ? activity.slice(0, 10) : activity.slice(0, 5)
  const visibleOverview = overviewExpanded ? overview.slice(0, 10) : overview.slice(0, 5)

  function IconFromCode({ code, className }: { code: string; className?: string }) {
    if (code === '👥') return <Users className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '⚠️') return <AlertTriangle className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '🛍️') return <ShoppingBag className={className || 'w-5 h-5'} aria-hidden="true" />
    if (code === '📢') return <Megaphone className={className || 'w-5 h-5'} aria-hidden="true" />
    return <Users className={className || 'w-5 h-5'} aria-hidden="true" />
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="py-8">
        <div className="container-responsive space-y-8">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/80 text-red-700 px-4 py-3 text-sm shadow-sm">{error}</div>
          )}
          {/* Welcome Banner */}
          <div className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-ocean-500 via-ocean-400 to-forest-500 text-white shadow-xl">
            <div className="absolute -top-20 -right-16 w-64 h-64 bg-white/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-black/10 rounded-full blur-3xl" />
            <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
                  Admin Portal <span className="text-white/70">•</span> {dateStr}
                </span>
                <h1 className="text-3xl sm:text-4xl font-serif font-semibold flex items-center gap-3">
                  Hey {user?.first_name}! <Hand className="h-8 w-8" aria-hidden="true" />
                </h1>
                <p className="text-white/85 text-lg max-w-xl">You are managing {user?.admin_municipality_name || 'Zambales Province'}. Here’s what’s happening today.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 min-w-[220px]">
                {[
                  { label: 'Residents', value: dash?.pending_verifications ?? 0 },
                  { label: 'Issues', value: dash?.active_issues ?? 0 },
                  { label: 'Marketplace', value: dash?.marketplace_items ?? 0 },
                  { label: 'Announcements', value: dash?.announcements ?? 0 },
                ].map((stat, i) => (
                  <div key={i} className="rounded-2xl bg-white/15 px-4 py-3 text-center shadow-sm">
                    <p className="text-lg font-semibold">{loading ? '…' : stat.value}</p>
                    <p className="text-xs uppercase tracking-wide text-white/70">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Pending Verifications" value={loading ? '…' : (dash?.pending_verifications ?? 0)} />
            <StatCard title="Active Issues" value={loading ? '…' : (dash?.active_issues ?? 0)} />
            <StatCard title="Marketplace Items" value={loading ? '…' : (dash?.marketplace_items ?? 0)} />
            <StatCard title="Announcements" value={loading ? '…' : (dash?.announcements ?? 0)} />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* Left - Pending Verifications */}
            <Card className="xl:col-span-2" title={<span className="text-xl font-semibold text-neutral-900">Pending User Verifications</span>} subtitle="Review and approve user registrations" actions={<Button variant="secondary" size="sm" onClick={() => navigate('/residents')}>View All</Button>}>
              <UserVerificationList 
                onUserVerified={reloadStats} 
                onUserRejected={reloadStats}
                onReview={(u)=>navigate(`/residents?open=${u.id}`)}
              />
            </Card>

            {/* Right - Announcements */}
            <Card title={<span className="text-xl font-semibold text-neutral-900">Announcements</span>} subtitle="Create and manage public announcements">
              <Button variant="primary" fullWidth className="mb-4" onClick={() => navigate('/announcements')}>+ Create Announcement</Button>
              {recentAnnouncements.length > 0 ? (
                <div className="space-y-3">
                  {recentAnnouncements.map((a, i) => (
                    <div key={`${a.id}-${i}`} className="p-3 rounded-xl border bg-white/80 backdrop-blur">
                      <div className="text-sm font-medium truncate">{a.title}</div>
                      <div className="text-xs text-neutral-600 truncate">{(a.content || '').slice(0, 120)}</div>
                      <div className="text-xs text-neutral-500 mt-1">{(a.created_at || '').slice(0,10)}</div>
                    </div>
                  ))}
                  <Button variant="secondary" fullWidth onClick={() => navigate('/announcements')}>View All</Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-100 rounded-2xl mb-4">
                    <Megaphone className="w-8 h-8" aria-hidden="true" />
                  </div>
                  <h3 className="font-bold text-neutral-900 mb-2">No announcements</h3>
                  <p className="text-sm text-neutral-600">Create your first announcement to get started.</p>
                </div>
              )}
            </Card>
          </div>

          {/* Additional Sections */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* Recent Activity */}
            <Card title={<span className="text-xl font-semibold text-neutral-900">Recent Activity</span>}>
              <div className="space-y-4">
                {visibleActivity.map((a, i) => (
                  <div key={`${a.text}-${a.ts}-${i}`} className="flex items-start gap-3 p-3 bg-neutral-50/80 rounded-xl hover:bg-neutral-100 transition-colors">
                    <div className={`w-10 h-10 bg-${a.color}-100/80 rounded-lg flex items-center justify-center text-lg flex-shrink-0`}>
                      <IconFromCode code={a.icon} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-900 font-medium mb-1">{a.text}</p>
                      <p className="text-xs text-neutral-600">{a.who || 'System'} • {timeAgo(a.ts)}</p>
                    </div>
                  </div>
                ))}
                {activity.length === 0 && (
                  <div className="text-sm text-neutral-600">No recent activity.</div>
                )}
                {activity.length > 5 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setActivityExpanded((prev) => !prev)}
                  >
                    {activityExpanded ? 'Show Less' : 'View All'}
                  </Button>
                )}
              </div>
            </Card>

            {/* Activity Overview */}
            <Card title={<span className="text-xl font-bold">Activity Overview</span>} actions={(
              <Select name="activityRange" aria-label="Select activity date range" className="px-3 py-1.5" onChange={(_e)=>{ /* no-op placeholder; data already polls */ }}>
                <option>Last 7 days</option>
                <option>Last 30 days</option>
                <option>Last 90 days</option>
              </Select>
            )}>
              <div className="space-y-4">
                {visibleOverview.map((item, i) => (
                  <div key={`${item.label}-${i}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-neutral-700">{item.label}</span>
                      <span className="text-sm font-bold text-neutral-900">{item.value}</span>
                    </div>
                    <div className="h-3 bg-neutral-100 rounded-full overflow-hidden">
                      {(() => {
                        const pct = Math.min(100, Math.max(0, (item.max ? (item.value / item.max) * 100 : 0)))
                        return (
                          <div
                            className={`h-full bg-gradient-to-r ${gradientClass(item.color)} rounded-full transition-[width] duration-700 ease-out`}
                            style={{ width: `${pct}%` }}
                          />
                        )
                      })()}
                    </div>
                  </div>
                ))}
                {overview.length > 5 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setOverviewExpanded((prev) => !prev)}
                  >
                    {overviewExpanded ? 'Show Less' : 'View All'}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}


