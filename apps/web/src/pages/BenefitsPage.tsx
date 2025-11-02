import { StatusBadge, Card, EmptyState } from '@munlink/ui'
import { useEffect, useState, useMemo } from 'react'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { useAppStore } from '@/lib/store'
import { benefitsApi, handleApiError } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import Stepper from '@/components/ui/Stepper'

type Program = {
  id: string | number
  name: string
  summary?: string
  description?: string
  municipality?: string
  eligibility?: string[]
  eligibility_criteria?: string[]
  requirements?: string[]
  required_documents?: string[]
}

export default function BenefitsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const user = useAppStore((s) => s.user)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selected, setSelected] = useState<Program | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [tab, setTab] = useState<'programs'|'applications'>('programs')
  const [searchParams] = useSearchParams()
  const [applications, setApplications] = useState<any[]>([])
  const [openId, setOpenId] = useState<string | number | null>(null)
  const residentMunicipalityId = useMemo(() => {
    const raw = (user as any)?.municipality_id
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }, [user])
  const isMismatch = !!residentMunicipalityId && !!selectedMunicipality?.id && residentMunicipalityId !== selectedMunicipality.id
  const [benefitRequirements, setBenefitRequirements] = useState<Array<{ label: string; file?: File | null }>>([])
  const [applicationNotes, setApplicationNotes] = useState('')
  const [pageError, setPageError] = useState<string | null>(null)
  const [fetchingProgramId, setFetchingProgramId] = useState<number | null>(null)

  const getProgramMunicipalityId = (program: Program | null | undefined): number | null => {
    if (!program) return null
    const raw = (program as any)?.municipality_id ?? (program as any)?.municipalityId ?? (program as any)?.municipality?.id
    const parsed = Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  const getProgramMunicipalityName = (program: Program | null | undefined): string => {
    if (!program) return ''
    return (
      (program as any)?.municipality ||
      (program as any)?.municipality_name ||
      (program as any)?.municipality?.name ||
      ''
    )
  }

  const getApplicationBlockReason = (program: Program | null | undefined): string | null => {
    if (!program) return 'Program is no longer available.'
    if (!residentMunicipalityId) {
      return 'Set your municipality in your profile before applying for benefits.'
    }
    const targetId = getProgramMunicipalityId(program)
    if (!targetId) {
      return null
    }
    if (targetId !== residentMunicipalityId) {
      const name = getProgramMunicipalityName(program) || 'another municipality'
      return `This program is limited to residents of ${name}.`
    }
    return null
  }

  const openApplicationModal = async (program: Program) => {
    const numericId = Number(program?.id)
    setPageError(null)
    if (!numericId || Number.isNaN(numericId)) {
      setPageError('Selected program is no longer available. Please refresh and try again.')
      return
    }
    const earlyBlock = getApplicationBlockReason(program)
    if (earlyBlock) {
      setPageError(earlyBlock)
      return
    }
    setFetchingProgramId(numericId)
    try {
      const res = await benefitsApi.getProgram(numericId)
      const detail = res?.data || (res as any)?.program || res
      const merged = detail && typeof detail === 'object' ? { ...program, ...detail } : program
      const blockAfterFetch = getApplicationBlockReason(merged)
      if (blockAfterFetch) {
        setPageError(blockAfterFetch)
        setSelected(null)
        setOpen(false)
        return
      }
      setSelected(merged)
      setOpen(true)
      setStep(1)
      setResult(null)
      setApplicationNotes('')
    } catch (err: any) {
      setPageError(handleApiError(err, 'Unable to load program details'))
      // Fallback to existing list data so the resident can still proceed
      setSelected(program)
      setOpen(true)
      setStep(1)
      setResult(null)
      setApplicationNotes('')
    } finally {
      setFetchingProgramId(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setPageError(null)
      try {
        if (tab === 'applications') {
          const isAuthenticated = !!useAppStore.getState().isAuthenticated
          if (!isAuthenticated) { if (!cancelled) setApplications([]); return }
          const my = await benefitsApi.getMyApplications()
          if (!cancelled) setApplications(my.data?.applications || [])
        } else {
          const params: any = {}
          if (selectedMunicipality?.id) params.municipality_id = selectedMunicipality.id
          if (typeFilter !== 'all') params.type = typeFilter
          const res = await benefitsApi.getPrograms(params)
          if (!cancelled) setPrograms(res.data?.programs || [])
        }
      } catch (err: any) {
        if (!cancelled) {
          setPageError(handleApiError(err, 'Failed to load benefits data'))
          if (tab === 'applications') {
            setApplications([])
          } else {
            setPrograms([])
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMunicipality?.id, typeFilter, tab])

  // Initialize tab from query param (?tab=applications)
  useEffect(() => {
    const t = (searchParams.get('tab') || '').toLowerCase()
    if (t === 'applications') setTab('applications')
  }, [searchParams])

  useEffect(() => {
    if (!selected) {
      setBenefitRequirements([])
      return
    }
    const reqs = [
      ...(((selected as any)?.required_documents) || []),
      ...(((selected as any)?.requirements) || []),
    ]
      .filter((item) => !!item)
      .slice(0, 5)
    // Remove duplicates while preserving order
    const seen = new Set<string>()
    const deduped = reqs.filter((label) => {
      const key = String(label)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setBenefitRequirements(deduped.map((label) => ({ label: String(label), file: undefined })))
  }, [selected])

  const handleBenefitRequirementChange = (index: number, file: File | null) => {
    setBenefitRequirements((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], file: file || undefined }
      }
      return next
    })
  }

  const hasBenefitRequirementFiles = useMemo(() => {
    if (benefitRequirements.length === 0) return true
    return benefitRequirements.every((entry) => entry.file instanceof File)
  }, [benefitRequirements])

  const eligibilityList = useMemo(() => {
    if (!selected) return [] as string[]
    const entries: string[] = []

    const formatKey = (key: string) =>
      key
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, (char) => char.toUpperCase())

    const pushNormalized = (value: unknown) => {
      if (!value) return
      if (Array.isArray(value)) {
        value.forEach((item) => pushNormalized(item))
        return
      }
      if (typeof value === 'string') {
        const parts = value
          .split(/\r?\n|[,•]/)
          .map((item) => item.trim())
          .filter(Boolean)
        if (parts.length === 0) return
        parts.forEach((part) => entries.push(part))
        return
      }
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>
        const labelLike = ['label', 'title', 'heading', 'name'].map((k) => obj[k])
        const textLike = ['description', 'text', 'value', 'details'].map((k) => obj[k])

        const label = labelLike.find((item): item is string => typeof item === 'string' && item.trim().length > 0)
        const text = textLike.find((item): item is string => typeof item === 'string' && item.trim().length > 0)

        if (label || text) {
          entries.push(label && text ? `${label.trim()}: ${text.trim()}` : (label || text)!.trim())
        }

        const remainingKeys = Object.keys(obj).filter((key) => !['label', 'title', 'heading', 'name', 'description', 'text', 'value', 'details'].includes(key))
        remainingKeys.forEach((key) => {
          const val = obj[key]
          if (typeof val === 'string' && val.trim().length > 0) {
            entries.push(`${formatKey(key)}: ${val.trim()}`)
          } else if (typeof val === 'number') {
            entries.push(`${formatKey(key)}: ${val}`)
          } else if (typeof val === 'boolean') {
            entries.push(`${formatKey(key)}: ${val ? 'Yes' : 'No'}`)
          } else if (val != null) {
            pushNormalized(val)
          }
        })
        return
      }

      entries.push(String(value))
    }

    pushNormalized((selected as any)?.eligibility)
    pushNormalized((selected as any)?.eligibility_criteria)

    const seen = new Set<string>()
    return entries
      .map((item) => item.trim())
      .filter((item) => {
        if (!item) return false
        if (seen.has(item)) return false
        seen.add(item)
        return true
      })
  }, [selected])

  return (
    <div className="container-responsive py-12">
      <div className="mb-3">
        <h1 className="text-fluid-3xl font-serif font-semibold">Benefits</h1>
        <p className="text-gray-600">Explore available programs tailored to your municipality and apply once you meet the requirements.</p>
      </div>

      <Card className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type</label>
            <select className="input-field" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="financial">Financial</option>
              <option value="educational">Educational</option>
              <option value="health">Health</option>
              <option value="livelihood">Livelihood</option>
            </select>
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <button className={`btn ${tab==='programs'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('programs')}>Programs</button>
            <button className={`btn ${tab==='applications'?'btn-primary':'btn-secondary'}`} onClick={() => setTab('applications')}>My Applications</button>
            {isAuthenticated && (
              <button className="btn btn-secondary" onClick={() => navigate('/benefits/history')}>Program History</button>
            )}
          </div>
        </div>
      </Card>

      {isMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          You are viewing {selectedMunicipality?.name}. Applications are limited to your registered municipality.
        </div>
      )}

      {pageError && (
        <div className="mb-4 p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {pageError}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-card h-40" />
          ))}
        </div>
      ) : tab==='programs' ? (
        programs.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Try a different filter or check back soon." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((p) => {
              const desc = (p as any).description || p.summary || ''
              const eligibility = (p.eligibility || (p as any).eligibility_criteria || []) as string[]
              const requirements = (p.requirements || (p as any).required_documents || []) as string[]
              return (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold truncate">{p.name}</h3>
                    {openId!==p.id && (
                      <p className="text-sm text-gray-700 mt-1 line-clamp-2">{desc}</p>
                    )}
                  </div>
                  <button
                    className="btn-ghost text-blue-700 shrink-0"
                    onClick={() => setOpenId(openId===p.id ? null : p.id)}
                    aria-expanded={openId===p.id}
                  >
                    {openId===p.id ? 'Hide' : 'View details'}
                  </button>
                </div>
                {openId===p.id && (
                  <div className="mt-3 space-y-3">
                    {p.municipality && (
                      <div className="text-xs text-gray-500">{p.municipality}</div>
                    )}
                    {desc && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Details</div>
                        <p className="text-sm text-gray-700">{desc}</p>
                      </div>
                    )}
                    {eligibility.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Eligibility</div>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                          {eligibility.map((e, i) => (<li key={i}>{e}</li>))}
                        </ul>
                      </div>
                    )}
                    {requirements.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Requirements</div>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-0.5">
                          {requirements.map((r, i) => (<li key={i}>{r}</li>))}
                        </ul>
                      </div>
                    )}
                    {!(desc && String(desc).trim()) && eligibility.length===0 && requirements.length===0 && (
                      <div className="text-sm text-gray-600">No details provided.</div>
                    )}
                  </div>
                )}
                <div className="mt-4">
                  {getProgramMunicipalityName(p) && (
                    <div className="mb-3 text-xs text-gray-500">
                      Available for {getProgramMunicipalityId(p) ? getProgramMunicipalityName(p) : `${getProgramMunicipalityName(p) || 'Province-wide'} residents`}
                    </div>
                  )}
                  {getApplicationBlockReason(p) && (
                    <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {getApplicationBlockReason(p)}
                    </div>
                  )}
                  <GatedAction
                    required="fullyVerified"
                    onAllowed={() => {
                      const block = getApplicationBlockReason(p)
                      if (block) {
                        alert(block)
                        return
                      }
                      void openApplicationModal(p)
                    }}
                    tooltip="Login required to use this feature"
                  >
                    <button
                      className="btn btn-primary w-full"
                      disabled={!!getApplicationBlockReason(p) || fetchingProgramId === Number(p.id)}
                      title={getApplicationBlockReason(p) || undefined}
                    >
                      {fetchingProgramId === Number(p.id) ? 'Loading...' : 'Apply Now'}
                    </button>
                  </GatedAction>
                </div>
              </Card>
              )
            })}
          </div>
        )
      ) : (
        applications.length === 0 ? (
          <EmptyState title="No applications yet" description="Submit an application to see it here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {applications.map((a) => (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{a.program?.name || 'Application'}</div>
                    <div className="text-xs text-gray-600">{a.application_number}</div>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
                {a.disbursement_status && <div className="text-xs text-gray-600 mt-2">Disbursement: {a.disbursement_status}</div>}
              </Card>
            ))}
          </div>
        )
      )}

      <Modal isOpen={open} onClose={() => { setOpen(false); setSelected(null); setResult(null); setStep(1) }} title={selected ? `Apply: ${selected.name}` : 'Apply'}>
        {selected && getApplicationBlockReason(selected) && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {getApplicationBlockReason(selected)}
          </div>
        )}
        <Stepper steps={["Eligibility","Details","Review"]} current={step} />
        {step === 1 && (
          <div className="space-y-3">
            <div className="text-sm">Please confirm you meet the eligibility:</div>
            <ul className="list-disc list-inside text-sm text-gray-700">
              {eligibilityList.length === 0 ? (
                <li>No eligibility criteria provided. Please review program details.</li>
              ) : (
                eligibilityList.map((e: string, i: number) => (<li key={i}>{e}</li>))
              )}
            </ul>
            <div className="flex justify-end">
              <button className="btn btn-primary inline-flex items-center gap-2" onClick={() => setStep(2)}>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">Additional Information</label>
              <textarea className="input-field" rows={4} placeholder="Share any details to support your application" value={applicationNotes} onChange={(e) => setApplicationNotes(e.target.value)} />
            </div>
            {benefitRequirements.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">Required Attachments</div>
                <div className="text-xs text-gray-600">Upload clear copies for each listed requirement (images or PDF).</div>
                <div className="space-y-2">
                  {benefitRequirements.map((entry, index) => (
                    <div key={index} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800">{entry.label}</div>
                        <div className="text-xs text-gray-600">Required</div>
                        {entry.file && (
                          <div className="text-xs text-emerald-700 mt-1 truncate">Selected: {entry.file.name}</div>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="text-xs"
                        onChange={(e) => handleBenefitRequirementChange(index, e.target.files?.[0] || null)}
                      />
                    </div>
                  ))}
                </div>
                {!hasBenefitRequirementFiles && (
                  <div className="text-xs text-rose-700">Attach files for all requirements before submitting.</div>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button className="btn btn-primary inline-flex items-center gap-2" onClick={() => setStep(3)}>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <div className="text-sm">Review your application then submit.</div>
            <div className="rounded-lg border p-3 text-sm">
              <div><span className="font-medium">Program:</span> {selected?.name}</div>
              {applicationNotes && <div><span className="font-medium">Notes:</span> {applicationNotes}</div>}
              {benefitRequirements.length > 0 && (
                <div className="mt-2">
                  <span className="font-medium">Required Attachments:</span>
                  <ul className="list-disc list-inside text-xs text-gray-700">
                    {benefitRequirements.map((entry, idx) => (
                      <li key={idx}>{entry.label} — {entry.file ? entry.file.name : 'Not attached'}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setStep(2)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>Back</span>
              </button>
              <button className="btn btn-primary" disabled={applying || !hasBenefitRequirementFiles} onClick={async () => {
                setApplying(true)
                try {
                  const form = new FormData()
                  form.append('program_id', String(selected!.id))
                  if (applicationNotes.trim()) {
                    form.append('application_data', JSON.stringify({ notes: applicationNotes.trim() }))
                  }
                  benefitRequirements.forEach((entry, idx) => {
                    if (entry.file) {
                      form.append('requirement_files', entry.file, `requirement-${idx + 1}-${entry.file.name}`)
                    }
                  })
                  const res = await benefitsApi.createApplication(form)
                  const app = res?.data?.application
                  setResult(app)
                  setApplicationNotes('')
                  setBenefitRequirements((prev) => prev.map((entry) => ({ ...entry, file: undefined })))
                } finally {
                  setApplying(false)
                }
              }}>{applying ? 'Submitting...' : 'Submit Application'}</button>
            </div>
            {result && result.application_number && (
              <div className="mt-3 rounded-lg border p-3 text-sm flex items-center justify-between">
                <div>
                  Submitted • Application No.: <span className="font-medium">{result.application_number}</span>
                </div>
                <StatusBadge status={result.status} />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}


