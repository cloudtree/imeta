import { api } from './client'

const PATH = '/tuning'

export const tuningApi = {
  analyze: (data) => api.post(`${PATH}/analyze`, data),
  topSql: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}/top-sql${qs ? `?${qs}` : ''}`)
  },
}
