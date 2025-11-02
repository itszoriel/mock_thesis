import React, { useEffect, useState } from 'react'

export type ModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

const ANIMATION_DURATION_MS = 180

export const Modal: React.FC<ModalProps> = ({ open, onOpenChange, title, children, footer, className }) => {
  const [rendered, setRendered] = useState(open)

  useEffect(() => {
    if (open) setRendered(true)
  }, [open])

  useEffect(() => {
    if (!open || !rendered) return undefined
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, rendered, onOpenChange])

  useEffect(() => {
    if (open || !rendered) return undefined
    const timer = window.setTimeout(() => setRendered(false), ANIMATION_DURATION_MS)
    return () => window.clearTimeout(timer)
  }, [open, rendered])

  if (!rendered) return null

  const handleBackdropClick = () => {
    if (!open) return
    onOpenChange(false)
  }

  const backdropClass = `absolute inset-0 bg-black/50 transition-opacity duration-200 ease-out ${open ? 'opacity-100' : 'opacity-0'}`
  const contentClass = `relative w-full max-w-none sm:max-w-2xl bg-[var(--color-card)] text-[var(--color-card-foreground)] border border-[var(--color-border)] shadow-xl rounded-none sm:rounded-2xl transform transition-all duration-200 ease-out ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'} ${className || ''}`.trim()

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 transition-opacity duration-200 ease-out ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className={backdropClass} />
      <div
        className={contentClass}
        onClick={(e) => e.stopPropagation()}
      >
        {(title !== undefined) && (
          <div className="p-4 border-b border-[var(--color-border)]"><h2 className="text-lg font-semibold">{title}</h2></div>
        )}
        <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">{children}</div>
        {footer !== undefined ? (
          <div className="p-4 border-t border-[var(--color-border)]">{footer}</div>
        ) : null}
      </div>
    </div>
  )
}


