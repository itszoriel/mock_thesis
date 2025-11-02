import type { ReactNode } from 'react'

type HeaderStat = {
  label: string
  value: ReactNode
  helper?: ReactNode
  tone?: 'ocean' | 'forest' | 'sunset' | 'purple' | 'red' | 'neutral'
}

const toneClass = (tone?: HeaderStat['tone']) => {
  switch (tone) {
    case 'forest':
      return 'from-forest-400/50 to-forest-600/60'
    case 'sunset':
      return 'from-sunset-400/50 to-sunset-600/60'
    case 'purple':
      return 'from-purple-400/50 to-purple-600/60'
    case 'red':
      return 'from-red-400/50 to-red-600/60'
    case 'neutral':
      return 'from-white/60 to-white/30 text-ocean-900'
    case 'ocean':
    default:
      return 'from-ocean-400/50 to-ocean-600/60'
  }
}

export function AdminPageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-8 ${className ?? ''}`}>{children}</div>
}

interface AdminPageHeaderProps {
  overline?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  stats?: HeaderStat[]
  children?: ReactNode
  kicker?: ReactNode
}

export function AdminPageHeader({ overline, title, description, actions, stats, children, kicker }: AdminPageHeaderProps) {
  const showStats = Array.isArray(stats) && stats.length > 0
  const statColumns = showStats && stats!.length > 2 ? 'grid-cols-2' : 'grid-cols-1'

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-ocean-500 via-ocean-400 to-forest-500 text-white shadow-xl">
      <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-black/10 blur-3xl" aria-hidden="true" />
      <div className="relative z-10 flex flex-col gap-6 px-6 py-8 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          {overline && (
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1 text-sm font-medium">
              {overline}
            </span>
          )}
          <h1 className="text-3xl font-serif font-semibold sm:text-4xl">{title}</h1>
          {description && <p className="max-w-3xl text-base text-white/85 sm:text-lg">{description}</p>}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          {kicker}
        </div>
        {showStats && (
          <div className={`grid min-w-[220px] gap-3 ${statColumns}`}>
            {stats!.map((stat, index) => (
              <div
                key={`${stat.label}-${index}`}
                className={`rounded-2xl bg-white/15 px-4 py-3 text-left shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5`}
              >
                <div className="text-lg font-semibold">{stat.value}</div>
                <div className="text-xs uppercase tracking-wide text-white/70">{stat.label}</div>
                {stat.helper && <div className="mt-1 text-xs text-white/65">{stat.helper}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
      {children && (
        <div className="relative z-10 border-t border-white/20 bg-white/5 px-6 py-6 sm:px-10">
          {children}
        </div>
      )}
    </section>
  )
}

interface AdminSectionProps {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  bleed?: boolean
  borderlessHeader?: boolean
}

export function AdminSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  padding = 'md',
  bleed = false,
  borderlessHeader = false,
}: AdminSectionProps) {
  const paddingClass = padding === 'none' ? '' : padding === 'sm' ? 'p-4 sm:p-5' : padding === 'lg' ? 'p-8 sm:p-10' : 'p-6'
  const baseClass = 'rounded-3xl border border-white/60 bg-white/90 shadow-xl backdrop-blur'
  const headerBorderClass = borderlessHeader ? '' : 'border-b border-white/60'

  return (
    <section className={`${baseClass} ${className ?? ''}`}>
      {(title || description || actions) && (
        <div className={`flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between ${headerBorderClass}`}>
          <div className="space-y-1">
            {title && <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>}
            {description && <p className="text-sm text-neutral-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
        </div>
      )}
      <div className={`${paddingClass} ${bleed ? 'overflow-hidden' : ''} ${contentClassName ?? ''}`}>{children}</div>
    </section>
  )
}

export function StatPill({ label, value, tone }: { label: string; value: ReactNode; tone?: HeaderStat['tone'] }) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br px-4 py-3 text-left text-white shadow-sm ${toneClass(tone)}`}>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-white/80">{label}</div>
    </div>
  )
}

