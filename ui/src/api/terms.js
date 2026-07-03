import { api } from './client'

const PATH = '/terms'

export const termsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}${qs ? `?${qs}` : ''}`)
  },
  getById: (id) => api.get(`${PATH}/${id}`),
  create: (data) => api.post(PATH, data),
  update: (id, data) => api.put(`${PATH}/${id}`, data),
  delete: (id) => api.delete(`${PATH}/${id}`),
  deleteAll: () => api.delete(`${PATH}/all`),
  lookupDesc: (q) => api.get(`${PATH}/ai-desc?${new URLSearchParams({ q })}`),
  bulk:   (rows) => api.post(`${PATH}/bulk`, rows),
}
