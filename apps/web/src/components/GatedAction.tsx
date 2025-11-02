import { useMemo, useState, isValidElement, cloneElement } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/lib/store'
import Modal from '@/components/ui/Modal'

type Props = {
  required?: 'authenticated' | 'emailVerified' | 'fullyVerified'
  onAllowed: () => void | Promise<void>
  children: ReactNode
  className?: string
  tooltip?: string
  disabled?: boolean
  loading?: boolean
}

export default function GatedAction({
  required = 'fullyVerified',
  onAllowed,
  children,
  className = '',
  tooltip,
  disabled,
  loading,
}: Props) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const emailVerified = useAppStore((s) => s.emailVerified)
  const adminVerified = useAppStore((s) => s.adminVerified)
  const verificationStatus = useAppStore((s) => s.verificationStatus)
  const verificationNotes = useAppStore((s) => s.verificationNotes)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const allowed = useMemo(() => {
    const needsRevision = (verificationStatus || '').toLowerCase() === 'needs_revision'
    if (required === 'authenticated') return isAuthenticated
    if (required === 'emailVerified') return isAuthenticated && emailVerified && !needsRevision
    return isAuthenticated && emailVerified && adminVerified && !needsRevision
  }, [required, isAuthenticated, emailVerified, adminVerified, verificationStatus])

  const dynamicReason = useMemo(() => {
    if (!isAuthenticated) return 'Please log in first to continue.'
    if (!emailVerified) return 'Verify your Gmail account first to unlock full access.'
    if ((verificationStatus || '').toLowerCase() === 'needs_revision') {
      return `Your account needs updates before approval. ${verificationNotes ? `Feedback: ${verificationNotes}` : 'Visit the Resolve Review page to resubmit.'}`
    }
    if (!adminVerified) return 'Your account is still under admin review. Please wait for approval.'
    return 'This action is currently unavailable.'
  }, [isAuthenticated, emailVerified, adminVerified, verificationStatus, verificationNotes])

  const tooltipText = useMemo(() => {
    if (tooltip) return tooltip
    if (allowed) return ''
    if (!isAuthenticated) return 'Login required to use this feature'
    if (!emailVerified) return 'Email verification required'
    if ((verificationStatus || '').toLowerCase() === 'needs_revision') return 'Account needs updates before approval'
    if (!adminVerified) return 'Admin approval required'
    return ''
  }, [tooltip, allowed, isAuthenticated, emailVerified, adminVerified, verificationStatus])

  const wrappedChild = useMemo(() => {
    if (!isValidElement(children)) return children
    const originalOnClick: any = (children as any).props?.onClick
    const injectedOnClick = (e: any) => {
      // Prevent form submission when gating
      if (!allowed) {
        e.preventDefault?.()
        e.stopPropagation?.()
        setOpen(true)
        return
      }
      if (disabled || loading) return
      if (typeof onAllowed === 'function') onAllowed()
      if (typeof originalOnClick === 'function') originalOnClick(e)
    }
    const ariaDisabled = (!allowed) || !!disabled
    const childClass = `${(children as any).props?.className || ''} ${className || ''} ${!allowed ? 'opacity-60 cursor-not-allowed' : ''}`.trim()
    return cloneElement(children as any, { onClick: injectedOnClick, 'aria-disabled': ariaDisabled, className: childClass })
  }, [children, allowed, disabled, loading, onAllowed, className])

  return (
    <div className="relative inline-block group">
      {wrappedChild}

      {!allowed && tooltipText && (
        <div className="pointer-events-none invisible group-hover:visible absolute z-50 left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded-md text-xs text-white bg-gray-900 shadow-lg whitespace-nowrap">
          {tooltipText}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Action requires account access"
        footer={
          <div className="flex items-center justify-end gap-2">
            <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200">Close</button>
            {!isAuthenticated && (
              <>
                <button onClick={() => navigate('/login')} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Log In</button>
                <button onClick={() => navigate('/register')} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Create Account</button>
              </>
            )}
            {isAuthenticated && !emailVerified && (
              <button onClick={() => navigate('/verify-email')} className="px-3 py-1.5 rounded-lg bg-ocean-600 text-white hover:bg-ocean-700">Verify Email</button>
            )}
          </div>
        }
      >
        <div className="space-y-2 text-gray-800 text-sm">
          <p>{dynamicReason}</p>
          <ul className="list-disc list-inside text-gray-700">
            <li>Post marketplace items</li>
            <li>Request or transact on listings</li>
            <li>Apply for benefits and request documents</li>
            <li>Report and track community issues</li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}


