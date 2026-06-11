import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  FolderOpen, MessageSquare, Users, Clock,
  TrendingUp, CheckCircle, XCircle, ArrowUpRight,
  BarChart3, Layers,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import api from '../../services/api'
import { format } from 'date-fns'

const STATUS_MAP = {
  new:       { label: 'Yangi',            cls: 'status-new' },
  in_review: { label: "Ko'rib chiqilmoqda", cls: 'status-review' },
  resolved:  { label: 'Hal qilindi',      cls: 'status-done' },
  rejected:  { label: 'Rad etildi',       cls: 'status-reject' },
}

const CHART_COLORS = [
  '#4F79E0', '#0CBFA0', '#F0A020', '#E8385A',
  '#7B5EF5', '#F0A020', '#3B9EE8', '#FF6B6B',
]

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2.5 rounded-xl border border-base-300/60 bg-base-100 shadow-lg text-sm">
      <p className="font-semibold text-base-content mb-0.5">{label}</p>
      <p className="text-primary font-mono font-bold">{payload[0].value} ta</p>
    </div>
  )
}

export default function SuperadminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/dashboard/stats').then(r => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <p className="text-sm text-base-content/40">Yuklanmoqda...</p>
      </div>
    </div>
  )

  const appealTotal = stats?.appeal_stats
    ? Object.values(stats.appeal_stats).reduce((s, v) => s + v, 0)
    : 0

  return (
    <div className="space-y-6 animate-fade-up">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Bo'limlar"
          value={stats?.sections_count ?? 0}
          sub="Faol bo'limlar"
          accent="#4F79E0"
          to="/superadmin/sections"
          delay={0}
        />
        <StatCard
          icon={Layers}
          label="Jami yozuvlar"
          value={(stats?.records_count ?? 0).toLocaleString()}
          sub="Barcha bo'limlarda"
          accent="#0CBFA0"
          delay={100}
        />
        <StatCard
          icon={MessageSquare}
          label="Murojaatlar"
          value={appealTotal}
          sub={`${stats?.appeal_stats?.new ?? 0} ta yangi`}
          accent="#F0A020"
          to="/superadmin/appeals"
          delay={200}
        />
        <StatCard
          icon={Users}
          label="Bot users"
          value={stats?.bot_users_total ?? 0}
          sub="Ro'yxatdan o'tgan"
          accent="#E8385A"
          to="/superadmin/bot-users"
          delay={300}
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Bar chart */}
        <div className="lg:col-span-2 stat-card animate-fade-up animate-delay-200">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-display font-semibold text-base-content text-[15px]">Bo'limlar statistikasi</p>
              <p className="text-xs text-base-content/40 mt-0.5">Har bir bo'limdagi yozuvlar soni</p>
            </div>
            <Link
              to="/superadmin/sections"
              className="flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
            >
              Ko'rish <ArrowUpRight size={12} />
            </Link>
          </div>
          {stats?.section_stats?.length > 0 ? (
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={stats.section_stats} barSize={22} barGap={4}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(120,120,120,0.15)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.7)', fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false} tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.7)', fontFamily: 'JetBrains Mono' }}
                  axisLine={false} tickLine={false}
                  width={32}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79,121,224,0.06)', radius: 4 }} />
                <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                  {stats.section_stats.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-52 flex items-center justify-center">
              <div className="text-center">
                <BarChart3 size={32} className="text-base-content/10 mx-auto mb-2" />
                <p className="text-sm text-base-content/30">Ma'lumot yo'q</p>
              </div>
            </div>
          )}
        </div>

        {/* Appeal breakdown */}
        <div className="stat-card flex flex-col animate-fade-up animate-delay-300">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="font-display font-semibold text-base-content text-[15px]">Murojaatlar</p>
              <p className="text-xs text-base-content/40 mt-0.5">Holat bo'yicha</p>
            </div>
            <div className="num-display text-2xl font-bold text-base-content">{appealTotal}</div>
          </div>

          <div className="space-y-3 flex-1">
            {[
              { key: 'new',       label: 'Yangi',             icon: Clock,        color: '#3B9EE8' },
              { key: 'in_review', label: "Ko'rilmoqda",       icon: TrendingUp,   color: '#F0A020' },
              { key: 'resolved',  label: 'Hal qilindi',       icon: CheckCircle,  color: '#0CBFA0' },
              { key: 'rejected',  label: 'Rad etildi',        icon: XCircle,      color: '#E8385A' },
            ].map(({ key, label, icon: Icon, color }) => {
              const count = stats?.appeal_stats?.[key] ?? 0
              const pct = appealTotal ? Math.round((count / appealTotal) * 100) : 0
              return (
                <div key={key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon size={12} style={{ color }} />
                    <span className="text-xs text-base-content/60 flex-1">{label}</span>
                    <span className="num-display text-xs font-bold text-base-content">{count}</span>
                    <span className="text-[10px] text-base-content/30 w-7 text-right">{pct}%</span>
                  </div>
                  <div className="h-1 bg-base-300/60 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <Link
            to="/superadmin/appeals"
            className="mt-5 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover:opacity-90 bg-primary/10 text-primary"
          >
            <MessageSquare size={13} />
            Barchasi →
          </Link>
        </div>
      </div>

      {/* ── Recent appeals table ── */}
      <div className="stat-card p-0 overflow-hidden animate-fade-up animate-delay-400">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300/50">
          <div>
            <p className="font-display font-semibold text-base-content text-[15px]">So'nggi murojaatlar</p>
            <p className="text-xs text-base-content/40 mt-0.5">Oxirgi {stats?.recent_appeals?.length ?? 0} ta</p>
          </div>
          <Link
            to="/superadmin/appeals"
            className="flex items-center gap-1 text-xs font-semibold text-primary/70 hover:text-primary transition-colors"
          >
            Barchasi <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="premium-table">
            <thead>
              <tr>
                <th style={{ width: 48 }}>#</th>
                <th>Mavzu</th>
                <th>Holat</th>
                <th>Sana</th>
                <th style={{ width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {stats?.recent_appeals?.length > 0 ? (
                stats.recent_appeals.map((a, i) => (
                  <tr key={a.id} style={{ animationDelay: `${i * 50}ms` }}>
                    <td>
                      <span className="num-display text-xs text-base-content/30">#{a.id}</span>
                    </td>
                    <td>
                      <span className="font-medium text-base-content text-[13px] line-clamp-1">{a.subject}</span>
                    </td>
                    <td>
                      <span className={STATUS_MAP[a.status]?.cls || 'status-new'}>
                        {STATUS_MAP[a.status]?.label || a.status}
                      </span>
                    </td>
                    <td>
                      <span className="num-display text-xs text-base-content/40">
                        {format(new Date(a.created_at), 'dd.MM.yyyy')}
                      </span>
                    </td>
                    <td>
                      <Link
                        to={`/superadmin/appeals?id=${a.id}`}
                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-primary/10 text-base-content/20 hover:text-primary transition-all"
                      >
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <MessageSquare size={28} className="text-base-content/10 mx-auto mb-2" />
                    <p className="text-sm text-base-content/30">Hozircha murojaat yo'q</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent, to, delay = 0 }) {
  const inner = (
    <div
      className="stat-card animate-fade-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${accent}18` }}
        >
          <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
        </div>
        {to && (
          <ArrowUpRight size={14} className="text-base-content/20 group-hover:text-primary transition-colors" />
        )}
      </div>

      {/* Value */}
      <div>
        <p className="num-display text-[28px] font-bold leading-none text-base-content mb-1">{value}</p>
        <p className="text-[13px] font-semibold text-base-content/70">{label}</p>
        {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
      </div>

      {/* Bottom accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-40"
        style={{ background: accent }}
      />
    </div>
  )

  if (to) return <Link to={to} className="block group">{inner}</Link>
  return inner
}
