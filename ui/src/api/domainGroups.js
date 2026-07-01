import { api } from './client'

const PATH = '/domain-groups'

export const domainGroupsApi = {
  getAll:  ()         => api.get(PATH),
  create:  (data)     => api.post(PATH, data),
  update:  (id, data) => api.put(`${PATH}/${id}`, data),
  delete:  (id)       => api.delete(`${PATH}/${id}`),
}
