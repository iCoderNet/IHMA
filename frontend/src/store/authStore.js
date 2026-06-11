import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true })
        try {
          const res = await api.post('/auth/login', { username, password })
          const { access_token, refresh_token, user } = res.data
          set({ user, accessToken: access_token, refreshToken: refresh_token, isLoading: false })
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          return { success: false, error: err.response?.data?.detail || 'Xato' }
        }
      },

      logout: () => {
        set({ user: null, accessToken: null, refreshToken: null })
      },

      setTokens: (access_token, refresh_token) => {
        set({ accessToken: access_token, refreshToken: refresh_token })
      },

      isAuthenticated: () => !!get().accessToken,
      isSuperAdmin: () => get().user?.role === 'superadmin',
      isAdmin: () => get().user?.role === 'admin',
    }),
    {
      name: 'ihma-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
)

export default useAuthStore
