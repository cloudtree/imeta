import { api } from './client'

const PATH = '/table-definitions'

export const tableDefinitionsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}${qs ? `?${qs}` : ''}`)
  },
  getTables: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}/tables${qs ? `?${qs}` : ''}`)
  },
  getTableDetail: (params) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}/tables/detail?${qs}`)
  },
  bulk: (rows) => api.post(`${PATH}/bulk`, rows),
  deleteTable: (params) => {
    const qs = new URLSearchParams(params).toString()
    return api.delete(`${PATH}/tables?${qs}`)
  },
  delete: (id) => api.delete(`${PATH}/${id}`),
}
