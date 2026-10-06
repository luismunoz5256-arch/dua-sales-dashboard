import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

interface ToastAction {
  label: string
  onClick: () => void
}
interface ToastData {
  id: number
  message: string
  actions: ToastAction[]
}

const Ctx = createContext<(message: string, actions?: ToastAction[]) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((message: string, actions: ToastAction[] = []) => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), message, actions })
    timer.current = window.setTimeout(() => setToast(null), actions.length ? 6000 : 2500)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className="fixed inset-x-0 z-50 px-3 pointer-events-none"
          style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto bg-slate-900 text-white rounded-xl shadow-lg flex items-center gap-1 pl-4 pr-1 min-h-14 pointer-events-auto">
            <span className="flex-1 text-sm py-3">{toast.message}</span>
            {toast.actions.map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  setToast(null)
                  a.onClick()
                }}
                className="h-12 px-3 rounded-lg font-bold text-sm text-orange-300 active:bg-white/10"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
