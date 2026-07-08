import { api } from './client'

const PATH = '/db-servers'

export const dbServersApi = {
  getAll: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}${qs ? `?${qs}` : ''}`)
  },
  getById: (id) => api.get(`${PATH}/${id}`),
  create: (data) => api.post(PATH, data),
  update: (id, data) => api.put(`${PATH}/${id}`, data),
  delete: (id) => api.delete(`${PATH}/${id}`),
  test: (data) => api.post(`${PATH}/test`, data),
  testById: (id) => api.post(`${PATH}/${id}/test`),
  getSchemaTables: (id, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`${PATH}/${id}/schema/tables${qs ? `?${qs}` : ''}`)
  },
  getTableDefinition: (id, schema, table, params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(
      `${PATH}/${id}/schema/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}${qs ? `?${qs}` : ''}`,
    )
  },
}
