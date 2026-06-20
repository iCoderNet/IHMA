import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Edit2, Trash2, FolderOpen, Eye, ChevronDown, ChevronRight, Layers, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const ICON_OPTIONS = ['📊', '👶', '🏥', '📋', '🏠', '🤝', '⚖️', '🎓', '💼', '🌿', '🏛️', '📁']
const COLOR_OPTIONS = [
  { value: 'primary', label: 'Moviy' },
  { value: 'secondary', label: 'Yorqin' },
  { value: 'accent', label: 'Yashil' },
  { value: 'warning', label: 'Sariq' },
  { value: 'error', label: 'Qizil' },
  { value: 'info', label: 'Ko\'k' },
]

const EMPTY_SECTION = { name: '', full_name: '', icon: '📊', color: 'primary', description: '', bolim_id: null }
const EMPTY_BOLIM  = { name: '', full_name: '', icon: '🏛️', color: 'primary', description: '' }

export default function Sections() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'superadmin'
  const basePath = isSuperAdmin ? '/superadmin' : '/admin'

  const [activeTab, setActiveTab] = useState('toifalar') // 'toifalar' | 'bolimlar'
  const [expandedBolim, setExpandedBolim] = useState(null) // bolim id or 'none'

  // Section modal
  const [sModal, setSModal] = useState(null) // null | 'create' | section obj
  const [sForm, setSForm] = useState(EMPTY_SECTION)

  // Bolim modal
  const [bModal, setBModal] = useState(null) // null | 'create' | bolim obj
  const [bForm, setBForm] = useState(EMPTY_BOLIM)

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: sections = [], isLoading: loadingSections } = useQuery({
    queryKey: ['sections'],
    queryFn: () => api.get('/sections').then(r => r.data),
  })

  const { data: bolimlar = [], isLoading: loadingBolimlar } = useQuery({
    queryKey: ['bolimlar'],
    queryFn: () => api.get('/bolimlar').then(r => r.data),
  })

  // ── Section mutations ──────────────────────────────────────────────────────
  const createSection = useMutation({
    mutationFn: (d) => api.post('/sections', d),
    onSuccess: () => { qc.invalidateQueries(['sections']); qc.invalidateQueries(['bolimlar']); toast.success("Toifa yaratildi!"); setSModal(null); setSForm(EMPTY_SECTION) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateSection = useMutation({
    mutationFn: ({ id, data }) => api.put(`/sections/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['sections']); qc.invalidateQueries(['bolimlar']); toast.success("Saqlandi!"); setSModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteSection = useMutation({
    mutationFn: (id) => api.delete(`/sections/${id}`),
    onSuccess: () => { qc.invalidateQueries(['sections']); qc.invalidateQueries(['bolimlar']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  // ── Bolim mutations ────────────────────────────────────────────────────────
  const createBolim = useMutation({
    mutationFn: (d) => api.post('/bolimlar', d),
    onSuccess: () => { qc.invalidateQueries(['bolimlar']); toast.success("Bo'lim yaratildi!"); setBModal(null); setBForm(EMPTY_BOLIM) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateBolim = useMutation({
    mutationFn: ({ id, data }) => api.put(`/bolimlar/${id}`, data),
    onSuccess: () => { qc.invalidateQueries(['bolimlar']); toast.success("Saqlandi!"); setBModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const deleteBolim = useMutation({
    mutationFn: (id) => api.delete(`/bolimlar/${id}`),
    onSuccess: () => { qc.invalidateQueries(['bolimlar']); qc.invalidateQueries(['sections']); toast.success("O'chirildi") },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  const openCreateSection = (bolim_id = null) => {
    setSForm({ ...EMPTY_SECTION, bolim_id })
    setSModal('create')
  }

  const openEditSection = (s) => {
    setSForm({ name: s.name, full_name: s.full_name, icon: s.icon || '📊', color: s.color || 'primary', description: s.description || '', bolim_id: s.bolim_id ?? null })
    setSModal(s)
  }

  const handleSectionSubmit = (e) => {
    e.preventDefault()
    if (!sForm.name || !sForm.full_name) { toast.error("Nom va to'liq nom kerak"); return }
    const payload = { ...sForm, bolim_id: sForm.bolim_id || null }
    if (sModal === 'create') createSection.mutate(payload)
    else updateSection.mutate({ id: sModal.id, data: payload })
  }

  const handleBolimSubmit = (e) => {
    e.preventDefault()
    if (!bForm.name || !bForm.full_name) { toast.error("Nom va to'liq nom kerak"); return }
    if (bModal === 'create') createBolim.mutate(bForm)
    else updateBolim.mutate({ id: bModal.id, data: bForm })
  }

  // Group sections by bolim_id
  const sectionsByBolim = {}
  const unboundSections = []
  for (const s of sections) {
    if (s.bolim_id) {
      if (!sectionsByBolim[s.bolim_id]) sectionsByBolim[s.bolim_id] = []
      sectionsByBolim[s.bolim_id].push(s)
    } else {
      unboundSections.push(s)
    }
  }

  const isLoading = loadingSections || loadingBolimlar

  // ── Section Card ───────────────────────────────────────────────────────────
  const SectionCard = ({ s }) => (
    <div className="bg-base-100 rounded-xl border border-base-300 shadow-sm hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl bg-${s.color || 'primary'}/10 flex items-center justify-center text-lg`}>
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
                <button onClick={() => openEditSection(s)} className="gap-2 text-sm">
                  <Edit2 size={13} /> Tahrirlash
                </button>
              </li>
              <li>
                <button onClick={() => { if (confirm(`"${s.full_name}"ni o'chirishni tasdiqlang?`)) deleteSection.mutate(s.id) }} className="gap-2 text-sm text-error">
                  <Trash2 size={13} /> O'chirish
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-sm leading-tight">{s.full_name}</h3>
      <p className="text-xs text-base-content/50 mt-0.5">{s.name}</p>
      {s.description && <p className="text-xs text-base-content/40 mt-1.5 line-clamp-2">{s.description}</p>}
      <div className="flex items-center justify-between mt-3">
        <span className="badge badge-ghost badge-sm">{s.columns?.length ?? 0} ustun</span>
        <Link to={`${basePath}/sections/${s.id}`} className="btn btn-primary btn-xs gap-1">
          <Eye size={11} /> Ochish
        </Link>
      </div>
    </div>
  )

  // ── Bolim Group ────────────────────────────────────────────────────────────
  const BolimGroup = ({ bolim, secs }) => {
    const isOpen = expandedBolim === bolim.id
    return (
      <div className="border border-base-300 rounded-2xl overflow-hidden bg-base-100 shadow-sm">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-base-200/60 transition-colors"
          onClick={() => setExpandedBolim(isOpen ? null : bolim.id)}
        >
          <div className={`w-9 h-9 rounded-xl bg-${bolim.color || 'primary'}/15 flex items-center justify-center text-lg`}>
            {bolim.icon || '🏛️'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{bolim.full_name}</p>
            <p className="text-xs text-base-content/50">{bolim.name} · {secs.length} ta toifa</p>
          </div>
          {isSuperAdmin && (
            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
              <button
                className="btn btn-ghost btn-xs gap-1"
                onClick={() => openCreateSection(bolim.id)}
              >
                <Plus size={12} /> Toifa
              </button>
              <button className="btn btn-ghost btn-xs" onClick={() => { setBForm({ name: bolim.name, full_name: bolim.full_name, icon: bolim.icon || '🏛️', color: bolim.color || 'primary', description: bolim.description || '' }); setBModal(bolim) }}>
                <Edit2 size={12} />
              </button>
              <button className="btn btn-ghost btn-xs text-error" onClick={() => { if (confirm(`"${bolim.full_name}"ni o'chirishni tasdiqlang? Toifalar bog'liqsiz qoladi.`)) deleteBolim.mutate(bolim.id) }}>
                <Trash2 size={12} />
              </button>
            </div>
          )}
          {isOpen ? <ChevronDown size={16} className="text-base-content/40 shrink-0" /> : <ChevronRight size={16} className="text-base-content/40 shrink-0" />}
        </div>

        {/* Sections */}
        {isOpen && (
          <div className="px-5 pb-5 pt-1 bg-base-50 border-t border-base-200">
            {secs.length === 0 ? (
              <p className="text-sm text-base-content/40 py-4 text-center">Hozircha toifa yo'q</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                {secs.map(s => <SectionCard key={s.id} s={s} />)}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="page-header">Bo'limlar va Toifalar</h1>
          <p className="page-subheader">Bo'lim → Toifa ierarxiyasini boshqaring</p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { setBForm(EMPTY_BOLIM); setBModal('create') }} className="btn btn-outline btn-sm gap-2">
              <Layers size={15} /> Yangi bo'lim
            </button>
            <button onClick={() => openCreateSection()} className="btn btn-primary btn-sm gap-2">
              <Plus size={15} /> Yangi toifa
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed mb-5 w-fit">
        <button className={`tab tab-sm gap-2 ${activeTab === 'toifalar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('toifalar')}>
          <Tag size={14} /> Toifalar ({sections.length})
        </button>
        <button className={`tab tab-sm gap-2 ${activeTab === 'bolimlar' ? 'tab-active' : ''}`} onClick={() => setActiveTab('bolimlar')}>
          <Layers size={14} /> Bo'limlar ({bolimlar.length})
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      ) : activeTab === 'toifalar' ? (
        /* ── Toifalar tab ── */
        <div className="space-y-4">
          {bolimlar.map(b => (
            <BolimGroup key={b.id} bolim={b} secs={sectionsByBolim[b.id] || []} />
          ))}

          {/* Unbound sections */}
          {unboundSections.length > 0 && (
            <div className="border border-dashed border-base-300 rounded-2xl overflow-hidden">
              <div
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-base-200/60 transition-colors"
                onClick={() => setExpandedBolim(expandedBolim === 'none' ? null : 'none')}
              >
                <div className="w-9 h-9 rounded-xl bg-base-300/50 flex items-center justify-center text-lg">📁</div>
                <div className="flex-1">
                  <p className="font-semibold text-sm text-base-content/70">Bo'limsiz toifalar</p>
                  <p className="text-xs text-base-content/40">{unboundSections.length} ta toifa</p>
                </div>
                {expandedBolim === 'none' ? <ChevronDown size={16} className="text-base-content/30" /> : <ChevronRight size={16} className="text-base-content/30" />}
              </div>
              {expandedBolim === 'none' && (
                <div className="px-5 pb-5 pt-1 border-t border-base-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-3">
                    {unboundSections.map(s => <SectionCard key={s.id} s={s} />)}
                  </div>
                </div>
              )}
            </div>
          )}

          {bolimlar.length === 0 && sections.length === 0 && (
            <div className="text-center py-20 text-base-content/40">
              <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Hozircha hech narsa yo'q</p>
              <p className="text-sm mt-1">Avval bo'lim, keyin toifa yarating</p>
            </div>
          )}
        </div>
      ) : (
        /* ── Bo'limlar tab ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {bolimlar.length === 0 ? (
            <div className="col-span-full text-center py-20 text-base-content/40">
              <Layers size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Bo'limlar yo'q</p>
              {isSuperAdmin && (
                <button onClick={() => { setBForm(EMPTY_BOLIM); setBModal('create') }} className="btn btn-primary btn-sm mt-4 gap-2">
                  <Plus size={14} /> Yaratish
                </button>
              )}
            </div>
          ) : bolimlar.map(b => (
            <div key={b.id} className="bg-base-100 rounded-2xl border border-base-300 shadow-sm hover:shadow-md transition-shadow p-5">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-12 h-12 rounded-xl bg-${b.color || 'primary'}/10 flex items-center justify-center text-2xl`}>
                  {b.icon || '🏛️'}
                </div>
                {isSuperAdmin && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost btn-xs" onClick={() => { setBForm({ name: b.name, full_name: b.full_name, icon: b.icon || '🏛️', color: b.color || 'primary', description: b.description || '' }); setBModal(b) }}>
                      <Edit2 size={13} />
                    </button>
                    <button className="btn btn-ghost btn-xs text-error" onClick={() => { if (confirm(`"${b.full_name}"ni o'chirishni tasdiqlang?`)) deleteBolim.mutate(b.id) }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-base">{b.full_name}</h3>
              <p className="text-xs text-base-content/50 mt-0.5">{b.name}</p>
              {b.description && <p className="text-xs text-base-content/40 mt-2 line-clamp-2">{b.description}</p>}
              <div className="flex items-center justify-between mt-4">
                <span className="badge badge-ghost badge-sm">{(sectionsByBolim[b.id] || []).length} toifa</span>
                {isSuperAdmin && (
                  <button onClick={() => openCreateSection(b.id)} className="btn btn-outline btn-xs gap-1">
                    <Plus size={11} /> Toifa qo'shish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Section Modal ── */}
      {sModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {sModal === 'create' ? "Yangi toifa" : "Toifani tahrirlash"}
            </h3>
            <form onSubmit={handleSectionSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Qisqa nomi *</span></label>
                  <input className="input input-bordered input-sm" placeholder="NBSH" value={sForm.name} onChange={e => setSForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">To'liq nomi *</span></label>
                  <input className="input input-bordered input-sm" placeholder="Nogironligi bo'lgan..." value={sForm.full_name} onChange={e => setSForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
              </div>

              {/* Bolim selection */}
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Bo'lim (ixtiyoriy)</span></label>
                <select
                  className="select select-bordered select-sm"
                  value={sForm.bolim_id ?? ''}
                  onChange={e => setSForm(f => ({ ...f, bolim_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">— Bo'limsiz —</option>
                  {bolimlar.map(b => (
                    <option key={b.id} value={b.id}>{b.icon} {b.full_name}</option>
                  ))}
                </select>
              </div>

              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Tavsif</span></label>
                <textarea className="textarea textarea-bordered textarea-sm" rows={2} placeholder="Ixtiyoriy tavsif..." value={sForm.description} onChange={e => setSForm(f => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Ikona</span></label>
                  <select className="select select-bordered select-sm" value={sForm.icon} onChange={e => setSForm(f => ({ ...f, icon: e.target.value }))}>
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Rang</span></label>
                  <select className="select select-bordered select-sm" value={sForm.color} onChange={e => setSForm(f => ({ ...f, color: e.target.value }))}>
                    {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="modal-action mt-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSModal(null)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createSection.isPending || updateSection.isPending}>
                  {(createSection.isPending || updateSection.isPending) && <span className="loading loading-spinner loading-xs" />}
                  {sModal === 'create' ? 'Yaratish' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setSModal(null)}>close</button></form>
        </dialog>
      )}

      {/* ── Bolim Modal ── */}
      {bModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-md">
            <h3 className="font-bold text-lg mb-4">
              {bModal === 'create' ? "Yangi bo'lim" : "Bo'limni tahrirlash"}
            </h3>
            <form onSubmit={handleBolimSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Qisqa nomi *</span></label>
                  <input className="input input-bordered input-sm" placeholder="BS" value={bForm.name} onChange={e => setBForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">To'liq nomi *</span></label>
                  <input className="input input-bordered input-sm" placeholder="Bolalar shubasi" value={bForm.full_name} onChange={e => setBForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Tavsif</span></label>
                <textarea className="textarea textarea-bordered textarea-sm" rows={2} value={bForm.description} onChange={e => setBForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Ikona</span></label>
                  <select className="select select-bordered select-sm" value={bForm.icon} onChange={e => setBForm(f => ({ ...f, icon: e.target.value }))}>
                    {ICON_OPTIONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label pb-1"><span className="label-text font-medium">Rang</span></label>
                  <select className="select select-bordered select-sm" value={bForm.color} onChange={e => setBForm(f => ({ ...f, color: e.target.value }))}>
                    {COLOR_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-action mt-2">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setBModal(null)}>Bekor qilish</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={createBolim.isPending || updateBolim.isPending}>
                  {(createBolim.isPending || updateBolim.isPending) && <span className="loading loading-spinner loading-xs" />}
                  {bModal === 'create' ? 'Yaratish' : 'Saqlash'}
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setBModal(null)}>close</button></form>
        </dialog>
      )}
    </div>
  )
}
