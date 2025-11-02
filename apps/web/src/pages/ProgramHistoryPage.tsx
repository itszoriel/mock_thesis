import { useEffect, useState } from 'react'
import { Card, EmptyState, StatusBadge } from '@munlink/ui'
import { benefitsApi, handleApiError } from '@/lib/api'

type HistoryItem = {
  id: number
  application_number?: string
  status?: string
  completion_date?: string
  program?: {
    name?: string
    title?: string
    description?: string
    completed_at?: string
    program_type?: string
  }
}

export default function ProgramHistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const res = await benefitsApi.getMyHistory()
        const items = (res?.data?.history ?? (res as any)?.history) || []
        if (mounted) setHistory(Array.isArray(items) ? items : [])
      } catch (err) {
        if (mounted) setError(handleApiError(err, 'Failed to load program history'))
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const renderCompletionDate = (item: HistoryItem) => {
    const raw = item.completion_date || item.program?.completed_at
    if (!raw) return '—'
    const date = new Date(raw)
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString()
  }

  return (
    <div className="container-responsive py-12">
      <div className="mb-6">
        <h1 className="text-fluid-3xl font-serif font-semibold">Program History</h1>
        <p className="text-gray-600">✅ You've completed these programs.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white/80 rounded-2xl p-6 border border-white/60">
              <div className="h-6 w-32 skeleton rounded mb-2" />
              <div className="h-4 w-48 skeleton rounded" />
              <div className="mt-4 h-3 w-full skeleton rounded" />
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <EmptyState
          title="No completed programs yet"
          description="Once your applications are approved, they will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {history.map((item) => (
            <Card key={item.id ?? item.application_number} className="flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {item.program?.name || item.program?.title || 'Program'}
                    </h3>
                    {item.application_number && (
                      <div className="text-xs text-neutral-500">Application No. {item.application_number}</div>
                    )}
                  </div>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
                <div className="mt-3 text-sm text-neutral-600 space-y-2">
                  {item.program?.program_type && (
                    <div><span className="font-medium">Type:</span> {item.program.program_type}</div>
                  )}
                  <div><span className="font-medium">Completed on:</span> {renderCompletionDate(item)}</div>
                  {item.program?.description && (
                    <p className="text-neutral-700 leading-relaxed line-clamp-3">{item.program.description}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


