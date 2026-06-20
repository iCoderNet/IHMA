import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Search, Download, Upload, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const MONTHS = ['','Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentyabr','Oktyabr','Noyabr','Dekabr']
const EMPTY = { district_id: '', mfy_name: '', fio: '', phone: '' }

export default function IjtimoiyHodimlar() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'superadmin'

  const [filterDistrict, setFilterDistrict] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState(null)     // null | 'create' | hodim obj
  const [form, setForm] = useState(EMPTY)
  const [importing, setImporting] = useState(false)

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['ijtimoiy-hodimlar', filterDistrict, search, page],
    queryFn: () => api.get('/ijtimoiy-hodimlar', {
      params: {
        district_id: filterDistrict || undefined,
        search: search || undefined,
        page,
        size: 100,
      }
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const items = data?.items || []
  const total = data?.total || 0
  const pages = data?.pages || 1

  const createMut = useMutation({
    mutationFn: (d) => api.post('/ijtimoiy-hodimlar', d),
    onSuccess: () => { qc.invalidateQueries(['ijtimoiy-hodimlar']); toast.success('Qo\'shildi!'); setModal(null); setForm(EMPTY) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => api.put(`/ijtimoiy-hodimlar/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['ijtimoiy-hodimlar']); toast.success('Saqlandi!'); setModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/ijtimoiy-hodimlar/${id}`),
    onSuccess: () => { qc.invalidateQueries(['ijtimoiy-hodimlar']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const openCreate = () => { setForm(EMPTY); setModal('create') }
  const openEdit = (h) => { setForm({ district_id: h.district_id || '', mfy_name: h.mfy_name, fio: h.fio, phone: h.phone }); setModal(h) }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.fio || !form.mfy_name) { toast.error('FIO va MFY kerak'); return }
    const payload = { ...form, district_id: form.district_id ? Number(form.district_id) : null }
    if (modal === 'create') createMut.mutate(payload)
    else updateMut.mutate({ id: modal.id, data: payload })
  }

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (filterDistrict) fd.append('district_id', filterDistrict)
    setImporting(true)
    try {
      const res = await api.post('/ijtimoiy-hodimlar/excel/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(res.data.message || `${res.data.imported} ta import qilindi`)
      qc.invalidateQueries(['ijtimoiy-hodimlar'])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import xatosi')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const handleExport = async () => {
    try {
      const params = {}
      if (filterDistrict) params.district_id = filterDistrict
      const res = await api.get('/ijtimoiy-hodimlar/excel/export', {
        params,
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ijtimoiy_hodimlar.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export xatosi')
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="page-header">Ijtimoiy hodimlar</h1>
          <p className="page-subheader">Jami: {total} ta hodim</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="btn btn-outline btn-sm gap-2">
            <Download size={14} /> Excel
          </button>
          <label className={`btn btn-outline btn-sm gap-2 cursor-pointer ${importing ? 'loading' : ''}`}>
            <Upload size={14} /> Import
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
          {isSuperAdmin && (
            <button onClick={openCreate} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} /> Qo'shish
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          className="select select-bordered select-sm w-full sm:w-48"
          value={filterDistrict}
          onChange={e => { setFilterDistrict(e.target.value); setPage(1) }}
        >
          <option value="">Barcha tumanlar</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <label className="input input-bordered input-sm flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="text-base-content/40" />
          <input
            type="text"
            placeholder="FIO, MFY yoki tel bo'yicha qidirish..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="grow"
          />
        </label>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-base-content/40">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Hodimlar topilmadi</p>
          {isSuperAdmin && (
            <button onClick={openCreate} className="btn btn-primary btn-sm mt-4 gap-2">
              <Plus size={14} /> Qo'shish
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="bg-base-100 rounded-2xl border border-base-300 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="bg-base-200/60 text-base-content/70 text-xs uppercase tracking-wide">
                    <th className="w-10">№</th>
                    <th>Tuman</th>
                    <th>MFY</th>
                    <th>Ijtimoiy hodim FIO</th>
                    <th>Tel raqami</th>
                    {isSuperAdmin && <th className="w-20 text-right">Amallar</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((h, i) => (
                    <tr key={h.id} className="hover:bg-base-200/40 transition-colors">
                      <td className="text-base-content/50 text-xs">{(page - 1) * 100 + i + 1}</td>
                      <td>
                        <span className="badge badge-ghost badge-sm">{h.district_name || '—'}</span>
                      </td>
                      <td className="font-medium text-sm">{h.mfy_name}</td>
                      <td className="text-sm">{h.fio}</td>
                      <td>
                        {h.phone ? (
                          <a href={`tel:${h.phone.replace(/[^0-9+]/g, '')}`} className="font-mono text-sm text-primary hover:underline">
                            {h.phone}
                          </a>
                        ) : <span className="text-base-content/30">—</span>}
                      </td>
                      {isSuperAdmin && (
                        <td>
                          <div className="flex justify-end gap-1">
                            <button className="btn btn-ghost btn-xs" onClick={() => openEdit(h)}>
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => { if (confirm(`"${h.fio}"ni o'chirishni tasdiqlang?`)) deleteMut.mutate(h.id) }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-1 mt-4">
              <button className="btn btn-sm btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>«</button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => i + 1).map(p => (
                <button key={p} className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className="btn btn-sm btn-ghost" disabled={page === pages} onClick={() => setPage(p => p + 1)}>»</button>
            </div>
          )}
        </>
      )}

      {/* Import hint */}
      <div className="mt-4 p-3 bg-base-200/50 rounded-xl text-xs text-base-content/50">
        <strong>Excel format:</strong> Tuman | MFY | Ijtimoiy hodim FIO | Tel raqami — birinchi qator sarlavha bo'lishi kerak
      </div>

      {/* Modal */}
      {modal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {modal === 'create' ? 'Yangi ijtimoiy hodim' : 'Hodimni tahrirlash'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Tuman</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={form.district_id}
                  onChange={e => setForm(f => ({ ...f, district_id: e.target.value }))}
                >
                  <option value="">— Tanlang —</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">MFY nomi *</span></label>
                <input
                  className="input input-bordered input-sm"
                  placeholder="Adolat MFY"
                  value={form.mfy_name}
                  onChange={e => setForm(f => ({ ...f, mfy_name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">FIO *</span></label>
                <input
                  className="input input-bordered input-sm"
                  placeholder="Familiya Ism Sharif"
                  value={form.fio}
                  onChange={e => setForm(f => ({ ...f, fio: e.target.value }))}
                  required
                />
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Tel raqami</span></label>
                <input
                  className="input input-bordered input-sm font-mono"
                  placeholder="90-123-45-67"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
              </div>

              <div className="modal-action mt-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Bekor</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) && <span className="loading loading-spinner loading-xs" />}
                  {modal === 'create' ? 'Qo\'shish' : 'Saqlash'}
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
