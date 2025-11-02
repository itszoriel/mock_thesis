import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { announcementsApi, marketplaceApi, mediaUrl } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { Link } from 'react-router-dom'
import AnnouncementCard from '@/components/AnnouncementCard'
import MarketplaceCard from '@/components/MarketplaceCard'
import { Globe } from 'lucide-react'

export default function HomePage() {
  const selectedMunicipality = useAppStore((s) => s.selectedMunicipality)
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const [loading, setLoading] = useState(true)
  const [recentAnnouncements, setRecentAnnouncements] = useState<any[]>([])
  const [featuredItems, setFeaturedItems] = useState<any[]>([])
  // Removed mock announcements; show nothing if none.
  // Keep marketplace fallback minimal to maintain layout without empty collapse.
  const fallbackItems: Array<{ id?: number; title: string; price?: number; transaction_type: string; images?: string[] }> = []

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const [a, i] = await Promise.allSettled([
          announcementsApi.getAll({ active: true, page: 1, per_page: 3, municipality_id: selectedMunicipality?.id }),
          marketplaceApi.getItems({ status: 'available', page: 1, per_page: 4, municipality_id: selectedMunicipality?.id })
        ])
        if (cancelled) return
        if (a.status === 'fulfilled') setRecentAnnouncements(a.value.data?.announcements || [])
        else setRecentAnnouncements([])
        if (i.status === 'fulfilled') setFeaturedItems(i.value.data?.items || [])
        else setFeaturedItems([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedMunicipality?.id])

  return (
    <div>
      {/* Hero with scenic background and provincial seal watermark */}
      <section className="relative h-[70vh] min-h-[560px] w-full overflow-hidden">
        <img
          src={new URL('../../../../public/reference/Nature.jpg', import.meta.url).toString()}
          alt="Zambales scenic"
          className="absolute inset-0 h-full w-full object-cover scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ocean-900/60 via-ocean-900/40 to-neutral-900/60" />
        {/* Provincial seal watermark overlay */}
        <img
          src={new URL('../../../../public/logos/zambales/512px-Seal_of_Province_of_Zambales.svg.png', import.meta.url).toString()}
          alt="Zambales Seal"
          className="pointer-events-none select-none absolute inset-0 m-auto h-[60%] w-auto opacity-25 mix-blend-overlay"
          style={{ filter: 'grayscale(100%)' }}
        />
        <div className="relative z-10 h-full flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-10 xl:px-12">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-white leading-tight tracking-tight font-serif font-semibold drop-shadow text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5rem] 2xl:text-[6rem]"
            >
              Lalawigan ng Zambales
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-white/90 mt-4 max-w-4xl leading-relaxed text-base sm:text-lg md:text-xl lg:text-2xl xl:text-[1.5rem] 2xl:text-[1.75rem]"
            >
             Munlink: Bringing Zambales municipalities into the digital age with modern, user-friendly solutions for municipal governance.
            </motion.p>
          </div>
        </div>
      </section>

      {/* Guest intro CTA moved below Announcements & Marketplace */}

      {/* Two-column layout: Latest Announcements (left) and Featured Marketplace (right) */}
      <section className="container-responsive py-10 md:py-12 mt-10 md:mt-12">
        {selectedMunicipality && (
          <div className="mx-auto mb-6 max-w-6xl">
            <div className="inline-flex items-start gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-xs sm:text-sm text-neutral-600">
              <Globe className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-500" aria-hidden="true" />
              <span>
                You are viewing updates for <strong>{selectedMunicipality.name}</strong>. Choose “All Municipalities” in the header selector to see announcements and marketplace posts from the entire province.
              </span>
            </div>
          </div>
        )}
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: Latest Announcements */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-gray-900">Latest Announcements</h2>
              <Link to="/announcements" className="btn-secondary">Show all</Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <div key={`ann-skel-${i}`} className="skeleton-card">
                    <div className="aspect-[16/10] skeleton-image" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-2/3 skeleton" />
                      <div className="h-4 w-1/2 skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
                {(recentAnnouncements).map((a) => (
                  <AnnouncementCard
                    key={a.id}
                    id={a.id}
                    title={a.title}
                    content={a.content}
                    municipality={a.municipality_name || 'Province-wide'}
                    priority={a.priority}
                    createdAt={a.created_at}
                    images={a.images}
                    pinned={(a as any).pinned}
                    href={'/announcements'}
                  />
                ))}
                {(!recentAnnouncements || recentAnnouncements.length === 0) && (
                  <div className="text-sm text-gray-600">No announcements.</div>
                )}
              </div>
            )}
          </div>

          {/* Right: Featured Marketplace */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl md:text-3xl font-serif font-semibold text-gray-900">Featured Marketplace</h2>
              <Link to="/marketplace" className="btn-secondary">View All</Link>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`market-skel-${i}`} className="skeleton-card">
                    <div className="aspect-[4/3] skeleton-image" />
                    <div className="p-4 space-y-2">
                      <div className="h-4 w-2/3 skeleton" />
                      <div className="h-4 w-1/2 skeleton" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-5">
                {(featuredItems.length ? featuredItems : fallbackItems).map((it: any) => (
                  <motion.div key={it.id} initial={{opacity:0,y:8}} whileInView={{opacity:1,y:0}} viewport={{once:true}}>
                    <MarketplaceCard
                      imageUrl={it.images?.[0] ? mediaUrl(it.images[0]) : undefined}
                      title={it.title}
                      price={it.transaction_type==='sell' && it.price ? `₱${Number(it.price).toLocaleString()}` : undefined}
                      municipality={(it as any).municipality_name || selectedMunicipality?.name || 'Province-wide'}
                      transactionType={it.transaction_type}
                      href={'/marketplace'}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Guest intro CTA (bottom) */}
      {!isAuthenticated && (
        <section className="container-responsive py-8">
          <div className="max-w-6xl mx-auto bg-white/80 backdrop-blur-xl border rounded-2xl shadow-card p-6 md:p-8">
            <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3 md:gap-6">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-serif font-semibold text-gray-900">Welcome to MunLink Zambales</h2>
                <p className="text-gray-700 mt-2">Browse public announcements and the marketplace. Create an account to post items, request documents, report issues, and more.</p>
              </div>
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
                <Link to="/register" className="btn btn-primary w-full xs:w-auto text-center">Create Account</Link>
                <Link to="/announcements" className="btn btn-secondary w-full xs:w-auto text-center">Browse Announcements</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Map teaser removed per request */}
    </div>
  )
}

