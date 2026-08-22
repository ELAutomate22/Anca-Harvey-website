import { useEffect, useId, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { modalVariants } from '@/lib/motion'
import { useReducedMotionPreference } from '@/hooks/useReducedMotionPreference'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  panelClassName?: string
}

const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const Modal = ({ open, onClose, title, children, panelClassName = '' }: ModalProps) => {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotionPreference()

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(focusableSelector)
    window.setTimeout(() => (first ?? panel)?.focus(), 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab' || !panel) return
      const elements = [...panel.querySelectorAll<HTMLElement>(focusableSelector)]
      if (!elements.length) return
      const firstElement = elements[0]
      const lastElement = elements.at(-1)
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement?.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previous?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay)] p-0 backdrop-blur-[3px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16 } }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            variants={modalVariants}
            initial={reducedMotion ? false : 'hidden'}
            animate="visible"
            exit="exit"
            className={`relative max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-t-[1.25rem] bg-elevated p-5 text-foreground shadow-[var(--shadow-deep)] sm:rounded-[1.25rem] sm:p-8 ${panelClassName}`}
          >
            <div className="mb-6 flex items-start justify-between gap-6">
              <h2 id={titleId} className="font-display text-3xl font-medium leading-none sm:text-4xl">{title}</h2>
              <button onClick={onClose} aria-label="Close dialog" className="grid size-12 shrink-0 place-items-center rounded-full border border-line transition-colors hover:bg-surface">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
