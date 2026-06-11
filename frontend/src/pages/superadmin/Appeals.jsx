import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search, MessageSquare, ChevronLeft, ChevronRight,
  Send, X, User, Phone, MapPin, Calendar, Tag,
  Clock, TrendingUp, CheckCircle, XCircle, AlertCircle,
  Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import api from '../../services/api'
import useThemeStore from '../../store/themeStore'

const STATUS_OPTS = [
  { value: '',          label: 'Barchasi',           icon: null },
  { value: 'new',       label: 'Yangi',               icon: Clock,        color: '#3B9EE8', bg: 'bg-info/10',    text: 'text-info' },
  { value: 'in_review', label: "Ko'rib chiqilmoqda",  icon: TrendingUp,   color: '#F0A020', bg: 'bg-warning/10', text: 'text-warning' },
  { value: 'resolved',  label: 'Hal qilindi',         icon: CheckCircle,  color: '#0CBFA0', bg: 'bg-success/10', text: 'text-success' },
  { value: 'rejected',  label: 'Rad etildi',          icon: XCircle,      color: '#E8385A', bg: 'bg-error/10',   text: 'text-error' },
]

function StatusBadge({ status, size = 'sm' }) {
  const opt = STATUS_OPTS.find(o => o.value === status)
  if (!opt || !opt.icon) return null
  const Icon = opt.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-semibold ${opt.bg} ${opt.text} ${size === 'lg' ? 'text-sm' : 'text-xs'}`}>
      <Icon size={size === 'lg' ? 13 : 11} strokeWidth={2} />
      {opt.label}
    </span>
  )
}

function AppealModal({ appeal, onClose, onUpdate }) {
  const [response, setResponse] = useState(appeal.admin_response || '')
  const [newStatus, setNewStatus] = useState(appeal.status)
  const [updating, setUpdating] = useState(false)
  const isDark = useThemeStore(s => s.theme === 'ihma_dark')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleSubmit = async () => {
    if (!newStatus) { toast.error('Holat tanlang'); return }
    setUpdating(true)
    try {
      await onUpdate(appeal.id, newStatus, response)
      onClose()
    } finally {
      setUpdating(false)
    }
  }

  const currentOpt = STATUS_OPTS.find(o => o.value === appeal.status) || STATUS_OPTS[1]

  // Status rangini hardcode — portal ichida CSS var ishlamaydi
  const statusColors = {
    new:       { bg: '#EFF6FF', border: '#BFDBFE', text: '#1D4ED8', activeBg: '#DBEAFE', activeBorder: '#3B82F6' },
    in_review: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', activeBg: '#FEF3C7', activeBorder: '#F59E0B' },
    resolved:  { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46', activeBg: '#D1FAE5', activeBorder: '#10B981' },
    rejected:  { bg: '#FFF1F2', border: '#FECDD3', text: '#9F1239', activeBg: '#FFE4E6', activeBorder: '#F43F5E' },
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-base-100 border border-base-300"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-5 py-4 flex-shrink-0 border-b border-base-300">
          <div
            className="w-1 h-10 rounded-full flex-shrink-0"
            style={{ background: currentOpt.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-base-content/30">#{appeal.id}</span>
              <h2 className="font-display font-bold text-base-content text-[15px] truncate">{appeal.subject}</h2>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusBadge status={appeal.status} size="lg" />
              <span className="text-[11px] font-mono text-base-content/30">
                {format(new Date(appeal.created_at), 'dd.MM.yyyy · HH:mm')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-base-200 hover:bg-base-300 text-base-content/50 transition-all flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { icon: User,   label: 'FIO',     value: appeal.bot_user_fio || '—'   },
                { icon: Phone,  label: 'Telefon', value: appeal.bot_user_phone || '—' },
                { icon: MapPin, label: 'Tuman',   value: appeal.district_name || '—'  },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl p-3 bg-base-200 border border-base-300">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon size={10} className="text-base-content/40" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-base-content/40">{label}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-base-content truncate">{value}</p>
                </div>
              ))}
            </div>

            {/* Message */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-base-content/40">
                Murojaat matni
              </p>
              <div className="rounded-xl p-4 text-[13px] leading-[1.7] text-base-content bg-base-200 border border-base-300">
                {appeal.message}
              </div>
            </div>

            {/* Previous admin response */}
            {appeal.admin_response && (
              <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1.5 text-emerald-600">
                  ✓ Oldingi javob
                </p>
                <p className="text-[13px] leading-relaxed text-emerald-700">{appeal.admin_response}</p>
              </div>
            )}

            {/* Response section */}
            <div className="rounded-xl p-4 space-y-3 bg-base-200 border border-base-300">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/40">
                Holat & Javob
              </p>

              {/* Status buttons */}
              <div className="grid grid-cols-4 gap-2">
                {STATUS_OPTS.slice(1).map(opt => {
                  const Icon = opt.icon
                  const active = newStatus === opt.value
                  const sc = statusColors[opt.value]
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setNewStatus(opt.value)}
                      className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl transition-all duration-150 select-none"
                      style={active ? {
                        background: sc.activeBg,
                        border: `2px solid ${sc.activeBorder}`,
                        color: sc.text,
                      } : {
                        background: isDark ? '#1e293b' : '#fff',
                        border: isDark ? '1.5px solid #334155' : '1.5px solid #D1D5DB',
                        color: isDark ? '#94a3b8' : '#6B7280',
                      }}
                    >
                      <Icon size={15} strokeWidth={active ? 2.5 : 1.8} />
                      <span className="text-[10px] leading-tight text-center font-semibold">{opt.label}</span>
                    </button>
                  )
                })}
              </div>

              {/* Textarea */}
              <textarea
                rows={3}
                placeholder="Foydalanuvchiga yuboriluvchi javob matni (ixtiyoriy)..."
                className="w-full rounded-xl px-4 py-3 text-[13px] outline-none resize-none text-base-content bg-base-100 border-2 border-base-300 focus:border-primary placeholder:text-base-content/30 transition-colors"
                value={response}
                onChange={e => setResponse(e.target.value)}
              />
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3.5 flex items-center gap-3 flex-shrink-0 border-t border-base-300 bg-base-200">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-base-100 border-2 border-base-300 text-base-content/60 hover:bg-base-300 transition-all"
          >
            Yopish
          </button>
          <button
            onClick={handleSubmit}
            disabled={updating}
            className="flex-[2] py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-40"
            style={{
              background: `linear-gradient(135deg, ${currentOpt.color}, ${currentOpt.color}cc)`,
              boxShadow: `0 4px 20px ${currentOpt.color}50`,
            }}
          >
            {updating
              ? <><Loader2 size={14} className="animate-spin" /> Saqlanmoqda...</>
              : <><Send size={14} /> Saqlash & Yuborish</>
            }
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  )
}

export default function Appeals() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [modalAppeal, setModalAppeal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['appeals', page, status, search],
    queryFn: () => api.get('/appeals', {
      params: { page, size: 15, status: status || undefined, search: search || undefined }
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: stats } = useQuery({
    queryKey: ['appeal-stats'],
    queryFn: () => api.get('/appeals/stats/summary').then(r => r.data),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/appeals/${id}/status`, data),
    onSuccess: () => {
      qc.invalidateQueries(['appeals'])
      qc.invalidateQueries(['appeal-stats'])
      qc.invalidateQueries(['dashboard-stats'])
      toast.success('Holat yangilandi va foydalanuvchiga xabar yuborildi ✓')
    },
    onError: e => toast.error(e.response?.data?.detail || 'Xato yuz berdi'),
  })

  const handleUpdate = async (id, newStatus, adminResponse) => {
    await updateMut.mutateAsync({
      id,
      data: { status: newStatus, admin_response: adminResponse || undefined },
    })
  }

  const appeals = data?.items || []
  const pages = data?.pages || 1

  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Stat chips ── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setStatus(''); setPage(1) }}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            status === ''
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-base-300 text-base-content/50 hover:border-base-content/20'
          }`}
        >
          Barchasi: {appeals.length ? data?.total ?? 0 : 0}
        </button>
        {STATUS_OPTS.slice(1).map(opt => {
          const Icon = opt.icon
          const active = status === opt.value
          const count = stats?.[opt.value] ?? 0
          return (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${active ? '' : 'border-base-300 text-base-content/40 hover:border-base-content/20'}`}
              style={active ? { borderColor: opt.color, background: `${opt.color}18`, color: opt.color } : {}}
            >
              <Icon size={11} />
              {opt.label}: {count}
            </button>
          )
        })}
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base-content/30" />
        <input
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-base-300 bg-base-100 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all placeholder-base-content/25"
          placeholder="FIO, mavzu bo'yicha qidirish..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* ── Table ── */}
      <div className="table-container">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : appeals.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare size={40} className="text-base-content/10 mx-auto mb-3" />
            <p className="text-sm text-base-content/30">Murojaat topilmadi</p>
          </div>
        ) : (
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>FIO</th>
                <th>Mavzu</th>
                <th>Tuman</th>
                <th>Holat</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map(a => (
                <tr
                  key={a.id}
                  className="cursor-pointer"
                  onClick={() => setModalAppeal(a)}
                >
                  <td>
                    <span className="num-display text-xs text-base-content/25">#{a.id}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 bg-gradient-to-br from-primary to-secondary opacity-80"
                      >
                        {(a.bot_user_fio || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-semibold text-base-content truncate max-w-[120px]">
                        {a.bot_user_fio || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="text-[13px] text-base-content/80 line-clamp-1 max-w-[200px]">{a.subject}</span>
                  </td>
                  <td>
                    <span className="text-xs text-base-content/40">{a.district_name || '—'}</span>
                  </td>
                  <td><StatusBadge status={a.status} /></td>
                  <td>
                    <span className="num-display text-xs text-base-content/35">
                      {format(new Date(a.created_at), 'dd.MM.yy HH:mm')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 1}
            className="w-8 h-8 rounded-xl border border-base-300 flex items-center justify-center hover:bg-base-300/50 disabled:opacity-30 transition-all"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="num-display text-xs text-base-content/40 font-medium">
            {page} / {pages} &nbsp;·&nbsp; {data?.total} ta
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page === pages}
            className="w-8 h-8 rounded-xl border border-base-300 flex items-center justify-center hover:bg-base-300/50 disabled:opacity-30 transition-all"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* ── Modal ── */}
      {modalAppeal && (
        <AppealModal
          appeal={modalAppeal}
          onClose={() => setModalAppeal(null)}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}
