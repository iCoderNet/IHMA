import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// Request interceptor - add auth token
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('ihma-auth')
  if (stored) {
    try {
      const { state } = JSON.parse(stored)
      if (state?.accessToken) {
        config.headers.Authorization = `Bearer ${state.accessToken}`
      }
    } catch {}
  }
  return config
})

// Response interceptor - handle 401 / refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const stored = localStorage.getItem('ihma-auth')
        const { state } = JSON.parse(stored)
        if (state?.refreshToken) {
          const res = await axios.post('/api/auth/refresh', {
            refresh_token: state.refreshToken,
          })
          const { access_token, refresh_token } = res.data
          // Update store
          const parsed = JSON.parse(stored)
          parsed.state.accessToken = access_token
          parsed.state.refreshToken = refresh_token
          localStorage.setItem('ihma-auth', JSON.stringify(parsed))
          original.headers.Authorization = `Bearer ${access_token}`
          return api(original)
        }
      } catch {
        // Refresh failed - logout
        localStorage.removeItem('ihma-auth')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
