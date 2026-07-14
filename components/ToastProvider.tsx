import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import RobotMascot, { ToastVariant } from './RobotMascot'

type ToastInput = string | { title: string; message?: string; duration?: number }

type ToastItem = {
  id: number
  variant: ToastVariant
  title: string
  message?: string
  duration: number
}

type ToastApi = {
  show: (variant: ToastVariant, input: ToastInput) => number
  success: (input: ToastInput) => number
  error: (input: ToastInput) => number
  warning: (input: ToastInput) => number
  info: (input: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastApi | null>(null)

/** Access the toast API. Usage: const toast = useToast(); toast.success('Saved') */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const MAX_VISIBLE = 4
const DEFAULT_DURATION = 4800

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((variant: ToastVariant, input: ToastInput): number => {
    const o = typeof input === 'string' ? { title: input } : input
    const id = idRef.current++
    const item: ToastItem = {
      id, variant, title: o.title, message: o.message,
      duration: o.duration ?? DEFAULT_DURATION,
    }
    // Newest at the end (renders nearest the bottom-right corner); cap the stack.
    setToasts((list) => [...list, item].slice(-MAX_VISIBLE))
    return id
  }, [])

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (i) => show('success', i),
    error: (i) => show('error', i),
    warning: (i) => show('warning', i),
    info: (i) => show('info', i),
    dismiss,
  }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="atlas-toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [leaving, setLeaving] = useState(false)

  function close() {
    if (leaving) return
    setLeaving(true)
    // Match the CSS exit animation duration before removing from state.
    setTimeout(() => onDismiss(toast.id), 240)
  }

  return (
    <div className={`atlas-toast atlas-toast-${toast.variant}${leaving ? ' leaving' : ''}`} role="status">
      <div className="atlas-toast-bot">
        <RobotMascot variant={toast.variant} />
      </div>
      <div className="atlas-toast-body">
        <p className="atlas-toast-title">{toast.title}</p>
        {toast.message && <p className="atlas-toast-msg">{toast.message}</p>}
      </div>
      <button type="button" className="atlas-toast-x" aria-label="Dismiss notification" onClick={close}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <span
        className="atlas-toast-bar"
        style={{ animationDuration: `${toast.duration}ms` }}
        onAnimationEnd={close}
      />
    </div>
  )
}
