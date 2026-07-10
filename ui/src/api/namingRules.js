import { api } from './client'

const PATH = '/naming-rules'

export const namingRulesApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}${qs ? `?${qs}` : ''}`)
  },
  getById: (id) => api.get(`${PATH}/${id}`),
  create: (data) => api.post(PATH, data),
  update: (id, data) => api.put(`${PATH}/${id}`, data),
  delete: (id) => api.delete(`${PATH}/${id}`),
}
