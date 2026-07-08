import { useState, useEffect, useCallback } from 'react'
import { tableDefinitionsApi } from '../api/tableDefinitions'

export function useTableDefinitions(params) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await tableDefinitionsApi.getTables(params)
      setData(res.items ?? [])
      setTotal(res.total ?? res.items?.length ?? 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(params)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  return { data, total, loading, error, refetch: fetch }
}
