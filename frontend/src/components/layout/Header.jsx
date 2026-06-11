import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Sun, Moon, Bell, Key, LogOut, ChevronDown, Loader2, Eye, EyeOff, X } from 'lucide-react'
import toast from 'react-hot-toast'
import useThemeStore from '../../store/themeStore'
import useAuthStore from '../../store/authStore'
import api from '../../services/api'

/* ── Password Change Modal ── */
function PasswordModal({ onClose }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [show, setShow] = useState({ current: false, next: false, confirm: false })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  const handleSubmit = async () => {
    if (!form.current || !form.next) { toast.error("Barcha maydonlarni to'ldiring"); return }
    if (form.next.length < 6) { toast.error('Yangi parol kamida 6 ta belgi'); return }
    if (form.next !== form.confirm) { toast.error('Parollar mos kelmadi'); return }
    setLoading(true)
    try {
      await api.put('/auth/change-password', {
        current_password: form.current,
        new_password: form.next,
      })
      toast.success("Parol muvaffaqiyatli o'zgartirildi ✓")
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Xato yuz berdi')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ id, label, placeholder }) => (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider mb-1.5 block text-base-content/40">
        {label}
      </label>
      <div className="relative">
        <input
          type={show[id] ? 'text' : 'password'}
          placeholder={placeholder}
          className="w-full rounded-xl px-4 pr-10 py-2.5 text-sm outline-none bg-base-200 border-2 border-base-300 focus:border-primary text-base-content placeholder:text-base-content/30 transition-colors"
          value={form[id]}
          onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
        />
        <button
          type="button"
          onClick={() => setShow(s => ({ ...s, [id]: !s[id] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/70 transition-colors"
        >
          {show[id] ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden bg-base-100 border border-base-300"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-base-300">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10">
            <Key size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-display font-bold text-[14px] text-base-content">Parol o'zgartirish</p>
            <p className="text-[11px] text-base-content/40">Yangi parol kamida 6 ta belgi</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/40 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <Field id="current" label="Joriy parol"  placeholder="••••••••" />
          <Field id="next"    label="Yangi parol"  placeholder="Kamida 6 ta belgi" />
          <Field id="confirm" label="Tasdiqlash"   placeholder="Yangi parolni qayta kiriting" />
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-base-200 hover:bg-base-300 border border-base-300 text-base-content/60 transition-colors"
          >
            Bekor
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 transition-all bg-gradient-to-r from-primary to-secondary"
            style={{ boxShadow: '0 4px 16px rgba(79,121,224,0.3)' }}
          >
            {loading
              ? <><Loader2 size={14} className="animate-spin" /> Saqlanmoqda...</>
              : <><Key size={14} /> Saqlash</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

/* ── Avatar component ── */
function Avatar({ initials, size = 'sm' }) {
  const sz = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-[11px]'
  return (
    <div className={`${sz} rounded-lg flex items-center justify-center font-bold text-white flex-shrink-0 bg-gradient-to-br from-primary to-secondary`}>
      {initials}
    </div>
  )
}

/* ── Header ── */
export default function Header({ title }) {
  const { theme, toggleTheme } = useThemeStore()
  const { user, logout } = useAuthStore()
  const isDark = theme === 'ihma_dark'
  const initials = (user?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const roleLabel = user?.role === 'superadmin' ? 'Super Admin' : 'Admin'

  const [dropOpen, setDropOpen] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const dropRef = useRef(null)

  useEffect(() => {
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <>
      <header className="h-[56px] flex items-center px-5 gap-4 flex-shrink-0 bg-base-100 border-b border-base-300">
        {/* Page title */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-semibold text-[15px] text-base-content leading-tight truncate">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-200 transition-all"
            title={isDark ? "Yorug' rejim" : "Qorong'u rejim"}
          >
            {isDark ? <Sun size={15} strokeWidth={1.8} /> : <Moon size={15} strokeWidth={1.8} />}
          </button>

          {/* Bell */}
          <button className="w-8 h-8 rounded-lg flex items-center justify-center text-base-content/40 hover:text-base-content hover:bg-base-200 transition-all relative">
            <Bell size={15} strokeWidth={1.8} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-error" />
          </button>

          <div className="w-px h-5 bg-base-300 mx-1" />

          {/* Profile dropdown */}
          <div className="relative" ref={dropRef}>
            <button
              onClick={() => setDropOpen(o => !o)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-base-200 transition-colors"
            >
              <Avatar initials={initials} size="sm" />
              <div className="hidden sm:block leading-tight text-left">
                <p className="text-xs font-semibold text-base-content truncate max-w-[100px]">{user?.full_name}</p>
                <p className="text-[10px] text-base-content/40">{roleLabel}</p>
              </div>
              <ChevronDown
                size={12}
                className={`text-base-content/30 transition-transform duration-200 ${dropOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Dropdown */}
            {dropOpen && (
              <div
                className="absolute right-0 top-[calc(100%+8px)] w-52 rounded-2xl overflow-hidden z-50 bg-base-100 border border-base-300"
                style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.15)' }}
              >
                {/* Profile info */}
                <div className="px-4 py-3 border-b border-base-300">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={initials} size="lg" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-base-content truncate">{user?.full_name}</p>
                      <p className="text-[10px] font-medium text-primary">{roleLabel}</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-1.5">
                  <button
                    onClick={() => { setDropOpen(false); setPwModal(true) }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-base-content hover:bg-base-200 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                      <Key size={13} />
                    </div>
                    Parol o'zgartirish
                  </button>

                  <button
                    onClick={() => { setDropOpen(false); logout() }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium text-error hover:bg-error/10 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-error/10 text-error">
                      <LogOut size={13} />
                    </div>
                    Chiqish
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {pwModal && <PasswordModal onClose={() => setPwModal(false)} />}
    </>
  )
}
