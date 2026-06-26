import { useState, useEffect, useCallback } from 'react'
import { termsApi } from '../api/terms'

export function useTerms(params) {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await termsApi.getAll(params)
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

  const create = async (body) => {
    const created = await termsApi.create(body)
    await fetch()
    return created
  }

  const update = async (id, body) => {
    const updated = await termsApi.update(id, body)
    await fetch()
    return updated
  }

  const remove = async (id) => {
    await termsApi.delete(id)
    await fetch()
  }

  return { data, total, loading, error, refetch: fetch, create, update, remove }
}
