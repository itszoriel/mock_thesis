import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { marketplaceApi, mediaUrl } from '@/lib/api'

type Item = {
  id: number
  title: string
  description?: string
  price?: number
  transaction_type?: 'donate'|'lend'|'sell'
  images?: string[]
}

export default function MarketplaceItemPage() {
  const { id } = useParams()
  const [item, setItem] = useState<Item | null>(null)
  const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await marketplaceApi.getItem(Number(id))
        const data: any = (res as any)?.data || res
        if (!cancelled) setItem(data)
      } catch {
        if (!cancelled) setItem(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) load()
    return () => { cancelled = true }
  }, [id])

  const images = item?.images || []
  const count = images.length
  const safeIdx = Math.min(Math.max(0, idx), Math.max(0, count - 1))
  const hasMany = count > 1

  return (
    <div className="container-responsive py-8">
      <div className="mb-4">
        <Link to="/marketplace" className="text-sm text-ocean-700 hover:underline">← Back to Marketplace</Link>
      </div>
      {loading ? (
        <div className="h-64 rounded-xl bg-neutral-100" />
      ) : !item ? (
        <div className="text-neutral-600">Item not found.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative w-full aspect-[4/3] bg-neutral-100 rounded-xl overflow-hidden">
            {images[safeIdx] ? (
              <img src={mediaUrl(images[safeIdx])} alt={item.title} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full" />)
            }
            {hasMany && (
              <>
                <button
                  type="button"
                  aria-label="Prev"
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-white rounded-full p-2 z-10"
                  onClick={() => setIdx((i) => (i - 1 + count) % count)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black text-white rounded-full p-2 z-10"
                  onClick={() => setIdx((i) => (i + 1) % count)}
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                  {images.map((_, i) => (
                    <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === safeIdx ? 'bg-black' : 'bg-black/40'}`} />
                  ))}
                </div>
              </>
            )}
          </div>
          {hasMany && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  aria-label={`Image ${i + 1}`}
                  className={`h-16 w-16 flex-shrink-0 rounded border bg-white ${i === safeIdx ? 'ring-2 ring-ocean-600' : ''}`}
                  onClick={() => setIdx(i)}
                >
                  <img src={mediaUrl(img)} alt="thumb" className="w-full h-full object-contain rounded" />
                </button>
              ))}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 mb-2">{item.title}</h1>
            {item.transaction_type && (
              <div className="mb-3"><span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-neutral-100">{item.transaction_type}</span></div>
            )}
            {item.transaction_type === 'sell' && typeof item.price === 'number' && (
              <div className="text-xl font-bold text-primary-600 mb-4">₱{Number(item.price).toLocaleString()}</div>
            )}
            {item.description && (
              <p className="text-neutral-700 whitespace-pre-wrap">{item.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


