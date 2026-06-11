import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function Districts() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState({ name: '', name_ru: '' })

  const { data: districts = [], isLoading } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (data) => api.post('/districts', data),
    onSuccess: () => { qc.invalidateQueries(['districts']); toast.success('Tuman qo\'shildi!'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/districts/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['districts']); toast.success('Saqlandi!'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/districts/${id}`),
    onSuccess: () => { qc.invalidateQueries(['districts']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name) { toast.error('Nomi kerak'); return }
    if (modal === 'create') createMut.mutate(form)
    else updateMut.mutate({ id: modal.id, data: form })
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Tumanlar</h1>
          <p className="page-subheader">Andijon viloyati tumanlar ro'yxati</p>
        </div>
        <button onClick={() => { setForm({ name: '', name_ru: '' }); setModal('create') }}
          className="btn btn-primary gap-2">
          <Plus size={16} /> Tuman qo'shish
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isLoading ? (
          <div className="col-span-2 flex justify-center py-10">
            <span className="loading loading-spinner text-primary" />
          </div>
        ) : districts.map((d, i) => (
          <div key={d.id} className="bg-base-100 rounded-xl border border-base-300 p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <MapPin size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{d.name}</p>
              {d.name_ru && <p className="text-xs text-base-content/40">{d.name_ru}</p>}
            </div>
            <div className="flex gap-1">
              <button onClick={() => { setForm({ name: d.name, name_ru: d.name_ru || '' }); setModal(d) }}
                className="btn btn-ghost btn-xs"><Edit2 size={12} /></button>
              <button onClick={() => { if (confirm("O'chirilsinmi?")) deleteMut.mutate(d.id) }}
                className="btn btn-ghost btn-xs text-error"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-lg mb-4">
              {modal === 'create' ? 'Tuman qo\'shish' : 'Tumanni tahrirlash'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Nomi (o'z) *</span></label>
                <input className="input input-bordered input-sm" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Baliqchi tumani" />
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Nomi (ru)</span></label>
                <input className="input input-bordered input-sm" value={form.name_ru}
                  onChange={e => setForm(f => ({ ...f, name_ru: e.target.value }))} placeholder="Балыкчинский район" />
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Bekor</button>
                <button type="submit" className="btn btn-primary btn-sm">Saqlash</button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setModal(null)}>close</button></form>
        </dialog>
      )}
    </div>
  )
}
