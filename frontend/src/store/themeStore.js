import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'ihma_light',
      toggleTheme: () => {
        const next = get().theme === 'ihma_light' ? 'ihma_dark' : 'ihma_light'
        set({ theme: next })
        document.documentElement.setAttribute('data-theme', next)
      },
      initTheme: () => {
        const theme = get().theme
        document.documentElement.setAttribute('data-theme', theme)
      },
    }),
    { name: 'ihma-theme' }
  )
)

export default useThemeStore
