import { api } from './client'

const PATH = '/words'

export const wordsApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}${qs ? `?${qs}` : ''}`)
  },
  dictionary: () => api.get(`${PATH}/dictionary`),
  lookupEn:   (q) => api.get(`${PATH}/dictionary-en?${new URLSearchParams({ q })}`),
  getById: (id) => api.get(`${PATH}/${id}`),
  create: (data) => api.post(PATH, data),
  update: (id, data) => api.put(`${PATH}/${id}`, data),
  delete: (id) => api.delete(`${PATH}/${id}`),
  deleteAll: () => api.delete(`${PATH}/all`),
  bulk:   (rows) => api.post(`${PATH}/bulk`, rows),
}
