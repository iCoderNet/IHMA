import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, ShieldCheck, User, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function Admins() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [showPass, setShowPass] = useState(false)
  const [form, setForm] = useState({ username: '', full_name: '', password: '', role: 'admin', district_id: '' })

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/auth/users').then(r => r.data),
  })

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data) => api.post('/auth/users', data),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('Foydalanuvchi yaratildi!'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/auth/users/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('Saqlandi!'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/auth/users/${id}`),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const openCreate = () => {
    setForm({ username: '', full_name: '', password: '', role: 'admin', district_id: '' })
    setModal('create')
  }

  const openEdit = (u) => {
    setForm({ username: u.username, full_name: u.full_name, password: '', role: u.role, district_id: u.district_id || '' })
    setModal(u)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      username: form.username,
      full_name: form.full_name,
      role: form.role,
      district_id: form.district_id ? parseInt(form.district_id) : null,
    }
    if (modal === 'create') {
      if (!form.password) { toast.error('Parol kerak'); return }
      createMut.mutate({ ...data, password: form.password })
    } else {
      const upd = { ...data }
      if (form.password) upd.password = form.password
      updateMut.mutate({ id: modal.id, data: upd })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header">Adminlar</h1>
          <p className="page-subheader">Tizim foydalanuvchilarini boshqarish</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary gap-2">
          <Plus size={16} /> Admin qo'shish
        </button>
      </div>

      <div className="table-container">
        {isLoading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner text-primary" /></div>
        ) : (
          <table className="table table-sm table-zebra">
            <thead>
              <tr className="text-xs text-base-content/50">
                <th>Username</th>
                <th>To'liq ismi</th>
                <th>Rol</th>
                <th>Tuman</th>
                <th>Holat</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="hover">
                  <td className="font-mono text-sm">{u.username}</td>
                  <td className="font-medium">{u.full_name}</td>
                  <td>
                    <span className={`badge badge-sm ${u.role === 'superadmin' ? 'badge-primary' : 'badge-ghost'}`}>
                      {u.role === 'superadmin' ? '👑 Superadmin' : '👤 Admin'}
                    </span>
                  </td>
                  <td className="text-sm text-base-content/60">
                    {districts.find(d => d.id === u.district_id)?.name || '—'}
                  </td>
                  <td>
                    <span className={`badge badge-sm ${u.is_active ? 'badge-success' : 'badge-error'}`}>
                      {u.is_active ? 'Faol' : 'Bloklangan'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(u)} className="btn btn-ghost btn-xs">
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => { if (confirm('O\'chirilsinmi?')) deleteMut.mutate(u.id) }}
                        className="btn btn-ghost btn-xs text-error"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {modal === 'create' ? 'Yangi admin' : 'Adminni tahrirlash'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text text-sm font-medium">Username *</span></label>
                  <input className="input input-bordered input-sm" value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    disabled={modal !== 'create'} />
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text text-sm font-medium">To'liq ismi *</span></label>
                  <input className="input input-bordered input-sm" value={form.full_name}
                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-control">
                <label className="label pb-1">
                  <span className="label-text text-sm font-medium">Parol {modal !== 'create' && '(bo\'sh qoldirsangiz o\'zgarmaydi)'}</span>
                </label>
                <div className="relative">
                  <input className="input input-bordered input-sm w-full pr-10"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={modal !== 'create' ? 'Yangi parol (ixtiyoriy)' : 'Parol'} />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text text-sm font-medium">Rol</span></label>
                  <select className="select select-bordered select-sm" value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text text-sm font-medium">Tuman</span></label>
                  <select className="select select-bordered select-sm" value={form.district_id}
                    onChange={e => setForm(f => ({ ...f, district_id: e.target.value }))}>
                    <option value="">Tanlang</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Bekor</button>
                <button type="submit" className="btn btn-primary btn-sm"
                  disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && <span className="loading loading-spinner loading-xs" />}
                  {modal === 'create' ? 'Yaratish' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}
    </div>
  )
}
