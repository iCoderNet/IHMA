import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, FolderOpen, Eye, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const ICON_OPTIONS = ['📊', '👶', '🏥', '📋', '🏠', '🤝', '⚖️', '🎓', '💼', '🌿']
const COLOR_OPTIONS = [
  { value: 'primary', label: 'Moviy' },
  { value: 'secondary', label: 'Yorqin' },
  { value: 'accent', label: 'Yashil' },
  { value: 'warning', label: 'Sariq' },
  { value: 'error', label: 'Qizil' },
  { value: 'info', label: 'Ko\'k' },
]

export default function Sections() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'superadmin'
  const basePath = isSuperAdmin ? '/superadmin' : '/admin'
  const [modal, setModal] = useState(null) // null | 'create' | {id, ...}
  const [form, setForm] = useState({ name: '', full_name: '', icon: '📊', color: 'primary', description: '' })

  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data) => api.post('/sections', data),
    onSuccess: () => {
      qc.invalidateQueries(['sections'])
      toast.success("Bo'lim yaratildi!")
      setModal(null)
      setForm({ name: '', full_name: '', icon: '📊', color: 'primary', description: '' })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/sections/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['sections'])
      toast.success("Saqlandi!")
      setModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/sections/${id}`),
    onSuccess: () => { qc.invalidateQueries(['sections']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const openCreate = () => {
    setForm({ name: '', full_name: '', icon: '📊', color: 'primary', description: '' })
    setModal('create')
  }

  const openEdit = (s) => {
    setForm({ name: s.name, full_name: s.full_name, icon: s.icon || '📊', color: s.color || 'primary', description: s.description || '' })
    setModal(s)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.full_name) { toast.error("Nom va to'liq nom kerak"); return }
    if (modal === 'create') {
      createMut.mutate(form)
    } else {
      updateMut.mutate({ id: modal.id, data: form })
    }
  }

  const handleDelete = (s) => {
    if (!confirm(`"${s.full_name}" bo'limini o'chirishni tasdiqlang?`)) return
    deleteMut.mutate(s.id)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-header">Bo'limlar</h1>
          <p className="page-subheader">Dinamik ma'lumot bo'limlarini boshqaring</p>
        </div>
        {isSuperAdmin && (
          <button onClick={openCreate} className="btn btn-primary gap-2">
            <Plus size={16} /> Yangi bo'lim
          </button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : sections.length === 0 ? (
        <div className="text-center py-20 text-base-content/40">
          <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Hozircha bo'lim yo'q</p>
          <p className="text-sm mt-1">Birinchi bo'limni yarating</p>
          <button onClick={openCreate} className="btn btn-primary btn-sm mt-4 gap-2">
            <Plus size={14} /> Yaratish
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sections.map((s) => (
            <div key={s.id} className="bg-base-100 rounded-2xl border border-base-300 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-11 h-11 rounded-xl bg-${s.color || 'primary'}/10 flex items-center justify-center text-xl`}>
                  {s.icon || '📊'}
                </div>
                {isSuperAdmin && (
                <div className="dropdown dropdown-end">
                  <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle">⋯</button>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-36 border border-base-300">
                    <li>
                      <Link to={`${basePath}/sections/${s.id}`} className="gap-2 text-sm">
                        <Eye size={13} /> Ko'rish
                      </Link>
                    </li>
                    <li>
                      <button onClick={() => openEdit(s)} className="gap-2 text-sm">
                        <Edit2 size={13} /> Tahrirlash
                      </button>
                    </li>
                    <li>
                      <button onClick={() => handleDelete(s)} className="gap-2 text-sm text-error">
                        <Trash2 size={13} /> O'chirish
                      </button>
                    </li>
                  </ul>
                </div>
              )}
              </div>
              <h3 className="font-semibold text-base-content text-sm leading-tight">{s.full_name}</h3>
              <p className="text-xs text-base-content/50 mt-0.5">{s.name}</p>
              {s.description && (
                <p className="text-xs text-base-content/40 mt-2 line-clamp-2">{s.description}</p>
              )}
              <div className="flex items-center justify-between mt-4">
                <span className="badge badge-ghost badge-sm">
                  {s.columns?.length ?? 0} ustun
                </span>
                <Link
                  to={`${basePath}/sections/${s.id}`}
                  className="btn btn-primary btn-xs gap-1"
                >
                  <Eye size={11} /> Ochish
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {modal === 'create' ? "Yangi bo'lim" : "Bo'limni tahrirlash"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Qisqa nomi *</span></label>
                  <input
                    className="input input-bordered input-sm"
                    placeholder="NBSH"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">To'liq nomi *</span></label>
                  <input
                    className="input input-bordered input-sm"
                    placeholder="Nogironligi bo'lgan..."
                    value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Tavsif</span></label>
                <textarea
                  className="textarea textarea-bordered textarea-sm"
                  rows={2}
                  placeholder="Ixtiyoriy tavsif..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Ikona</span></label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.icon}
                    onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  >
                    {ICON_OPTIONS.map(ic => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Rang</span></label>
                  <select
                    className="select select-bordered select-sm"
                    value={form.color}
                    onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                  >
                    {COLOR_OPTIONS.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-action mt-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={createMut.isPending || updateMut.isPending}
                >
                  {(createMut.isPending || updateMut.isPending) && (
                    <span className="loading loading-spinner loading-xs" />
                  )}
                  {modal === 'create' ? 'Yaratish' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setModal(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  )
}
