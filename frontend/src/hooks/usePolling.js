import { useCallback, useEffect, useRef, useState } from 'react'

// One request at a time; pause background tabs and cancel state updates on unmount.
export default function usePolling(loader, interval = 10000, eventName) {
  const [state, setState] = useState({ data: null, loading: true, error: '' })
  const refresh = useRef(() => {})
  const reload = useCallback(() => refresh.current(), [])
  useEffect(() => {
    let active = true, busy = false, queued = false, timer
    const run = async () => {
      if (!active) return
      if (busy) { queued = true; return }
      clearTimeout(timer)
      if (document.hidden) { timer = setTimeout(run, interval); return }
      busy = true
      try {
        const data = await loader()
        if (active) setState({ data, loading: false, error: '' })
      } catch (error) { if (active) setState(old => ({ ...old, loading: false, error: error.message })) }
      finally { busy = false; if (active) timer = setTimeout(run, queued ? 0 : interval); queued = false }
    }
    setState({ data: null, loading: true, error: '' })
    refresh.current = run
    run()
    const visible = () => { if (!document.hidden) run() }
    document.addEventListener('visibilitychange', visible)
    if (eventName) window.addEventListener(eventName, run)
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', visible); if (eventName) window.removeEventListener(eventName, run) }
  }, [loader, interval, eventName])
  return { ...state, reload }
}
