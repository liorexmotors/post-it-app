import axios from 'axios'

// In dev: proxy via vite (localhost:3001)
// In production: VITE_API_URL = Railway backend URL
const BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/api'
  : '/api'

const api = axios.create({ baseURL: BASE })

export const getPosts = (params) => api.get('/posts', { params })
export const getPost = (id) => api.get(`/posts/${id}`)
export const createPost = (data) => api.post('/posts', data, {
  headers: { 'Content-Type': 'multipart/form-data' }
})
export const updatePost = (id, data) => api.put(`/posts/${id}`, data)
export const deletePost = (id) => api.delete(`/posts/${id}`)
export const sendPostNow = (id) => api.post(`/posts/${id}/send-now`)
export const getStats = () => api.get('/posts/stats/summary')

export const getGroups = (params) => api.get('/groups', { params })
export const syncGroups = () => api.post('/groups/sync', null, { timeout: 60000 })
export const addGroup = (data) => api.post('/groups', data)
export const toggleGroup = (id) => api.put(`/groups/${id}/toggle`)
export const deleteGroup = (id) => api.delete(`/groups/${id}`)
export const deleteAllGroups = () => api.delete('/groups')

export const getCampaigns = () => api.get('/campaigns')
export const createCampaign = (data) => api.post('/campaigns', data)
export const deleteCampaign = (id) => api.delete(`/campaigns/${id}`)

export const enhanceText = (text, style) => api.post('/ai/enhance', { text, style })
export const getSettings = () => api.get('/ai/settings')
export const saveSettings = (data) => api.post('/ai/settings', data)

export const getSession = () => api.get('/session')
export const saveSession = (data) => api.post('/session', data, { timeout: 30000 })
export const deleteSession = () => api.delete('/session')

export const getStatus = () => api.get('/status')

export default api
