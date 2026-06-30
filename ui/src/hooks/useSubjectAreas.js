import { useState, useEffect, useCallback } from 'react'
import { subjectAreasApi } from '../api/subjectAreas'

export function useSubjectAreas(params) {
  const [data,    setData]    = useState([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await subjectAreasApi.getAll(params)
      if (Array.isArray(res)) {
        setData(res)
        setTotal(res.length)
      } else {
        setData(res.items ?? [])
        setTotal(res.total ?? 0)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [JSON.stringify(params)]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetch() }, [fetch])

  const create = async (body) => { const r = await subjectAreasApi.create(body);      await fetch(); return r }
  const update = async (id, body) => { const r = await subjectAreasApi.update(id, body); await fetch(); return r }
  const remove = async (id) => { await subjectAreasApi.delete(id); await fetch() }

  return { data, total, loading, error, refetch: fetch, create, update, remove }
}
