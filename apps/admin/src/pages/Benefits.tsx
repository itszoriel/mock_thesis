import { useEffect, useMemo, useState } from 'react'
import { benefitsApi, benefitsAdminApi, handleApiError, showToast } from '../lib/api'
import { useAdminStore } from '../lib/store'
import type { AdminState } from '../lib/store'
import { Modal, Button } from '@munlink/ui'
import { ClipboardList, Users, Hourglass, CheckCircle } from 'lucide-react'
import { AdminPageShell, AdminPageHeader } from '../components/layout/Page'

type EligibilityEntry = { label: string; description: string }

const ELIGIBILITY_LABEL_KEYS = ['label', 'title', 'heading', 'name']
const ELIGIBILITY_TEXT_KEYS = ['description', 'text', 'value', 'details', 'info']

const formatEligibilityKey = (key: string): string =>
  key
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase())

const parseEligibilityEntries = (raw: any): EligibilityEntry[] => {
  const entries: EligibilityEntry[] = []

  const push = (label: string, description: string) => {
    const trimmedLabel = (label || '').trim()
    const trimmedDesc = (description || '').trim()
    if (!trimmedLabel && !trimmedDesc) return
    entries.push({ label: trimmedLabel, description: trimmedDesc })
  }

  const walk = (value: any) => {
    if (value == null) return
    if (Array.isArray(value)) {
      value.forEach((item) => walk(item))
      return
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return
      const colonIndex = trimmed.indexOf(':')
      if (colonIndex > -1 && colonIndex < trimmed.length - 1) {
        push(trimmed.slice(0, colonIndex), trimmed.slice(colonIndex + 1))
      } else {
        push('', trimmed)
      }
      return
    }
    if (typeof value === 'number') {
      push('', String(value))
      return
    }
    if (typeof value === 'boolean') {
      push('', value ? 'Yes' : 'No')
      return
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, any>
      const labelCandidate = ELIGIBILITY_LABEL_KEYS.find((key) => {
        const candidate = obj[key]
        return typeof candidate === 'string' && candidate.trim().length > 0
      })
      const textCandidate = ELIGIBILITY_TEXT_KEYS.find((key) => {
        const candidate = obj[key]
        return typeof candidate === 'string' && candidate.trim().length > 0
      })

      if (labelCandidate || textCandidate) {
        push(
          labelCandidate ? String(obj[labelCandidate]) : '',
          textCandidate ? String(obj[textCandidate]) : ''
        )
      }

      Object.keys(obj).forEach((key) => {
        if (ELIGIBILITY_LABEL_KEYS.includes(key) || ELIGIBILITY_TEXT_KEYS.includes(key)) return
        const child = obj[key]
        if (typeof child === 'string') {
          const trimmed = child.trim()
          if (trimmed) push(formatEligibilityKey(key), trimmed)
        } else if (typeof child === 'number') {
          push(formatEligibilityKey(key), String(child))
        } else if (typeof child === 'boolean') {
          push(formatEligibilityKey(key), child ? 'Yes' : 'No')
        } else if (child != null) {
          walk(child)
        }
      })

      return
    }
  }

  walk(raw)
  return entries
}

const eligibilityEntriesToDisplay = (raw: any): string[] =>
  parseEligibilityEntries(raw).map((entry) =>
    entry.label && entry.description
      ? `${entry.label}: ${entry.description}`
      : entry.label || entry.description
  )

const buildEligibilityPayload = (entries: EligibilityEntry[]): any => {
  const trimmed = entries
    .map((entry) => ({ label: entry.label.trim(), description: entry.description.trim() }))
    .filter((entry) => entry.label || entry.description)

  if (trimmed.length === 0) return []

  const allHaveLabel = trimmed.every((entry) => entry.label)
  const allWithoutLabel = trimmed.every((entry) => !entry.label)

  if (allHaveLabel) {
    return trimmed.reduce<Record<string, string>>((acc, entry) => {
      acc[entry.label] = entry.description || ''
      return acc
    }, {})
  }

  if (allWithoutLabel) {
    return trimmed.map((entry) => entry.description)
  }

  return trimmed.map((entry) => ({
    ...(entry.label ? { label: entry.label } : {}),
    description: entry.description || '',
  }))
}

export default function Benefits() {
  const [activeTab, setActiveTab] = useState<'active' | 'applications' | 'archived'>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null)
  const [activeCount, setActiveCount] = useState<number>(0)
  const [beneficiariesTotal, setBeneficiariesTotal] = useState<number | null>(null)
  const [viewProgram, setViewProgram] = useState<any | null>(null)
  const [viewApplicants, setViewApplicants] = useState<{ program: any; applications: any[] } | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const adminMunicipalityId = useAdminStore((state: AdminState) => state.user?.admin_municipality_id ?? state.user?.municipality_id ?? null)

  const normalizeProgram = (program: any) => {
    if (!program) return null
    const rawStatus = program.status ?? (program.is_active === false ? 'completed' : 'active')
    const statusLower = typeof rawStatus === 'string' ? rawStatus.toLowerCase() : rawStatus
    const status = statusLower === 'archived' ? 'completed' : statusLower
    const requiredList = Array.isArray(program.required_documents)
      ? program.required_documents
      : (Array.isArray(program.requirements) ? program.requirements : [])
    const beneficiaries = Number(program.current_beneficiaries ?? program.beneficiaries ?? 0)
    const eligibilityDisplay = eligibilityEntriesToDisplay(program.eligibility_criteria)
    const eligibilityEntries = parseEligibilityEntries(program.eligibility_criteria)
    return {
      id: program.id,
      code: program.code,
      title: program.title || program.name || 'Program',
      name: program.name ?? program.title ?? 'Program',
      description: program.description || program.summary || '—',
      beneficiaries: Number.isFinite(beneficiaries) ? beneficiaries : 0,
      duration_days: program.duration_days ?? null,
      completed_at: program.completed_at || null,
      is_active: status === 'active',
      status,
      icon: '📋',
      color: 'ocean',
      required_documents: requiredList,
      eligibility_criteria: program.eligibility_criteria,
      eligibility_entries: eligibilityEntries,
      eligibility_display: eligibilityDisplay,
      program_type: program.program_type,
      raw: program,
    }
  }

  useEffect(() => {
    const active = programs.filter((item: any) => (item?.status ?? (item?.is_active ? 'active' : 'completed')) === 'active').length
    setActiveCount(active)
    const total = programs.reduce((sum: number, item: any) => {
      const value = Number(item?.beneficiaries ?? 0)
      return sum + (Number.isFinite(value) ? value : 0)
    }, 0)
    setBeneficiariesTotal(Number.isFinite(total) ? total : null)
  }, [programs])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        // Prefer admin-scoped list when authenticated
        let list: any[] = []
        try {
          const resAdmin = await benefitsAdminApi.listPrograms()
          list = ((resAdmin as any)?.programs as any[]) || []
        } catch {
          const res = await benefitsApi.getPrograms(adminMunicipalityId ?? undefined)
          list = ((res as any)?.programs as any[]) || []
        }
        const mapped = list.map((p) => normalizeProgram(p)).filter(Boolean)
        if (mounted) {
          setPrograms(mapped as any[])
        }
      } catch (e: any) {
        // Not fatal if benefits aren't available; show empty state and error banner
        setError(handleApiError(e))
        if (mounted) setPrograms([])
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [adminMunicipalityId])

  // Load applications when Applications tab active
  useEffect(() => {
    let mounted = true
    if (activeTab !== 'applications') return () => { mounted = false }
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const res = await benefitsAdminApi.listApplications()
        const apps = (res as any)?.applications || (res as any)?.data?.applications || []
        if (mounted) {
          setApplications(Array.isArray(apps) ? apps : [])
          const total = (res as any)?.pagination?.total ?? (apps?.length ?? 0)
          setApplicationsCount(typeof total === 'number' ? total : 0)
        }
      } catch (e: any) {
        setApplications([])
        const message = handleApiError(e) || 'Failed to load applications'
        setError(message)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [activeTab])

  const stats = useMemo(() => ([
    { icon: '📋', label: 'Active Programs', value: String(activeCount), color: 'ocean' },
    { icon: '👥', label: 'Total Beneficiaries', value: beneficiariesTotal !== null ? beneficiariesTotal.toLocaleString() : '—', color: 'forest' },
    { icon: '⏳', label: 'Pending Applications', value: '—', color: 'sunset' },
    { icon: '✅', label: 'Approved This Month', value: '—', color: 'purple' },
  ]), [activeCount, beneficiariesTotal])
  const headerStats = useMemo(() => stats.map(({ label, value }) => ({ label, value })), [stats])

  const updateApplicationStatus = async (
    appId: number,
    status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'completed',
    options: { rejection_reason?: string; notes?: string } = {}
  ) => {
    try {
      setActionLoading(appId)
      const response = await benefitsAdminApi.updateApplicationStatus(appId, {
        status,
        ...(options.rejection_reason ? { rejection_reason: options.rejection_reason } : {}),
        ...(options.notes ? { notes: options.notes } : {}),
      })
      const updated =
        (response as any)?.application ||
        (response as any)?.data?.application ||
        (response as any) ||
        null
      if (updated) {
        setApplications((prev) =>
          prev.map((entry: any) => (entry.id === appId ? { ...entry, ...updated } : entry))
        )
      } else {
        setApplications((prev) =>
          prev.map((entry: any) => (entry.id === appId ? { ...entry, status } : entry))
        )
      }

      const successMessage =
        status === 'approved'
          ? 'Application approved'
          : status === 'rejected'
            ? 'Application rejected'
            : status === 'under_review'
              ? 'Application marked under review'
              : 'Application updated'
      showToast(successMessage, 'success')
    } catch (e: any) {
      const message = handleApiError(e)
      showToast(message || 'Failed to update application', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const openCreate = () => setCreateOpen(true)
  const closeCreate = () => setCreateOpen(false)
  const submitCreate = async (data: any) => {
    try {
      setActionLoading(-1)
      const payload = { ...data, municipality_id: adminMunicipalityId ?? undefined }
      const res = await benefitsAdminApi.createProgram(payload)
      const created = (res as any)?.program
      if (created) {
        const normalized = normalizeProgram(created)
        if (normalized) {
          setPrograms((prev) => [normalized, ...prev])
        }
      }
      setCreateOpen(false)
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteProgram = async (programId: number) => {
    const confirmed = window.confirm('Delete this program permanently? This cannot be undone.')
    if (!confirmed) return
    try {
      setActionLoading(programId)
      await benefitsAdminApi.deleteProgram(programId)
      setPrograms((prev) => prev.filter((p: any) => p.id !== programId))
      showToast('Program deleted', 'success')
    } catch (e: any) {
      setError(handleApiError(e))
    } finally {
      setActionLoading(null)
    }
  }

  function IconFromCode({ code, className }: { code: string; className?: string }) {
    if (code === '📋') return <ClipboardList className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '👥') return <Users className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '⏳') return <Hourglass className={className || 'w-6 h-6'} aria-hidden="true" />
    if (code === '✅') return <CheckCircle className={className || 'w-6 h-6'} aria-hidden="true" />
    return <ClipboardList className={className || 'w-6 h-6'} aria-hidden="true" />
  }

  return (
    <AdminPageShell>
      <AdminPageHeader
        overline="Admin • Community Support"
        title="Benefits & Programs"
        description="Manage government assistance and municipal support programs."
        stats={headerStats}
        actions={(
          <Button onClick={openCreate} variant="primary" className="flex items-center gap-2" aria-controls="create-program-modal" aria-haspopup="dialog">
            <span className="text-lg" aria-hidden>+</span>
            Create New Program
          </Button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-lg hover:scale-105 transition-transform">
            <div className={`inline-flex w-12 h-12 bg-${stat.color}-100 rounded-xl items-center justify-center mb-3`}>
              {/* @ts-ignore dynamic color class */}
              <IconFromCode code={stat.icon as string} className="w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-neutral-900 mb-1">{stat.value}</p>
            <p className="text-sm text-neutral-600">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-white/50 mb-6 -mx-2 px-2 overflow-x-auto">
        <div className="inline-flex gap-2 min-w-max">
          {[
            { value: 'active', label: 'Active Programs', count: activeCount },
            { value: 'applications', label: 'Applications', count: applicationsCount === null ? '—' : applicationsCount },
            { value: 'archived', label: 'Archived', count: programs.filter((p:any)=>!p.is_active).length },
          ].map((tab) => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value as any)} className={`shrink-0 px-6 py-3 rounded-xl font-medium transition-all ${activeTab === tab.value ? 'bg-ocean-gradient text-white shadow-lg' : 'text-neutral-700 hover:bg-neutral-100'}`}>
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.value ? 'bg-white/20' : 'bg-neutral-200'}`}>{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 text-yellow-800 px-3 py-2 text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && activeTab !== 'applications' && [...Array(6)].map((_, i) => (
          <div key={i} className="bg-white/70 rounded-3xl p-6 border border-white/50">
            <div className="h-32 skeleton rounded-2xl mb-4" />
            <div className="h-4 w-40 skeleton rounded mb-2" />
            <div className="h-3 w-24 skeleton rounded" />
          </div>
        ))}
        {!loading && activeTab === 'active' && programs.filter((p:any)=>p.is_active).map((program, i) => (
          <div key={i} className="group bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 hover:shadow-2xl hover:scale-105 transition-all duration-300">
            <div className={`relative h-32 bg-gradient-to-br from-${program.color}-400 to-${program.color}-600 flex items-center justify-center`}>
              <div className="absolute inset-0 bg-white/10" />
              <span className="relative">
                {/* @ts-ignore dynamic gradient color class */}
                <IconFromCode code={program.icon as string} className="w-12 h-12 text-white" />
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg text-neutral-900 group-hover:text-ocean-600 transition-colors">{program.title}</h3>
                <span className="px-2 py-1 bg-forest-100 text-forest-700 text-xs font-medium rounded-full">Active</span>
              </div>
              <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{program.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-600 mb-1">Beneficiaries</p>
                  <p className="text-lg font-bold text-neutral-900">{program.beneficiaries}</p>
                </div>
                {Number(program.duration_days) > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 mb-1">Duration (days)</p>
                    <p className="text-lg font-bold text-neutral-900">{program.duration_days}</p>
                  </div>
                )}
              </div>
              <div className="relative flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await benefitsApi.getProgramById(program.id)
                      const detail = (res as any)?.data || res
                      const normalized = normalizeProgram(detail) || program
                      setViewProgram({ ...normalized, raw: detail })
                    } catch (e: any) {
                      setError(handleApiError(e))
                    }
                  }}
                  className="flex-1 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-xl text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                <button onClick={() => { setViewProgram({ ...program, _edit: true }) }} className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-sm font-medium transition-colors">Edit</button>
                <button onClick={async ()=>{
                  try {
                    setActionLoading(program.id)
                    const res = await benefitsAdminApi.completeProgram(program.id)
                    const updatedProgram = normalizeProgram((res as any)?.program || { ...program, is_active: false, status: 'completed', completed_at: new Date().toISOString() })
                    if (updatedProgram) {
                      setPrograms((prev:any[])=> prev.map((p:any)=> p.id===program.id ? { ...p, ...updatedProgram } : p))
                    }
                    showToast('Program marked as completed','success')
                  } catch(e:any){
                    setError(handleApiError(e))
                  } finally { setActionLoading(null) }
                }} className="flex-1 py-2 bg-forest-100 hover:bg-forest-200 text-forest-700 rounded-xl text-sm font-medium transition-colors" disabled={actionLoading===program.id}>Done</button>
                <button onClick={() => handleDeleteProgram(program.id)} className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-medium transition-colors" disabled={actionLoading===program.id}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && activeTab === 'archived' && programs.filter((p:any)=>!p.is_active).map((program, i) => (
          <div key={i} className="group bg-white/70 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50">
            <div className={`relative h-32 bg-gradient-to-br from-${program.color}-400 to-${program.color}-600 flex items-center justify-center`}>
              <div className="absolute inset-0 bg-white/20" />
              <span className="relative">
                {/* @ts-ignore dynamic gradient color class */}
                <IconFromCode code={program.icon as string} className="w-12 h-12 text-white" />
              </span>
            </div>
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-bold text-lg text-neutral-900">{program.title}</h3>
                <span className="px-2 py-1 bg-neutral-100 text-neutral-700 text-xs font-medium rounded-full">Program Completed</span>
              </div>
              <p className="text-sm text-neutral-600 mb-4 line-clamp-2">{program.description}</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-neutral-50 rounded-xl p-3">
                  <p className="text-xs text-neutral-600 mb-1">Beneficiaries</p>
                  <p className="text-lg font-bold text-neutral-900">{program.beneficiaries}</p>
                </div>
                {Number(program.duration_days) > 0 && (
                  <div className="bg-neutral-50 rounded-xl p-3">
                    <p className="text-xs text-neutral-600 mb-1">Duration (days)</p>
                    <p className="text-lg font-bold text-neutral-900">{program.duration_days}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      setActionLoading(program.id)
                      const res = await benefitsAdminApi.getProgram(program.id)
                      const detail = (res as any)?.program || (res as any)?.data?.program || res
                      if (detail) {
                        const normalized = normalizeProgram(detail) || program
                        setViewProgram({ ...normalized, raw: detail })
                      } else {
                        setViewProgram(program)
                      }
                    } catch (e: any) {
                      setError(handleApiError(e))
                    } finally {
                      setActionLoading(null)
                    }
                  }}
                  className="flex-1 py-2 bg-ocean-100 hover:bg-ocean-200 text-ocean-700 rounded-xl text-sm font-medium transition-colors"
                >
                  View Details
                </button>
                <button onClick={() => handleDeleteProgram(program.id)} className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-sm font-medium transition-colors" disabled={actionLoading===program.id}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        {!loading && activeTab === 'applications' && applications.map((app: any) => (
          <div key={app.id} className="bg-white/70 rounded-3xl p-5 border border-white/50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-neutral-600">Application No. {app.application_number}</div>
                <div className="font-semibold">{app.user?.first_name} {app.user?.last_name}</div>
                <div className="text-sm">Program: <span className="font-medium">{app.program?.name || '—'}</span></div>
                <div className="text-xs text-neutral-600">Submitted: {(app.created_at || '').slice(0,10)}</div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${app.status==='approved'?'bg-emerald-100 text-emerald-700':app.status==='rejected'?'bg-rose-100 text-rose-700':app.status==='under_review'?'bg-yellow-100 text-yellow-700':'bg-neutral-100 text-neutral-700'}`}>{app.status}</span>
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
              {app.status !== 'under_review' && app.status !== 'approved' && (
            <button
              className="px-3 py-1.5 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-sm"
              onClick={() => updateApplicationStatus(app.id, 'under_review')}
              disabled={actionLoading === app.id}
            >
              Mark Under Review
            </button>
              )}
              {app.status !== 'approved' && (
            <button
              className="px-3 py-1.5 rounded-lg bg-forest-100 hover:bg-forest-200 text-forest-700 text-sm"
              onClick={() => updateApplicationStatus(app.id, 'approved')}
              disabled={actionLoading === app.id}
            >
              Approve
            </button>
              )}
              {app.status !== 'rejected' && (
            <button
              className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm"
              onClick={() => {
                const reason = window.prompt('Enter reason for rejection', 'Incomplete requirements') || 'Incomplete requirements'
                updateApplicationStatus(app.id, 'rejected', { rejection_reason: reason })
              }}
              disabled={actionLoading === app.id}
            >
              Reject
            </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* View / Edit Modal */}
      {viewProgram && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setViewProgram(null) }} title={viewProgram._edit ? 'Edit Program' : 'Program Details'}>
          {viewProgram._edit ? (
            <ProgramForm
              key={viewProgram.id || 'edit'}
              initial={{
                name: viewProgram.title || viewProgram.name,
                code: viewProgram.code || '',
                description: viewProgram.description || '',
                program_type: viewProgram.program_type || 'general',
                duration_days: viewProgram.duration_days ?? '',
                required_documents: viewProgram.required_documents || [],
                  eligibility_criteria: viewProgram.eligibility_criteria ?? viewProgram.raw?.eligibility_criteria ?? [],
              }}
              onCancel={()=> setViewProgram(null)}
                onSubmit={async (data)=>{
                  try {
                    setActionLoading(viewProgram.id)
                    const res = await benefitsAdminApi.updateProgram(viewProgram.id, data)
                    const updated = (res as any)?.program || (res as any)?.data?.program
                    if (updated) {
                      const normalized = normalizeProgram(updated)
                      if (normalized) {
                        setPrograms((prev)=> prev.map((p:any)=> p.id === viewProgram.id ? { ...p, ...normalized } : p))
                      }
                    } else {
                      setPrograms((prev)=> prev.map((p:any)=> p.id===viewProgram.id ? {
                        ...p,
                        title: data.name || p.title,
                        description: data.description ?? p.description,
                        duration_days: data.duration_days ?? p.duration_days,
                        required_documents: data.required_documents ?? p.required_documents,
                        program_type: data.program_type ?? p.program_type,
                        eligibility_criteria: data.eligibility_criteria ?? p.eligibility_criteria,
                        eligibility_display: eligibilityEntriesToDisplay(data.eligibility_criteria ?? p.eligibility_criteria),
                        eligibility_entries: parseEligibilityEntries(data.eligibility_criteria ?? p.eligibility_criteria),
                      } : p))
                    }
                    setViewProgram(null)
                  } catch(e:any){
                    setError(handleApiError(e))
                  } finally {
                    setActionLoading(null)
                  }
                }}
                submitting={actionLoading===viewProgram.id}
              />
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-700"><span className="font-medium">Name:</span> {viewProgram.name || viewProgram.title}</p>
              <p className="text-sm text-neutral-700"><span className="font-medium">Type:</span> {viewProgram.program_type || '—'}</p>
              {Number(viewProgram.duration_days) > 0 && (<p className="text-sm text-neutral-700"><span className="font-medium">Duration:</span> {viewProgram.duration_days} days</p>)}
              <p className="text-sm text-neutral-700 whitespace-pre-wrap"><span className="font-medium">Description:</span> {viewProgram.description}</p>
              {Array.isArray(viewProgram.eligibility_display) && viewProgram.eligibility_display.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-700">Eligibility Criteria</p>
                  <ul className="list-disc list-inside text-sm text-neutral-600">
                    {viewProgram.eligibility_display.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(viewProgram.required_documents) && viewProgram.required_documents.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-neutral-700">Requirements</p>
                  <ul className="list-disc list-inside text-sm text-neutral-600">
                    {viewProgram.required_documents.map((req: string, idx: number) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Applicants Modal */}
      {viewApplicants && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setViewApplicants(null) }} title={`Applicants — ${viewApplicants.program.title || viewApplicants.program.name}`}>
          <div className="space-y-3 max-h-[70vh] overflow-auto">
            {viewApplicants.applications.length === 0 ? (
              <div className="text-sm text-neutral-600">No applicants.</div>
            ) : viewApplicants.applications.map((a: any) => (
              <div key={a.id} className="p-3 border rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.user?.first_name} {a.user?.last_name}</div>
                    <div className="text-xs text-neutral-600">Applied: {(a.created_at || '').slice(0,10)}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${a.status==='approved'?'bg-emerald-100 text-emerald-700':a.status==='rejected'?'bg-rose-100 text-rose-700':a.status==='under_review'?'bg-yellow-100 text-yellow-700':'bg-neutral-100 text-neutral-700'}`}>{a.status}</span>
                </div>
                {Array.isArray(a.supporting_documents) && a.supporting_documents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.supporting_documents.map((p: string, i: number) => (
                      <a key={i} href={`${(import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:5000'}/uploads/${String(p).replace(/^uploads\//,'')}`} target="_blank" rel="noreferrer" className="text-xs underline text-ocean-700">Document {i+1}</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {createOpen && (
        <Modal open={true} onOpenChange={(o)=>{ if(!o) setCreateOpen(false) }} title="Create Program" className="" >
          <ProgramForm initial={{ name: '', code: '', description: '', program_type: 'general', duration_days: '', required_documents: [], eligibility_criteria: [] }} onCancel={closeCreate} onSubmit={submitCreate} submitting={actionLoading===-1} key="create" />
        </Modal>
      )}
    </AdminPageShell>
  )
}



function ProgramForm({ initial, onCancel, onSubmit, submitting }: { initial: any; onCancel: ()=>void; onSubmit: (data:any)=>void; submitting: boolean }) {
  const defaults = {
    name: '',
    code: '',
    description: '',
    program_type: 'general',
    duration_days: '',
    required_documents: [] as string[],
    eligibility_criteria: [] as any,
  }
  const merged = { ...defaults, ...(initial || {}) }
  const [form, setForm] = useState<any>(merged)
  const [requirements, setRequirements] = useState<string[]>(() => {
    const list = Array.isArray(merged.required_documents) ? merged.required_documents : []
    const filtered = list.filter((item: string) => !!item).slice(0, 5)
    return filtered.length > 0 ? filtered : ['']
  })
  const [eligibility, setEligibility] = useState<EligibilityEntry[]>(() => {
    const parsed = parseEligibilityEntries(merged.eligibility_criteria)
    return parsed.length > 0 ? parsed : [{ label: '', description: '' }]
  })

  const updateRequirement = (index: number, value: string) => {
    setRequirements((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  const addRequirement = () => {
    setRequirements((prev) => (prev.length >= 5 ? prev : [...prev, '']))
  }

  const removeRequirement = (index: number) => {
    setRequirements((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [''] : next
    })
  }

  const updateEligibility = (index: number, field: 'label' | 'description', value: string) => {
    setEligibility((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const addEligibility = () => {
    setEligibility((prev) => (prev.length >= 10 ? prev : [...prev, { label: '', description: '' }]))
  }

  const removeEligibility = (index: number) => {
    setEligibility((prev) => {
      const next = prev.filter((_, i) => i !== index)
      return next.length === 0 ? [{ label: '', description: '' }] : next
    })
  }

  const disabled = !(form.name && form.code && form.description)

  return (
    <form
      aria-label="Program form"
      onSubmit={(e) => {
        e.preventDefault()
        if (disabled || submitting) return
        const payload = {
          ...form,
          duration_days: form.duration_days === '' ? undefined : Number(form.duration_days),
          required_documents: requirements.map((r) => String(r || '').trim()).filter(Boolean).slice(0, 5),
        }
        payload.eligibility_criteria = buildEligibilityPayload(eligibility)
        onSubmit(payload)
      }}
      className="space-y-3"
    >
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-name">Name</label>
        <input id="program-name" value={form.name} onChange={(e)=> setForm((p:any)=> ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-code">Code</label>
        <input id="program-code" value={form.code} onChange={(e)=> setForm((p:any)=> ({ ...p, code: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-md" required />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-type">Type</label>
        <select id="program-type" value={form.program_type} onChange={(e)=> setForm((p:any)=> ({ ...p, program_type: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-md">
          <option value="general">General</option>
          <option value="financial">Financial</option>
          <option value="educational">Educational</option>
          <option value="health">Health</option>
          <option value="livelihood">Livelihood</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-desc">Description</label>
        <textarea id="program-desc" value={form.description} onChange={(e)=> setForm((p:any)=> ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 border border-neutral-300 rounded-md" rows={5} required />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-neutral-700">Eligibility Criteria</label>
          <button
            type="button"
            className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded"
            onClick={addEligibility}
            disabled={eligibility.length >= 10}
          >
            Add criterion
          </button>
        </div>
        <div className="space-y-3">
          {eligibility.map((entry, index) => (
            <div key={index} className="border border-neutral-200 rounded-lg p-3 space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  value={entry.label}
                  onChange={(e) => updateEligibility(index, 'label', e.target.value)}
                  className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
                  placeholder="Label (e.g., Residency, Income Bracket)"
                />
                <textarea
                  value={entry.description}
                  onChange={(e) => updateEligibility(index, 'description', e.target.value)}
                  className="flex-[2] border border-neutral-300 rounded-md px-3 py-2 text-sm"
                  rows={2}
                  placeholder="Details shown to residents"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>Leave label blank for simple bullet points.</span>
                <button
                  type="button"
                  className="text-rose-600 hover:text-rose-700"
                  onClick={() => removeEligibility(index)}
                  disabled={eligibility.length <= 1 && !eligibility[index].label && !eligibility[index].description}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-1">Residents see these criteria before starting an application.</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1" htmlFor="program-duration">Duration (days)</label>
        <input
          id="program-duration"
          type="number"
          min={0}
          placeholder="e.g., 30"
          value={form.duration_days}
          onChange={(e)=> setForm((p:any)=> ({ ...p, duration_days: e.target.value === '' ? '' : Number(e.target.value) }))}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md"
        />
        <p className="text-xs text-neutral-500 mt-1">Leave blank to keep the program active until marked Done.</p>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-neutral-700">Requirements (max 5)</label>
          <button type="button" className="px-2 py-1 text-xs bg-neutral-100 hover:bg-neutral-200 rounded" onClick={addRequirement} disabled={requirements.length >= 5}>Add</button>
        </div>
        <div className="space-y-2">
          {requirements.map((req, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                value={req}
                onChange={(e) => updateRequirement(index, e.target.value)}
                className="flex-1 border border-neutral-300 rounded-md px-3 py-2 text-sm"
                placeholder="Requirement description"
              />
              <button
                type="button"
                className="px-2 py-1 text-xs bg-rose-100 hover:bg-rose-200 text-rose-700 rounded"
                onClick={() => removeRequirement(index)}
                disabled={requirements.length <= 1 && !requirements[index]}
              >Remove</button>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-500 mt-1">Residents must upload each listed requirement when applying.</p>
      </div>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="secondary" size="sm" onClick={onCancel} type="button">Cancel</Button>
        <Button size="sm" type="submit" disabled={disabled || submitting} isLoading={submitting}>Save</Button>
      </div>
    </form>
  )
}

