import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import FloatingAIAgent from '../FloatingAIAgent'
import useThemeStore from '../../store/themeStore'

const PAGE_TITLES = {
  '/superadmin': 'Dashboard',
  '/superadmin/sections': "Bo'limlar",
  '/superadmin/appeals': 'Murojaatlar',
  '/superadmin/map': 'Xarita',
  '/superadmin/bot-settings': 'Bot sozlamalari',
  '/superadmin/bot-users': 'Bot foydalanuvchilar',
  '/superadmin/broadcast': 'Ommaviy xabar',
  '/superadmin/admins': 'Adminlar',
  '/superadmin/districts': 'Tumanlar',
  '/admin': 'Dashboard',
  '/admin/sections': "Bo'limlar",
  '/admin/appeals': 'Murojaatlar',
  '/admin/map': 'Xarita',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { initTheme } = useThemeStore()

  useEffect(() => { initTheme() }, [])

  const title = PAGE_TITLES[location.pathname] ||
    (location.pathname.includes('/sections/') ? "Bo'lim ma'lumotlari" : 'IHMA')

  return (
    <div className="flex h-screen bg-base-200 overflow-hidden">
      <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <FloatingAIAgent />
    </div>
  )
}
