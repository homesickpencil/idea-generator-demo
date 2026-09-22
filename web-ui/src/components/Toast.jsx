import { useEffect } from 'react'

// Tiny transient confirmation pill (bottom-center). Auto-dismisses.
export default function Toast({ message, onDone, ms = 2200 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, ms)
    return () => clearTimeout(t)
  }, [message, ms, onDone])

  if (!message) return null
  return <div className="toast" role="status">{message}</div>
}
