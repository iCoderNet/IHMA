import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Shield, ShieldOff, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import api from '../../services/api'

export default function BotUsers() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['bot-users', page, search],
    queryFn: () => api.get('/bot-admin/users', {
      params: { page, size: 20, search: search || undefined }
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const blockMut = useMutation({
    mutationFn: (uid) => api.put(`/bot-admin/users/${uid}/block`),
    onSuccess: () => { qc.invalidateQueries(['bot-users']); toast.success('Yangilandi') },
  })

  const users = data?.items || []
  const pages = data?.pages || 1

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-header">Bot foydalanuvchilar</h1>
          <p className="page-subheader">Jami: {data?.total ?? 0} ta ro'yxatdan o'tgan foydalanuvchi</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input
          className="input input-bordered input-sm pl-8 w-full"
          placeholder="FIO yoki telefon..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
        />
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="flex justify-center py-12"><span className="loading loading-spinner text-primary" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-base-content/40">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Foydalanuvchi topilmadi</p>
          </div>
        ) : (
          <table className="table table-sm table-zebra">
            <thead>
              <tr className="text-xs text-base-content/50">
                <th>#</th>
                <th>FIO</th>
                <th>Telegram</th>
                <th>Telefon</th>
                <th>Tuman</th>
                <th>Til</th>
                <th>Holat</th>
                <th>Sana</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className="hover">
                  <td className="text-base-content/40 text-xs">{(page - 1) * 20 + i + 1}</td>
                  <td className="font-medium text-sm">{u.fio || '—'}</td>
                  <td className="text-xs text-base-content/60">
                    {u.username ? `@${u.username}` : u.telegram_id}
                  </td>
                  <td className="text-sm">{u.phone || '—'}</td>
                  <td className="text-xs text-base-content/60">{u.district_name || '—'}</td>
                  <td>
                    <span className="badge badge-ghost badge-xs uppercase">{u.language}</span>
                  </td>
                  <td>
                    {u.is_blocked
                      ? <span className="badge badge-error badge-sm">Bloklangan</span>
                      : u.is_registered
                        ? <span className="badge badge-success badge-sm">Faol</span>
                        : <span className="badge badge-ghost badge-sm">Ro'yxatda emas</span>
                    }
                  </td>
                  <td className="text-xs text-base-content/40">
                    {format(new Date(u.created_at), 'dd.MM.yy')}
                  </td>
                  <td>
                    <button
                      onClick={() => blockMut.mutate(u.id)}
                      className={`btn btn-ghost btn-xs ${u.is_blocked ? 'text-success' : 'text-error'}`}
                      title={u.is_blocked ? 'Blokdan chiqarish' : 'Bloklash'}
                    >
                      {u.is_blocked ? <Shield size={13} /> : <ShieldOff size={13} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn btn-ghost btn-sm btn-circle">
            <ChevronLeft size={15} />
          </button>
          <span className="text-sm text-base-content/60">{page} / {pages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === pages} className="btn btn-ghost btn-sm btn-circle">
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
