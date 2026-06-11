import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bot, Save, RefreshCw, Trash2, Link, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'

export default function BotSettings() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ token: '', webhook_url: '', is_active: false })

  const { data: settings, isLoading } = useQuery({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/bot-admin/settings').then(r => r.data),
  })

  useEffect(() => {
    if (settings) {
      setForm({
        token: settings.token || '',
        webhook_url: settings.webhook_url || '',
        is_active: settings.is_active,
      })
    }
  }, [settings])

  const saveMut = useMutation({
    mutationFn: (data) => api.put('/bot-admin/settings', data),
    onSuccess: () => { qc.invalidateQueries(['bot-settings']); toast.success('Sozlamalar saqlandi!') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const webhookSetupMut = useMutation({
    mutationFn: () => api.post('/bot-admin/webhook/setup'),
    onSuccess: (res) => {
      if (res.data.success) toast.success(`Webhook o'rnatildi: ${res.data.webhook_url}`)
      else toast.error(res.data.message)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Xato'),
  })

  const webhookDelMut = useMutation({
    mutationFn: () => api.delete('/bot-admin/webhook/delete'),
    onSuccess: (res) => {
      if (res.data.success) toast.success("Webhook o'chirildi")
      else toast.error(res.data.message)
    },
  })

  if (isLoading) return <div className="flex justify-center py-16"><span className="loading loading-spinner text-primary" /></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="page-header">Bot sozlamalari</h1>
        <p className="page-subheader">Telegram botni sozlash va webhook boshqaruvi</p>
      </div>

      {/* Status card */}
      <div className={`flex items-center gap-3 p-4 rounded-xl border ${settings?.is_active ? 'bg-success/5 border-success/20' : 'bg-base-200 border-base-300'}`}>
        {settings?.is_active
          ? <CheckCircle size={20} className="text-success" />
          : <XCircle size={20} className="text-base-content/40" />
        }
        <div>
          <p className="font-medium text-sm">
            {settings?.is_active ? 'Bot faol' : 'Bot faol emas'}
          </p>
          <p className="text-xs text-base-content/50">
            {settings?.webhook_url || 'Webhook URL sozlanmagan'}
          </p>
        </div>
      </div>

      {/* Settings form */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-6 space-y-5">
        <h2 className="font-semibold flex items-center gap-2">
          <Bot size={18} className="text-primary" />
          Bot konfiguratsiyasi
        </h2>

        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text font-medium">Bot Token</span>
          </label>
          <input
            type="password"
            className="input input-bordered"
            placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
            value={form.token}
            onChange={e => setForm(f => ({ ...f, token: e.target.value }))}
          />
          <label className="label pt-1">
            <span className="label-text-alt text-base-content/40">
              @BotFather dan olingan bot tokeni
            </span>
          </label>
        </div>

        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text font-medium">Webhook URL (domen)</span>
          </label>
          <input
            type="url"
            className="input input-bordered"
            placeholder="https://yourdomain.com"
            value={form.webhook_url}
            onChange={e => setForm(f => ({ ...f, webhook_url: e.target.value }))}
          />
          <label className="label pt-1">
            <span className="label-text-alt text-base-content/40">
              HTTPS domen. Webhook URL: {form.webhook_url}/api/bot/webhook
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <input type="checkbox" className="toggle toggle-primary toggle-sm"
            checked={form.is_active}
            onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
          <span className="text-sm font-medium">Botni faollashtirish</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => saveMut.mutate(form)}
            className="btn btn-primary gap-2"
            disabled={saveMut.isPending}
          >
            {saveMut.isPending ? <span className="loading loading-spinner loading-sm" /> : <Save size={15} />}
            Saqlash
          </button>
        </div>
      </div>

      {/* Webhook management */}
      <div className="bg-base-100 rounded-2xl border border-base-300 p-6 space-y-4">
        <h2 className="font-semibold flex items-center gap-2">
          <Link size={18} className="text-primary" />
          Webhook boshqaruvi
        </h2>
        <p className="text-sm text-base-content/60">
          Botni Telegram serveriga ulash uchun webhook o'rnatish zarur.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => webhookSetupMut.mutate()}
            className="btn btn-secondary gap-2"
            disabled={webhookSetupMut.isPending}
          >
            {webhookSetupMut.isPending ? <span className="loading loading-spinner loading-sm" /> : <RefreshCw size={15} />}
            Webhook o'rnatish
          </button>
          <button
            onClick={() => webhookDelMut.mutate()}
            className="btn btn-ghost btn-error gap-2"
            disabled={webhookDelMut.isPending}
          >
            <Trash2 size={15} />
            Webhook o'chirish
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-base-200 rounded-xl p-4 text-sm space-y-2">
        <p className="font-medium">📋 Bot sozlash bo'yicha yo'riqnoma:</p>
        <ol className="list-decimal list-inside space-y-1 text-base-content/70">
          <li>Telegram-da @BotFather ga /newbot yuboring</li>
          <li>Bot nomini va username ni kiriting</li>
          <li>Olingan tokenni yuqoridagi maydonga kiriting</li>
          <li>HTTPS domeningizni Webhook URL ga kiriting</li>
          <li>Saqlang va "Webhook o'rnatish" tugmasini bosing</li>
        </ol>
      </div>
    </div>
  )
}
