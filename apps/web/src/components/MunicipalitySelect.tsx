import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore, type Municipality } from '@/lib/store'

const MUNICIPALITIES: Municipality[] = [
  { id: 1, name: 'Botolan', slug: 'botolan' },
  { id: 2, name: 'Cabangan', slug: 'cabangan' },
  { id: 3, name: 'Candelaria', slug: 'candelaria' },
  { id: 4, name: 'Castillejos', slug: 'castillejos' },
  { id: 5, name: 'Iba', slug: 'iba' },
  { id: 6, name: 'Masinloc', slug: 'masinloc' },
  { id: 7, name: 'Palauig', slug: 'palauig' },
  { id: 8, name: 'San Antonio', slug: 'san-antonio' },
  { id: 9, name: 'San Felipe', slug: 'san-felipe' },
  { id: 10, name: 'San Marcelino', slug: 'san-marcelino' },
  { id: 11, name: 'San Narciso', slug: 'san-narciso' },
  { id: 12, name: 'Santa Cruz', slug: 'santa-cruz' },
  { id: 13, name: 'Subic', slug: 'subic' },
]

export default function MunicipalitySelect() {
  const selected = useAppStore((s) => s.selectedMunicipality)
  const setMunicipality = useAppStore((s) => s.setMunicipality)
  const [query, setQuery] = useState('')
  const detailsRef = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const saved = localStorage.getItem('munlink:selectedMunicipality')
    if (saved) setMunicipality(JSON.parse(saved))
  }, [setMunicipality])

  useEffect(() => {
    if (selected) {
      localStorage.setItem('munlink:selectedMunicipality', JSON.stringify(selected))
    } else {
      localStorage.removeItem('munlink:selectedMunicipality')
    }
  }, [selected])

  const filtered = useMemo(() =>
    MUNICIPALITIES.filter(m => m.name.toLowerCase().includes(query.toLowerCase())),
    [query]
  )

  return (
    <div className="relative">
      <details ref={detailsRef} className="group">
        <summary className="list-none cursor-pointer select-none hover:text-ocean-700 font-serif">
          {selected ? selected.name : 'All Municipalities'} ▾
        </summary>
        <div className="absolute right-0 mt-3 w-64 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 p-2 z-50">
          <input
            type="text"
            placeholder="Search municipality..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input-field mb-2"
          />
          <ul className="max-h-64 overflow-auto">
            <li>
              <button
                type="button"
                onClick={() => {
                  setMunicipality(undefined)
                  setQuery('')
                  try { if (detailsRef.current) detailsRef.current.open = false } catch {}
                }}
                className={`w-full text-left px-3 py-2 rounded ${!selected ? 'bg-ocean-50 text-ocean-700' : 'hover:bg-ocean-50'}`}
              >
                All Municipalities (Province-wide)
              </button>
            </li>
            {filtered.map(m => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => { setMunicipality(m); setQuery(''); try { if (detailsRef.current) detailsRef.current.open = false } catch {} }}
                  className={`w-full text-left px-3 py-2 rounded ${selected?.id === m.id ? 'bg-ocean-50 text-ocean-700' : 'hover:bg-ocean-50'}`}
                >
                  {m.name}
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-sm text-gray-500 px-3 py-2">No results</li>
            )}
          </ul>
        </div>
      </details>
    </div>
  )
}


