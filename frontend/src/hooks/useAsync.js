import { useCallback, useEffect, useState } from 'react'

export default function useAsync(loader) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await loader())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [loader])

  useEffect(() => {
    const timer = window.setTimeout(reload, 0)
    return () => window.clearTimeout(timer)
  }, [reload])
  return { data, loading, error, reload, setData }
}
