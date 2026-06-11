import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import useAuthStore from '../../store/authStore'
import useThemeStore from '../../store/themeStore'

const DOT_GRID = Array.from({ length: 180 })

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [focused, setFocused] = useState(null)
  const { login, isLoading, isAuthenticated, user } = useAuthStore()
  const { initTheme, theme, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const isDark = theme === 'ihma_dark'

  useEffect(() => {
    initTheme()
    if (isAuthenticated()) {
      navigate(user?.role === 'superadmin' ? '/superadmin' : '/admin')
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username || !password) { toast.error("Login va parol kiriting"); return }
    const res = await login(username, password)
    if (res.success) {
      toast.success("Xush kelibsiz!")
      navigate(useAuthStore.getState().user?.role === 'superadmin' ? '/superadmin' : '/admin')
    } else {
      toast.error(res.error || "Login yoki parol noto'g'ri")
    }
  }

  return (
    <div className="min-h-screen flex bg-base-200">
      {/* ── Left brand panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 relative overflow-hidden p-12"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, #0B1628 0%, #0F1E3C 50%, #0B2444 100%)'
            : 'linear-gradient(145deg, #0F1D38 0%, #1C3461 50%, #1A3D6E 100%)',
        }}
      >
        {/* Dot grid */}
        <div className="absolute inset-0 grid grid-cols-[repeat(15,1fr)] gap-6 p-8 opacity-20 pointer-events-none">
          {DOT_GRID.map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-blue-300"
              style={{ opacity: Math.random() > 0.5 ? 0.8 : 0.3 }}
            />
          ))}
        </div>

        {/* Glow orbs */}
        <div className="absolute top-1/4 -left-16 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #4F79E0, transparent)' }} />
        <div className="absolute bottom-1/3 right-0 w-48 h-48 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #0CBFA0, transparent)' }} />

        {/* Logo */}
        <div className="relative z-10 animate-fade-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #4F79E0, #6A9BF5)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M12 7v10M7.5 9.5l4.5 2.5 4.5-2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-display font-bold text-lg leading-tight">IHMA</p>
              <p className="text-blue-300/70 text-xs">Platform v1.0</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="relative z-10 space-y-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div>
            <h1 className="font-display text-4xl font-bold text-white leading-tight mb-3">
              Ijtimoiy Himoya<br />
              <span style={{ color: '#7BA3F5' }}>Menejment</span><br />
              Tizimi
            </h1>
            <p className="text-blue-200/60 text-sm leading-relaxed">
              Andijon viloyati ijtimoiy xizmatlar ma'lumotlarini boshqarish va tahlil qilish platformasi
            </p>
          </div>

          {/* Feature pills */}
          <div className="space-y-2">
            {[
              { icon: '📊', text: "Dinamik bo'limlar va ma'lumotlar" },
              { icon: '🤖', text: 'Telegram bot integratsiyasi' },
              { icon: '📍', text: 'Tuman kesimida xarita tahlili' },
            ].map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  animationDelay: `${0.2 + i * 0.1}s`
                }}
              >
                <span className="text-base">{f.icon}</span>
                <span className="text-blue-100/80 text-sm">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-blue-300/40 text-xs animate-fade-up" style={{ animationDelay: '0.5s' }}>
          © 2024 IHMA Platform • Andijon viloyati hokimligi
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="absolute top-5 right-5 btn btn-ghost btn-circle btn-sm opacity-60 hover:opacity-100"
        >
          {isDark
            ? <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.592-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/></svg>
            : <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd"/></svg>
          }
        </button>

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center animate-fade-up">
          <div className="w-12 h-12 rounded-xl bg-primary mx-auto flex items-center justify-center mb-3">
            <span className="text-primary-content font-display font-bold text-lg">IH</span>
          </div>
          <p className="font-display font-bold text-xl text-base-content">IHMA Platform</p>
        </div>

        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-base-content mb-2">Kirish</h2>
            <p className="text-base-content/50 text-sm">Tizimga kirish uchun ma'lumotlaringizni kiriting</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username field */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-base-content/70">Foydalanuvchi nomi</label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focused === 'user'
                  ? 'border-primary/60 shadow-[0_0_0_3px] shadow-primary/10'
                  : 'border-base-300'
              } bg-base-100`}>
                <input
                  type="text"
                  placeholder="username"
                  className="w-full px-4 py-3.5 bg-transparent text-sm outline-none text-base-content placeholder-base-content/30 rounded-xl font-mono"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onFocus={() => setFocused('user')}
                  onBlur={() => setFocused(null)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-base-content/70">Parol</label>
              <div className={`relative rounded-xl border transition-all duration-200 ${
                focused === 'pass'
                  ? 'border-primary/60 shadow-[0_0_0_3px] shadow-primary/10'
                  : 'border-base-300'
              } bg-base-100`}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 pr-12 bg-transparent text-sm outline-none text-base-content placeholder-base-content/30 rounded-xl font-mono"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/30 hover:text-base-content/70 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-display font-semibold text-sm transition-all duration-200 mt-2"
              style={{
                background: 'linear-gradient(135deg, #1C3461, #2A4E8C)',
                color: 'white',
                boxShadow: '0 4px 20px rgba(28,52,97,0.30)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(28,52,97,0.40)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(28,52,97,0.30)'
              }}
            >
              {isLoading ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <>
                  Tizimga kirish
                  <ArrowRight size={15} className="opacity-80" />
                </>
              )}
            </button>
          </form>

          {/* Info */}
          <div className="mt-8 p-4 rounded-xl border border-base-300/60 bg-base-200/50">
            <p className="text-xs text-base-content/40 text-center">
              🔒 Barcha ma'lumotlar shifrlangan holda uzatiladi
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
