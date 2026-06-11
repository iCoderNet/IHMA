import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Send, Users, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function Broadcast() {
  const [form, setForm] = useState({ message: '', district_id: '' })
  const [result, setResult] = useState(null)

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  const sendMut = useMutation({
    mutationFn: (data) => api.post('/bot-admin/broadcast', data),
    onSuccess: (res) => {
      setResult(res.data)
      toast.success(`${res.data.sent} ta foydalanuvchiga xabar yuborildi!`)
      setForm({ message: '', district_id: '' })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const handleSend = () => {
    if (!form.message.trim()) { toast.error('Xabar matni kiriting'); return }
    if (!confirm('Ommaviy xabar yuborilsinmi?')) return
    sendMut.mutate({
      message: form.message,
      district_id: form.district_id ? parseInt(form.district_id) : null,
    })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="page-header">Ommaviy xabar</h1>
        <p className="page-subheader">Bot foydalanuvchilariga ommaviy xabar yuborish</p>
      </div>

      <div className="alert alert-warning">
        <AlertCircle size={16} />
        <span className="text-sm">Ommaviy xabar barcha ro'yxatdan o'tgan foydalanuvchilarga yuboriladi. Ehtiyotkorlik bilan foydalaning.</span>
      </div>

      <div className="bg-base-100 rounded-2xl border border-base-300 p-6 space-y-5">
        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text font-medium">Tuman (ixtiyoriy)</span>
          </label>
          <select className="select select-bordered"
            value={form.district_id}
            onChange={e => setForm(f => ({ ...f, district_id: e.target.value }))}>
            <option value="">Barcha tumanlar</option>
            {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <label className="label pt-1">
            <span className="label-text-alt text-base-content/40">
              Bo'sh qoldirsa, barcha foydalanuvchilarga yuboriladi
            </span>
          </label>
        </div>

        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text font-medium">Xabar matni *</span>
          </label>
          <textarea
            className="textarea textarea-bordered h-40"
            placeholder="Xabar matnini kiriting... HTML formatlash qo'llab-quvvatlanadi: <b>qalin</b>, <i>kursiv</i>"
            value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
          />
          <label className="label pt-1">
            <span className="label-text-alt text-base-content/40">{form.message.length} belgi</span>
          </label>
        </div>

        <button
          onClick={handleSend}
          className="btn btn-primary gap-2 w-full"
          disabled={sendMut.isPending}
        >
          {sendMut.isPending ? <span className="loading loading-spinner loading-sm" /> : <Send size={15} />}
          Yuborish
        </button>
      </div>

      {result && (
        <div className="bg-base-100 rounded-2xl border border-base-300 p-5">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Users size={16} />Natija</h3>
          <div className="stats stats-horizontal w-full shadow-none border border-base-300 rounded-xl">
            <div className="stat">
              <div className="stat-title text-xs">Yuborildi</div>
              <div className="stat-value text-success text-2xl">{result.sent}</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs">Xato</div>
              <div className="stat-value text-error text-2xl">{result.failed}</div>
            </div>
            <div className="stat">
              <div className="stat-title text-xs">Jami</div>
              <div className="stat-value text-2xl">{result.total}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
