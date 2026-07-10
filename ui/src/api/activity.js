import { api } from './client'

export const activityApi = {
  getRecent: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return api.get(`/activity/recent${qs ? `?${qs}` : ''}`)
  },
}
