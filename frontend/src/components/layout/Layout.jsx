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
  '/superadmin/ijtimoiy-hodimlar': 'Ijtimoiy hodimlar',
  '/admin': 'Dashboard',
  '/admin/sections': "Bo'limlar",
  '/admin/appeals': 'Murojaatlar',
  '/admin/map': 'Xarita',
  '/admin/ijtimoiy-hodimlar': 'Ijtimoiy hodimlar',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { initTheme } = useThemeStore()

  useEffect(() => { initTheme() }, [])

  // Auto-close mobile sidebar on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Collapse on small screens, expand on large
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1024) setCollapsed(true)
      else setCollapsed(false)
    }
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const title = PAGE_TITLES[location.pathname] ||
    (location.pathname.includes('/sections/') ? "Bo'lim ma'lumotlari" : 'IHMA')

  return (
    <div className="flex h-screen bg-base-200 overflow-hidden">
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <div className={`fixed lg:relative z-40 h-full flex-shrink-0 transition-transform duration-300 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar
          collapsed={collapsed}
          onCollapse={() => setCollapsed(c => !c)}
          onLinkClick={() => setMobileOpen(false)}
        />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} onMenuToggle={() => setMobileOpen(o => !o)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      <FloatingAIAgent />
    </div>
  )
}
