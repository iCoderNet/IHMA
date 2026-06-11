import { useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Trash2, Edit2, Upload, Download,
  FileSpreadsheet, ChevronLeft, ChevronRight, Settings2, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function SectionDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const fileRef = useRef()

  const [page, setPage] = useState(1)
  const [districtId, setDistrictId] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [showColModal, setShowColModal] = useState(null) // null | 'create' | col
  const [showRowModal, setShowRowModal] = useState(null)
  const [colForm, setColForm] = useState({ name: '', key: '', data_type: 'text', order: 0 })
  const [rowForm, setRowForm] = useState({ district_id: '', cells: {} })

  // Queries
  const { data: section } = useQuery({
    queryKey: ['section', id],
    queryFn: () => api.get(`/sections/${id}`).then(r => r.data),
  })

  const { data: rowsData, isLoading: rowsLoading } = useQuery({
    queryKey: ['section-rows', id, page, districtId],
    queryFn: () => api.get(`/sections/${id}/rows`, {
      params: { page, size: 20, district_id: districtId || undefined }
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  // Mutations
  const addColMut = useMutation({
    mutationFn: (data) => api.post(`/sections/${id}/columns`, data),
    onSuccess: () => { qc.invalidateQueries(['section', id]); toast.success('Ustun qo\'shildi'); setShowColModal(null) },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const delColMut = useMutation({
    mutationFn: (cid) => api.delete(`/sections/${id}/columns/${cid}`),
    onSuccess: () => { qc.invalidateQueries(['section', id]); toast.success("O'chirildi") },
  })

  const updateColMut = useMutation({
    mutationFn: ({ cid, data }) => api.put(`/sections/${id}/columns/${cid}`, data),
    onSuccess: () => { qc.invalidateQueries(['section', id]); toast.success('Saqlandi'); setShowColModal(null) },
  })

  const addRowMut = useMutation({
    mutationFn: (data) => api.post(`/sections/${id}/rows`, data),
    onSuccess: () => {
      qc.invalidateQueries(['section-rows', id])
      toast.success('Qator qo\'shildi')
      setShowRowModal(null)
      setRowForm({ district_id: '', cells: {} })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const updateRowMut = useMutation({
    mutationFn: ({ rid, data }) => api.put(`/sections/${id}/rows/${rid}`, data),
    onSuccess: () => {
      qc.invalidateQueries(['section-rows', id])
      toast.success('Saqlandi')
      setShowRowModal(null)
    },
  })

  const delRowMut = useMutation({
    mutationFn: (rid) => api.delete(`/sections/${id}/rows/${rid}`),
    onSuccess: () => { qc.invalidateQueries(['section-rows', id]); toast.success("O'chirildi") },
  })

  const columns = rowsData?.columns || section?.columns || []
  const rows = rowsData?.items || []
  const total = rowsData?.total || 0
  const pages = rowsData?.pages || 1

  // ── Column form submit
  const handleColSubmit = (e) => {
    e.preventDefault()
    if (!colForm.name) { toast.error('Nom kerak'); return }
    const data = { ...colForm, key: colForm.key || colForm.name.toLowerCase().replace(/\s+/g, '_') }
    if (showColModal === 'create') addColMut.mutate(data)
    else updateColMut.mutate({ cid: showColModal.id, data })
  }

  const openEditCol = (col) => {
    setColForm({ name: col.name, key: col.key, data_type: col.data_type, order: col.order })
    setShowColModal(col)
  }

  // ── Row form submit
  const handleRowSubmit = (e) => {
    e.preventDefault()
    const data = {
      district_id: rowForm.district_id ? parseInt(rowForm.district_id) : null,
      cells: rowForm.cells,
    }
    if (showRowModal === 'create') addRowMut.mutate(data)
    else updateRowMut.mutate({ rid: showRowModal.id, data })
  }

  const openEditRow = (row) => {
    setRowForm({ district_id: row.district_id || '', cells: { ...row.cells } })
    setShowRowModal(row)
  }

  // ── Export
  const handleExport = async () => {
    try {
      const res = await api.get(`/sections/${id}/excel/export`, {
        params: { district_id: districtId || undefined },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${section?.name || 'export'}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Yuklab olindi!')
    } catch { toast.error('Export xatosi') }
  }

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get(`/sections/${id}/excel/template`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${section?.name || 'template'}_template.xlsx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Template yuklab olishda xato') }
  }

  if (!section) return (
    <div className="flex justify-center py-20">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link to="/superadmin/sections" className="btn btn-ghost btn-sm btn-circle">
            <ArrowLeft size={16} />
          </Link>
          <div className={`w-10 h-10 rounded-xl bg-${section.color || 'primary'}/10 flex items-center justify-center text-lg`}>
            {section.icon || '📊'}
          </div>
          <div>
            <h1 className="font-bold text-base-content text-xl">{section.full_name}</h1>
            <p className="text-sm text-base-content/50">{section.name} • {total} ta yozuv</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleDownloadTemplate} className="btn btn-ghost btn-sm gap-2">
            <FileSpreadsheet size={14} /> Template
          </button>
          <button onClick={() => setShowImportModal(true)} className="btn btn-outline btn-sm gap-2">
            <Upload size={14} /> Import
          </button>
          <button onClick={handleExport} className="btn btn-outline btn-sm gap-2">
            <Download size={14} /> Export
          </button>
          <button onClick={() => { setColForm({ name: '', key: '', data_type: 'text', order: columns.length }); setShowColModal('create') }}
            className="btn btn-ghost btn-sm gap-2">
            <Settings2 size={14} /> Ustun qo'shish
          </button>
          <button
            onClick={() => { setRowForm({ district_id: '', cells: {} }); setShowRowModal('create') }}
            className="btn btn-primary btn-sm gap-2"
          >
            <Plus size={14} /> Qator qo'shish
          </button>
        </div>
      </div>

      {/* Columns management bar */}
      {section.columns?.length > 0 && (
        <div className="bg-base-100 rounded-xl border border-base-300 p-3 flex gap-2 flex-wrap items-center">
          <span className="text-xs font-medium text-base-content/50">Ustunlar:</span>
          {section.columns.map(col => (
            <div key={col.id} className="flex items-center gap-1 bg-base-200 rounded-lg px-2 py-1">
              <span className="text-xs font-medium">{col.name}</span>
              <button onClick={() => openEditCol(col)} className="text-base-content/30 hover:text-primary">
                <Edit2 size={10} />
              </button>
              <button onClick={() => {
                if (confirm(`"${col.name}" ustunini o'chirishni tasdiqlang?`)) delColMut.mutate(col.id)
              }} className="text-base-content/30 hover:text-error">
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          className="select select-bordered select-sm w-48"
          value={districtId}
          onChange={e => { setDistrictId(e.target.value); setPage(1) }}
        >
          <option value="">Barcha tumanlar</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <span className="text-sm text-base-content/50">Jami: {total} ta yozuv</span>
      </div>

      {/* Table */}
      <div className="table-container">
        {rowsLoading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner text-primary" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-base-content/40">
            <p className="text-sm">Hozircha ma'lumot yo'q</p>
          </div>
        ) : (
          <table className="table table-sm table-zebra w-full">
            <thead>
              <tr className="bg-base-200 text-base-content/60 text-xs">
                <th className="w-10">#</th>
                <th>Tuman</th>
                {columns.map(c => (
                  <th key={c.id || c.key}>{c.name}</th>
                ))}
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="hover">
                  <td className="text-base-content/40 text-xs">{(page - 1) * 20 + i + 1}</td>
                  <td className="text-xs text-base-content/60">{row.district_name || '—'}</td>
                  {columns.map(c => (
                    <td key={c.key} className="text-sm max-w-[200px] truncate">
                      {row.cells?.[c.key] ?? '—'}
                    </td>
                  ))}
                  <td>
                    <div className="flex gap-1">
                      <button onClick={() => openEditRow(row)} className="btn btn-ghost btn-xs">
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => { if (confirm('O\'chirilsinmi?')) delRowMut.mutate(row.id) }}
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

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn btn-ghost btn-sm btn-circle">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-base-content/60">{page} / {pages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === pages} className="btn btn-ghost btn-sm btn-circle">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Column Modal */}
      {showColModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-sm">
            <h3 className="font-bold text-base mb-4">
              {showColModal === 'create' ? 'Ustun qo\'shish' : 'Ustunni tahrirlash'}
            </h3>
            <form onSubmit={handleColSubmit} className="space-y-3">
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Nomi *</span></label>
                <input className="input input-bordered input-sm" value={colForm.name}
                  onChange={e => setColForm(f => ({ ...f, name: e.target.value }))} placeholder="MFY nomi" />
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Key (ixtiyoriy)</span></label>
                <input className="input input-bordered input-sm" value={colForm.key}
                  onChange={e => setColForm(f => ({ ...f, key: e.target.value }))} placeholder="mfy_nomi" />
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Turi</span></label>
                <select className="select select-bordered select-sm" value={colForm.data_type}
                  onChange={e => setColForm(f => ({ ...f, data_type: e.target.value }))}>
                  <option value="text">Matn</option>
                  <option value="number">Raqam</option>
                  <option value="date">Sana</option>
                </select>
              </div>
              <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowColModal(null)}>Bekor</button>
                <button type="submit" className="btn btn-primary btn-sm">Saqlash</button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setShowColModal(null)}>close</button></form>
        </dialog>
      )}

      {/* ── Row Modal */}
      {showRowModal && (
        <dialog open className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-base mb-4">
              {showRowModal === 'create' ? 'Qator qo\'shish' : 'Qatorni tahrirlash'}
            </h3>
            <form onSubmit={handleRowSubmit} className="space-y-3">
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Tuman</span></label>
                <select className="select select-bordered select-sm" value={rowForm.district_id}
                  onChange={e => setRowForm(f => ({ ...f, district_id: e.target.value }))}>
                  <option value="">Tanlanmagan</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              {columns.map(col => (
                <div key={col.key} className="form-control">
                  <label className="label pb-1"><span className="label-text text-sm font-medium">{col.name}</span></label>
                  <input
                    className="input input-bordered input-sm"
                    type={col.data_type === 'number' ? 'number' : 'text'}
                    value={rowForm.cells[col.key] || ''}
                    onChange={e => setRowForm(f => ({ ...f, cells: { ...f.cells, [col.key]: e.target.value } }))}
                  />
                </div>
              ))}
              <div className="modal-action">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowRowModal(null)}>Bekor</button>
                <button type="submit" className="btn btn-primary btn-sm"
                  disabled={addRowMut.isPending || updateRowMut.isPending}>
                  {(addRowMut.isPending || updateRowMut.isPending) && <span className="loading loading-spinner loading-xs" />}
                  Saqlash
                </button>
              </div>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop"><button onClick={() => setShowRowModal(null)}>close</button></form>
        </dialog>
      )}

      {/* ── Import Modal */}
      {showImportModal && (
        <ImportModal
          sectionId={id}
          columns={section.columns || []}
          districts={districts}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false)
            qc.invalidateQueries(['section-rows', id])
            toast.success('Import muvaffaqiyatli!')
          }}
        />
      )}
    </div>
  )
}


// Normalize text: lowercase, collapse all whitespace (including \n \r) to single space, trim
function norm(s) {
  return String(s).toLowerCase().replace(/[\s\r\n]+/g, ' ').trim()
}

// ── Auto-detect column mapping by name/key similarity
function autoDetectMapping(headers, sectionCols) {
  const mapping = {}
  headers.forEach((hdr, idx) => {
    if (!hdr) return
    const h = norm(hdr)
    for (const col of sectionCols) {
      const name = norm(col.name)
      const key = col.key.toLowerCase().trim()
      if (h === name || h === key || h.includes(key) || h.includes(name) || name.includes(h)) {
        mapping[idx] = col.key
        break
      }
    }
  })
  return mapping
}

// ── Import Modal Component
function ImportModal({ sectionId, columns, districts, onClose, onSuccess }) {
  const [step, setStep] = useState(1) // 1=upload, 2=configure, 3=done
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [config, setConfig] = useState({
    district_id: '',
    sheet_index: 0,
    skip_rows: 0,
    header_row: 0,
    skip_columns: [],
    column_mapping: {},
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = async (e) => {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const fd = new FormData()
    fd.append('file', f)
    fd.append('sheet_index', 0)
    try {
      setIsLoading(true)
      const res = await api.post(`/sections/${sectionId}/excel/preview`, fd)
      const pv = res.data
      setPreview(pv)
      const autoMapping = autoDetectMapping(pv.headers || [], columns)
      setConfig(c => ({ ...c, header_row: 0, column_mapping: autoMapping }))
      setStep(2)
    } catch (e) {
      toast.error('Faylni o\'qishda xato: ' + (e.response?.data?.detail || ''))
    } finally {
      setIsLoading(false)
    }
  }

  const handleImport = async () => {
    if (!config.district_id) { toast.error('Tumanni tanlang'); return }

    const headerCells = (preview?.preview_rows[config.header_row]?.data || [])
    let activeMapping = { ...config.column_mapping }

    // Auto-create columns for any header that has no mapping (not skipped, not empty)
    const unmappedIndices = []
    for (let i = 0; i < headerCells.length; i++) {
      if (config.skip_columns.includes(i)) continue
      if (!headerCells[i]) continue
      if (!activeMapping[i]) unmappedIndices.push(i)
    }

    if (unmappedIndices.length > 0) {
      try {
        setIsLoading(true)
        for (const i of unmappedIndices) {
          const res = await api.post(`/sections/${sectionId}/columns`, {
            name: String(headerCells[i]),
            data_type: 'text',
            order: i,
          })
          activeMapping[i] = res.data.key
        }
      } catch (e) {
        toast.error('Ustun yaratishda xato: ' + (e.response?.data?.detail || e.message || ''))
        setIsLoading(false)
        return
      }
    }

    if (Object.keys(activeMapping).length === 0) {
      toast.error('Ustun moslamasi topilmadi')
      setIsLoading(false)
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    fd.append('district_id', config.district_id)
    fd.append('sheet_index', config.sheet_index)
    fd.append('skip_rows', config.skip_rows)
    fd.append('header_row', config.header_row)
    fd.append('skip_columns', JSON.stringify(config.skip_columns))
    fd.append('column_mapping', JSON.stringify(activeMapping))
    try {
      setIsLoading(true)
      const res = await api.post(`/sections/${sectionId}/excel/import`, fd)
      toast.success(res.data.message)
      onSuccess()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import xatosi')
    } finally {
      setIsLoading(false)
    }
  }

  const headerRow = preview ? preview.preview_rows[config.header_row] : null
  const headerCells = headerRow?.data || []

  return (
    <dialog open className="modal modal-open">
      <div className="modal-box max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Upload size={18} /> Excel import
        </h3>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-base-content/60">Excel fayl tanlang (.xlsx)</p>
            <input type="file" accept=".xlsx,.xls" onChange={handleFileChange}
              className="file-input file-input-bordered w-full" />
            {isLoading && <div className="flex justify-center py-4"><span className="loading loading-spinner text-primary" /></div>}
          </div>
        )}

        {step === 2 && preview && (
          <div className="space-y-4">
            {/* Sheet select */}
            {preview.sheet_names?.length > 1 && (
              <div className="form-control">
                <label className="label pb-1"><span className="label-text font-medium">Sheet</span></label>
                <select className="select select-bordered select-sm"
                  value={config.sheet_index}
                  onChange={e => setConfig(c => ({ ...c, sheet_index: parseInt(e.target.value) }))}>
                  {preview.sheet_names.map((s, i) => (
                    <option key={i} value={i}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Tuman *</span></label>
                <select className="select select-bordered select-sm"
                  value={config.district_id}
                  onChange={e => setConfig(c => ({ ...c, district_id: e.target.value }))}>
                  <option value="">Tanlang</option>
                  {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Nechinchi qatordan (skip)</span></label>
                <input type="number" min={0} className="input input-bordered input-sm"
                  value={config.skip_rows}
                  onChange={e => setConfig(c => ({ ...c, skip_rows: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="form-control">
                <label className="label pb-1"><span className="label-text text-sm font-medium">Header qator indeksi</span></label>
                <input type="number" min={0} className="input input-bordered input-sm"
                  value={config.header_row}
                  onChange={e => setConfig(c => ({ ...c, header_row: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            {/* Column mapping */}
            <div>
              <p className="text-sm font-medium mb-2">Ustun moslamasi</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {headerCells.map((hdr, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={!config.skip_columns.includes(i)}
                        onChange={e => {
                          setConfig(c => ({
                            ...c,
                            skip_columns: e.target.checked
                              ? c.skip_columns.filter(x => x !== i)
                              : [...c.skip_columns, i]
                          }))
                        }}
                      />
                      <span className="text-xs bg-base-200 px-2 py-0.5 rounded truncate max-w-[150px]">
                        {hdr || `Ustun ${i + 1}`}
                      </span>
                    </div>
                    <span className="text-base-content/30 text-xs">→</span>
                    <select
                      className="select select-bordered select-xs flex-1"
                      value={config.column_mapping[i] || ''}
                      onChange={e => setConfig(c => ({
                        ...c,
                        column_mapping: { ...c.column_mapping, [i]: e.target.value }
                      }))}
                      disabled={config.skip_columns.includes(i)}
                    >
                      <option value="">Moslashtirmaslik</option>
                      {columns.map(col => (
                        <option key={col.key} value={col.key}>{col.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview table */}
            <div>
              <p className="text-xs font-medium text-base-content/50 mb-2">Ko'rinish (dastlabki 5 qator):</p>
              <div className="overflow-x-auto rounded-lg border border-base-300">
                <table className="table table-xs">
                  <tbody>
                    {preview.preview_rows.slice(0, 6).map((row, ri) => (
                      <tr key={ri} className={ri === config.header_row ? 'bg-primary/5 font-medium' : ''}>
                        <td className="text-base-content/30 text-xs w-8">{row.index}</td>
                        {row.data.slice(0, 8).map((cell, ci) => (
                          <td key={ci} className="text-xs max-w-[100px] truncate">{cell ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="modal-action mt-4">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Bekor qilish</button>
          {step === 2 && (
            <button className="btn btn-primary btn-sm gap-2" onClick={handleImport} disabled={isLoading}>
              {isLoading && <span className="loading loading-spinner loading-xs" />}
              <Upload size={14} /> Import qilish
            </button>
          )}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button onClick={onClose}>close</button></form>
    </dialog>
  )
}
