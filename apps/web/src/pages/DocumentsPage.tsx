import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import GatedAction from '@/components/GatedAction'
import { documentsApi } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import Stepper from '@/components/ui/Stepper'
import FileUploader from '@/components/ui/FileUploader'
// pickup location is tied to resident profile; no remote fetch needed

type DocType = {
  id: number
  name: string
  code: string
  fee: number
  processing_days: number
  supports_digital: boolean
  requirements?: any
}

export default function DocumentsPage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const user = useAppStore((s) => s.user)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [types, setTypes] = useState<DocType[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [deliveryMethod, setDeliveryMethod] = useState<'digital' | 'pickup'>('digital')
  // deliveryAddress is derived server-side for pickup; no free-text field
  const [purpose, setPurpose] = useState('')
  const [remarks, setRemarks] = useState('')
  const [civilStatus, setCivilStatus] = useState('')
  const [age, setAge] = useState<string>('')
  // const [uploadForm, setUploadForm] = useState<FormData | null>(null)
  const [resultMsg, setResultMsg] = useState<string>('')
  const [createdId, setCreatedId] = useState<number | null>(null)
  const userBarangayName = (user as any)?.barangay_name // kept for review display and future use
  const [consent, setConsent] = useState(false)
  const [pickupLocation, setPickupLocation] = useState<'municipal'|'barangay'>('municipal')
  const [myRequests, setMyRequests] = useState<any[]>([])
  const [loadingMy, setLoadingMy] = useState(false)
  const [requirementInputs, setRequirementInputs] = useState<Array<{ label: string; file?: File | null }>>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await documentsApi.getTypes()
        if (!cancelled) setTypes(res.data?.types || [])
      } catch {
        if (!cancelled) setTypes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Load my requests when tab=requests
  useEffect(() => {
    let cancelled = false
    const tab = (searchParams.get('tab') || '').toLowerCase()
    if (tab !== 'requests') return
    ;(async () => {
      try {
        setLoadingMy(true)
        const isAuthenticated = !!useAppStore.getState().isAuthenticated
        if (!isAuthenticated) { if (!cancelled) setMyRequests([]); return }
        const res = await documentsApi.getMyRequests()
        const list = (res as any)?.data?.requests || (res as any)?.requests || []
        if (!cancelled) setMyRequests(list)
      } finally {
        if (!cancelled) setLoadingMy(false)
      }
    })()
    return () => { cancelled = true }
  }, [searchParams])

  // Initialize pickup selection from user profile
  useEffect(() => {
    setPickupLocation(((user as any)?.barangay_id ? 'barangay' : 'municipal'))
  }, [(user as any)?.municipality_id, (user as any)?.barangay_id])

  const selectedType = useMemo(() => types.find(t => t.id === selectedTypeId) || null, [types, selectedTypeId])
  const requirementsList = useMemo(() => {
    if (!selectedType || !Array.isArray((selectedType as any).requirements)) return []
    return ((selectedType as any).requirements as any[]).filter((item) => !!item).slice(0, 5)
  }, [selectedType])

  useEffect(() => {
    setRequirementInputs(requirementsList.map((label: any) => ({ label: String(label), file: undefined })))
  }, [requirementsList])
  const digitalAllowed = useMemo(() => {
    if (!selectedType) return false
    const fee = Number(selectedType.fee || 0)
    return !!selectedType.supports_digital && fee <= 0
  }, [selectedType])
  const isMismatch = useMemo(() => !!(user as any)?.municipality_id && !!selectedMunicipality?.id && (user as any).municipality_id !== selectedMunicipality.id, [user, selectedMunicipality?.id])
  const userMunicipalityName = (user as any)?.municipality_name
  const handleRequirementFileChange = (index: number, file: File | null) => {
    setRequirementInputs((prev) => {
      const next = [...prev]
      if (next[index]) {
        next[index] = { ...next[index], file: file || undefined }
      }
      return next
    })
  }
  const hasRequiredFiles = useMemo(() => {
    if (requirementsList.length === 0) return true
    if (requirementInputs.length < requirementsList.length) return false
    return requirementInputs.every((entry, idx) => {
      if (!requirementsList[idx]) return true
      return entry.file instanceof File
    })
  }, [requirementsList, requirementInputs])

  const canSubmit = useMemo(() => {
    if (!selectedTypeId || !(user as any)?.municipality_id || !purpose) return false
    if (!hasRequiredFiles) return false
    if (deliveryMethod === 'digital') return true
    // pickup requires barangay on profile
    return !!(user as any)?.barangay_id
  }, [selectedTypeId, (user as any)?.municipality_id, purpose, deliveryMethod, (user as any)?.barangay_id, hasRequiredFiles])

  return (
    <div className="container-responsive py-12">
      <h1 className="text-fluid-3xl font-serif font-semibold mb-6">Documents</h1>
      { (searchParams.get('tab') || '').toLowerCase() === 'requests' && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">My Requests</h2>
            <button className="btn-secondary" onClick={() => navigate('/documents')}>New Request</button>
          </div>
          {loadingMy ? (
            <div className="text-sm text-gray-600">Loading…</div>
          ) : myRequests.length === 0 ? (
            <div className="text-sm text-gray-600">You have no document requests yet.</div>
          ) : (
            <div className="space-y-2">
              {myRequests.map((r: any) => (
                <div key={r.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-1 sm:gap-3 rounded-lg border px-3 py-2 items-center">
                  <div className="min-w-0">
                    <Link to={`/dashboard/requests/${r.id}`} className="block font-medium text-blue-700 hover:underline truncate">
                      {r.document_type?.name || r.request_number || 'Document Request'}
                    </Link>
                    <div className="text-xs text-gray-600 truncate">{r.request_number}</div>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end shrink-0">
                    <span className="px-2.5 py-1 text-xs rounded-full ring-1 bg-gray-100 text-gray-700 capitalize">{r.status}</span>
                    <Link to={`/dashboard/requests/${r.id}`} className="btn-ghost text-blue-700">Open</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {isMismatch && (
        <div className="mb-4 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-900">
          You are viewing {selectedMunicipality?.name}. Actions are limited to your registered municipality{userMunicipalityName?`: ${userMunicipalityName}`:'.'}
        </div>
      )}
      {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="p-4 space-y-2">
                  <div className="h-4 w-1/3 skeleton" />
                  <div className="h-4 w-2/3 skeleton" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-4">
            <Stepper steps={["Type","Details","Review"]} current={step} />

            {/* Step 1: Select Type */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Select Document Type</h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  {types.map((t) => (
                    <button
                      key={t.id}
                      className={`text-left p-4 rounded-xl border ${selectedTypeId===t.id?'border-ocean-500 bg-ocean-50':'border-gray-200 hover:border-ocean-300'}`}
                      onClick={() => { setSelectedTypeId(t.id); const fee = Number(t.fee||0); const allowDigital = !!t.supports_digital && fee<=0; setDeliveryMethod(allowDigital? 'digital':'pickup') }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{t.name}</h3>
                          <p className="text-sm text-gray-600">Processing: {t.processing_days} days</p>
                        </div>
                        <div className="text-right">
                          {Number(t.fee || 0) > 0 ? (
                            <>
                              <div className="text-sm text-gray-700">Fee</div>
                              <div className="text-lg font-bold">₱{Number(t.fee).toFixed(2)}</div>
                            </>
                          ) : (
                            <div className="mt-1 text-xs">
                              {t.supports_digital ? (
                                <span className="inline-block rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5">Free digital copy</span>
                              ) : (
                                <span className="inline-block rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">Pickup only</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button className="btn-primary inline-flex items-center gap-2" onClick={() => setStep(2)} disabled={!selectedTypeId}>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Details */}
            {step === 2 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Request Details</h2>
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Municipality</label>
                    <input className="input-field" value={selectedMunicipality?.name || ''} disabled title={(user as any)?.municipality_id && selectedMunicipality?.id && (user as any).municipality_id !== selectedMunicipality.id ? 'Viewing other municipality. Submissions go to your registered municipality.' : ''} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Delivery Method</label>
                    <select className="input-field" value={digitalAllowed ? deliveryMethod : 'pickup'} onChange={(e) => setDeliveryMethod(e.target.value as any)}>
                      <option value="digital" disabled={!digitalAllowed}>Digital {digitalAllowed? '(Free)': '(Not available)'}</option>
                      <option value="pickup">Pickup</option>
                    </select>
                    {!digitalAllowed && (
                      <div className="text-xs text-gray-600 mt-1">This document can only be requested in person at the LGU.</div>
                    )}
                  </div>
                  {deliveryMethod === 'pickup' && (
                    <>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium mb-1">Location</label>
                        <select
                          className="input-field"
                          value={pickupLocation}
                          onChange={(e)=> setPickupLocation(e.target.value as any)}
                        >
                          <option value="municipal">{`${(user as any)?.municipality_name || ''} Municipal`}</option>
                          {(user as any)?.barangay_id && (
                            <option value="barangay">{`Barangay ${userBarangayName || ''}`}</option>
                          )}
                        </select>
                        {!((user as any)?.barangay_id) && (
                          <div className="text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded px-2 py-1 mt-1">Add your barangay in your Profile to request documents.</div>
                        )}
                      </div>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Purpose</label>
                    <input className="input-field" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g., employment requirement" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Civil Status (optional)</label>
                    <input className="input-field" value={civilStatus} onChange={(e) => setCivilStatus(e.target.value)} placeholder="e.g., single" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Age (optional)</label>
                    <input className="input-field" type="number" min={0} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g., 22" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Remarks or Additional Information</label>
                    <textarea className="input-field" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Provide extra context to help process your request" />
                    <div className="text-xs text-gray-600 mt-1">Provide extra context or clarifications that may help the office process your request.</div>
                  </div>
                  {requirementsList.length > 0 && (
                    <div className="md:col-span-2 space-y-2">
                      <div className="text-sm font-semibold">Required Attachments</div>
                      <div className="text-xs text-gray-600">Upload a file for each listed requirement. Accepted formats: images or PDF.</div>
                      <div className="space-y-2">
                        {requirementsList.map((label, idx) => (
                          <div key={idx} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-800">{label}</div>
                              <div className="text-xs text-gray-600">Required</div>
                              {requirementInputs[idx]?.file && (
                                <div className="text-xs text-emerald-700 mt-1 truncate">Selected: {requirementInputs[idx]?.file?.name}</div>
                              )}
                            </div>
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="text-xs"
                              onChange={(e) => handleRequirementFileChange(idx, e.target.files?.[0] || null)}
                            />
                          </div>
                        ))}
                      </div>
                      {!hasRequiredFiles && (
                        <div className="text-xs text-rose-700">Attach files for all requirements before continuing.</div>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-col xs:flex-row gap-3 xs:justify-between">
                  <button className="btn btn-secondary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <button className="btn btn-primary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(3)} disabled={!canSubmit || isMismatch}>
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & Submit */}
            {step === 3 && (
              <div>
                <h2 className="text-xl font-bold mb-4">Review & Submit</h2>
                <div className="space-y-2 text-sm">
                  <div><span className="font-medium">Type:</span> {selectedType?.name}</div>
                  <div><span className="font-medium">Municipality:</span> {isMismatch ? `${selectedMunicipality?.name} (viewing) • Submission: ${userMunicipalityName || 'Your municipality'}` : (selectedMunicipality?.name || userMunicipalityName || '')}</div>
                  <div><span className="font-medium">Delivery:</span> {deliveryMethod}{deliveryMethod==='pickup' ? (pickupLocation==='municipal' ? ` • ${(user as any)?.municipality_name || ''} Municipal` : ` • Barangay ${(user as any)?.barangay_name || ''}`) : ''}</div>
                  <div><span className="font-medium">Purpose:</span> {purpose}</div>
                  {civilStatus && <div><span className="font-medium">Civil Status:</span> {civilStatus}</div>}
                  {age && <div><span className="font-medium">Age:</span> {age}</div>}
                  {remarks && <div><span className="font-medium">Remarks:</span> {remarks}</div>}
                  {requirementsList.length > 0 && (
                    <div>
                      <span className="font-medium">Required Attachments:</span>
                      <ul className="list-disc list-inside">
                        {requirementInputs.map((entry, idx) => (
                          <li key={idx} className="text-xs text-gray-700">
                            {entry.label} — {entry.file ? entry.file.name : 'Not attached'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                {deliveryMethod==='digital' && (
                  <div className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-2">Digital copies are free and include a QR code for verification.</div>
                )}
                <label className="mt-4 flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e)=>setConsent(e.target.checked)} />
                  <span>I confirm the information provided is true and I consent to its processing for document issuance.</span>
                </label>
                <div className="mt-6 flex flex-col xs:flex-row gap-3 xs:justify-between items-stretch xs:items-center">
                  <button className="btn btn-secondary w-full xs:w-auto inline-flex items-center gap-2" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Back</span>
                  </button>
                  <GatedAction
                    required="fullyVerified"
                    onAllowed={async () => {
                      if (submitting) return
                      if (isMismatch || !(user as any)?.municipality_id || !selectedTypeId) return
                      setSubmitting(true)
                      setResultMsg('')
                      try {
                        const form = new FormData()
                        form.append('document_type_id', String(selectedTypeId))
                        form.append('municipality_id', String((user as any)!.municipality_id))
                        form.append('delivery_method', deliveryMethod)
                        form.append('pickup_location', pickupLocation)
                        if (pickupLocation === 'barangay' && (user as any)?.barangay_id) {
                          form.append('barangay_id', String((user as any)?.barangay_id))
                        }
                        form.append('purpose', purpose)
                        if (civilStatus) form.append('civil_status', civilStatus)
                        if (age && !Number.isNaN(Number(age))) form.append('age', String(Number(age)))
                        if (remarks) form.append('remarks', remarks)
                        requirementInputs.forEach((entry, idx) => {
                          if (entry.file) {
                            form.append('requirement_files', entry.file, `requirement-${idx + 1}-${entry.file.name}`)
                          }
                        })
                        const res = await documentsApi.createRequest(form)
                        const id = res?.data?.request?.id
                        setCreatedId(id || null)
                        setResultMsg('Request created successfully')
                        // Redirect to dashboard with a flash toast
                        navigate('/dashboard', {
                          replace: true,
                          state: {
                            toast: {
                              type: 'success',
                              message: 'Your document request has been submitted successfully.'
                            }
                          }
                        })
                      } catch (e: any) {
                        setResultMsg(e?.response?.data?.error || 'Failed to create request')
                      } finally {
                        setSubmitting(false)
                      }
                    }}
                    tooltip="Login required to use this feature"
                  >
                    <button className="btn btn-primary w-full xs:w-auto" disabled={!canSubmit || submitting || isMismatch || !consent} title={isMismatch ? 'Requests are limited to your registered municipality' : undefined}>
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </GatedAction>
                </div>
                {resultMsg && (
                  <div className="mt-4 text-sm text-gray-700">
                    {resultMsg}
                    {createdId && (
                      <div className="mt-3">
                        <div className="font-medium mb-1">Upload supporting documents (optional)</div>
                        <FileUploader
                          accept="image/*,.pdf"
                          multiple
                          onFiles={async (files) => {
                            const form = new FormData()
                            files.forEach((f) => form.append('file', f))
                            try {
                              await documentsApi.uploadSupportingDocs(createdId, form)
                              setResultMsg('Files uploaded successfully')
                            } catch {
                              setResultMsg('Upload failed')
                            }
                          }}
                          label="Upload files"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
    </div>
  )
}


