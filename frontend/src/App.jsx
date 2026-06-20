import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import useAuthStore from './store/authStore'
import useThemeStore from './store/themeStore'
import Layout from './components/layout/Layout'
import Login from './pages/auth/Login'
import SuperadminDashboard from './pages/superadmin/Dashboard'
import Sections from './pages/superadmin/Sections'
import SectionDetail from './pages/superadmin/SectionDetail'
import Appeals from './pages/superadmin/Appeals'
import BotSettings from './pages/superadmin/BotSettings'
import BotUsers from './pages/superadmin/BotUsers'
import Broadcast from './pages/superadmin/Broadcast'
import Admins from './pages/superadmin/Admins'
import Districts from './pages/superadmin/Districts'
import AdminDashboard from './pages/admin/Dashboard'
import IjtimoiyHodimlar from './pages/superadmin/IjtimoiyHodimlar'

function RequireAuth({ children, role }) {
  const { user, isAuthenticated } = useAuthStore()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (role && user?.role !== role && !(role === 'admin' && user?.role === 'superadmin')) {
    return <Navigate to={user?.role === 'superadmin' ? '/superadmin' : '/admin'} replace />
  }
  return children
}

export default function App() {
  const { initTheme } = useThemeStore()

  useEffect(() => {
    initTheme()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Superadmin routes */}
        <Route path="/superadmin" element={
          <RequireAuth role="superadmin">
            <Layout />
          </RequireAuth>
        }>
          <Route index element={<SuperadminDashboard />} />
          <Route path="sections" element={<Sections />} />
          <Route path="sections/:id" element={<SectionDetail />} />
          <Route path="appeals" element={<Appeals />} />
          <Route path="bot-settings" element={<BotSettings />} />
          <Route path="bot-users" element={<BotUsers />} />
          <Route path="broadcast" element={<Broadcast />} />
          <Route path="admins" element={<Admins />} />
          <Route path="districts" element={<Districts />} />
          <Route path="map" element={<Navigate to="/superadmin" replace />} />
          <Route path="ijtimoiy-hodimlar" element={<IjtimoiyHodimlar />} />
        </Route>

        {/* Admin routes */}
        <Route path="/admin" element={
          <RequireAuth role="admin">
            <Layout />
          </RequireAuth>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="sections" element={<Sections />} />
          <Route path="sections/:id" element={<SectionDetail />} />
          <Route path="appeals" element={<Appeals />} />
          <Route path="map" element={<Navigate to="/admin" replace />} />
          <Route path="ijtimoiy-hodimlar" element={<IjtimoiyHodimlar />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
