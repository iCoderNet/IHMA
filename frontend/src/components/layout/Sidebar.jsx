import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import useAuthStore from '../../store/authStore'
import {
  LayoutDashboard, Users, FolderOpen, MessageSquare,
  Bot, ChevronLeft, LogOut, Database,
  ShieldCheck, Send, Map,
} from 'lucide-react'

const SUPERADMIN_MENU = [
  { label: 'Dashboard',        icon: LayoutDashboard, to: '/superadmin' },
  { label: "Bo'limlar",        icon: FolderOpen,       to: '/superadmin/sections' },
  { label: 'Murojaatlar',      icon: MessageSquare,    to: '/superadmin/appeals' },
  { label: 'Xarita',           icon: Map,              to: '/superadmin/map' },
  { divider: true, label: 'Bot' },
  { label: 'Bot sozlamalari',  icon: Bot,              to: '/superadmin/bot-settings' },
  { label: 'Foydalanuvchilar', icon: Users,            to: '/superadmin/bot-users' },
  { label: 'Broadcast',        icon: Send,             to: '/superadmin/broadcast' },
  { divider: true, label: 'Tizim' },
  { label: 'Adminlar',         icon: ShieldCheck,      to: '/superadmin/admins' },
  { label: 'Tumanlar',         icon: Database,         to: '/superadmin/districts' },
]

const ADMIN_MENU = [
  { label: 'Dashboard',   icon: LayoutDashboard, to: '/admin' },
  { label: "Bo'limlar",   icon: FolderOpen,      to: '/admin/sections' },
  { label: 'Murojaatlar', icon: MessageSquare,   to: '/admin/appeals' },
  { label: 'Xarita',      icon: Map,             to: '/admin/map' },
]

export default function Sidebar({ collapsed, onCollapse }) {
  const { user, logout } = useAuthStore()
  const isSuperAdmin = user?.role === 'superadmin'
  const menu = isSuperAdmin ? SUPERADMIN_MENU : ADMIN_MENU
  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <aside
      className={clsx(
        'flex flex-col h-full bg-base-100 border-r border-base-300 transition-all duration-300 ease-in-out relative',
        collapsed ? 'w-[68px]' : 'w-[240px]'
      )}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 to-transparent" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-[18px] border-b border-base-300">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-primary to-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M12 7v10" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-base-content text-sm leading-tight">IHMA</p>
            <p className="text-[10px] text-base-content/35 uppercase tracking-widest font-semibold">Platform</p>
          </div>
        )}
        <button
          onClick={onCollapse}
          className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors text-base-content/40 hover:text-base-content flex-shrink-0"
        >
          <ChevronLeft
            size={13}
            className={clsx('transition-transform duration-300', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-0.5">
        {menu.map((item, i) => {
          if (item.divider) {
            if (collapsed) return <div key={i} className="my-3 mx-3 border-t border-base-300" />
            return (
              <div key={i} className="pt-4 pb-1.5 px-3">
                <p className="text-[9px] font-bold text-base-content/25 uppercase tracking-[0.12em]">
                  {item.label}
                </p>
              </div>
            )
          }
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/superadmin' || item.to === '/admin'}
              className={({ isActive }) =>
                clsx('sidebar-link', isActive && 'active', collapsed && 'justify-center px-0')
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate text-[13px]">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-base-300 p-2.5">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-base-200 transition-colors group">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold text-white bg-gradient-to-br from-primary to-secondary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-base-content truncate leading-tight">{user?.full_name}</p>
              <p className="text-[10px] text-base-content/40 capitalize font-medium mt-0.5">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-lg flex items-center justify-center hover:bg-error/10 text-base-content/30 hover:text-error"
              title="Chiqish"
            >
              <LogOut size={12} />
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            className="w-full flex items-center justify-center py-2 rounded-xl hover:bg-error/10 text-base-content/30 hover:text-error transition-colors"
            title="Chiqish"
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </aside>
  )
}
