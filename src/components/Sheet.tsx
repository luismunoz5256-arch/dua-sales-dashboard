import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

/** Bottom sheet: slides up over the page, closes on backdrop tap or the X. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl max-h-[90vh] flex flex-col max-w-2xl w-full mx-auto safe-bottom">
        <div className="flex items-center px-5 pt-4 pb-2">
          <h2 className="flex-1 text-lg font-bold truncate">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 grid place-items-center rounded-full active:bg-slate-100">
            <X size={24} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-6">{children}</div>
      </div>
    </div>
  )
}
