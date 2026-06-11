import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from 'recharts'
import {
  TrendingUp, Users, FolderOpen, MessageSquare,
  CheckCircle, Clock, AlertCircle, Map, Bot,
  ArrowUpRight, Activity,
} from 'lucide-react'
import api from '../../services/api'
import useAuthStore from '../../store/authStore'

const COLORS = ['#4F79E0','#0CBFA0','#F0A020','#E8385A','#7B5EF5','#3B9EE8','#FF6B6B','#22C55E']

const fmt = (n) => Number(n).toLocaleString('uz-UZ')

// Custom tooltip for bar charts
const BarTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const persons = payload.find(p => p.dataKey === 'persons')?.value || 0
  const mfy = payload.find(p => p.dataKey === 'mfy')?.value || 0
  return (
    <div className="px-3 py-2 rounded-xl border border-base-300/60 bg-base-100 shadow-lg text-xs">
      <p className="font-semibold text-base-content mb-1 max-w-[160px] truncate">{label}</p>
      <p className="text-primary font-bold font-mono">{fmt(persons)} ta shaxs</p>
      <p className="text-base-content/40 font-mono mt-0.5">{fmt(mfy)} ta MFY</p>
    </div>
  )
}

export default function AdminDashboard() {
  const { user } = useAuthStore()

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => api.get('/dashboard/analytics').then(r => r.data),
    refetchInterval: 120_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <p className="text-sm text-base-content/40">Tahlil yuklanmoqda...</p>
      </div>
    </div>
  )

  const districts = analytics?.districts || []
  const sections = analytics?.sections || []
  const appealStats = analytics?.appeal_stats || {}
  const totalRecords = analytics?.total_records || 0
  const totalPersons = analytics?.total_persons || 0
  const coveredDistricts = analytics?.covered_districts || 0
  const botUsers = analytics?.bot_users || 0

  const totalAppeals = Object.values(appealStats).reduce((a, b) => a + b, 0)
  const resolvedAppeals = (appealStats.resolved || 0) + (appealStats.rejected || 0)
  const resolutionRate = totalAppeals > 0 ? Math.round((resolvedAppeals / totalAppeals) * 100) : 0
  const coverageRate = districts.length > 0 ? Math.round((coveredDistricts / districts.length) * 100) : 0

  // Sort districts by persons_total (actual beneficiary count) for chart
  const districtChartData = [...districts]
    .sort((a, b) => b.persons_total - a.persons_total)
    .slice(0, 14)
    .map(d => ({
      name: d.name.replace(' tumani', '').replace(' shahri', ''),
      persons: d.persons_total,
      mfy: d.total,
    }))

  // Appeal pie
  const appealPieData = [
    { name: 'Yangi', value: appealStats.new || 0, color: '#F0A020' },
    { name: "Ko'rib chiqilmoqda", value: appealStats.in_review || 0, color: '#4F79E0' },
    { name: 'Hal qilingan', value: appealStats.resolved || 0, color: '#0CBFA0' },
    { name: 'Rad etilgan', value: appealStats.rejected || 0, color: '#E8385A' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-primary to-secondary">
        <div className="absolute right-0 top-0 bottom-0 w-56 opacity-10 pointer-events-none">
          <div className="absolute right-8 top-4 w-36 h-36 rounded-full border-[22px] border-white" />
          <div className="absolute right-0 bottom-2 w-20 h-20 rounded-full border-[12px] border-white" />
        </div>
        <div className="relative z-10 flex items-end justify-between flex-wrap gap-3">
          <div>
            <p className="text-primary-content/70 text-sm font-medium mb-1">Xush kelibsiz 👋</p>
            <h2 className="font-display text-2xl font-bold text-primary-content">{user?.full_name}</h2>
            <p className="text-primary-content/60 text-sm mt-1">Andijon viloyati · Ijtimoiy himoya tahlili</p>
          </div>
          <div className="flex gap-4">
            <div className="text-right">
              <p className="text-3xl font-bold text-primary-content font-mono">{fmt(totalPersons || totalRecords)}</p>
              <p className="text-primary-content/60 text-xs">{totalPersons ? 'Jami shaxslar' : 'Jami yozuv'}</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary-content font-mono">{coverageRate}%</p>
              <p className="text-primary-content/60 text-xs">Qamrov</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: FolderOpen, label: "Bo'limlar", value: sections.length,
            sub: `${fmt(totalPersons || totalRecords)} ta ${totalPersons ? 'shaxs' : 'yozuv'}`, accent: '#4F79E0',
          },
          {
            icon: Map, label: 'Tumanlar qamrovi', value: `${coveredDistricts}/${districts.length}`,
            sub: `${coverageRate}% qamrov`, accent: '#0CBFA0',
          },
          {
            icon: MessageSquare, label: 'Murojaatlar', value: fmt(totalAppeals),
            sub: `${resolutionRate}% hal qilingan`, accent: '#F0A020',
          },
          {
            icon: Bot, label: 'Bot foydalanuvchi', value: fmt(botUsers),
            sub: "Ro'yxatdan o'tgan", accent: '#7B5EF5',
          },
        ].map(({ icon: Icon, label, value, sub, accent }) => (
          <div key={label} className="stat-card">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${accent}18` }}>
                <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
              </div>
              <Activity size={12} className="text-base-content/20" />
            </div>
            <p className="num-display text-[26px] font-bold leading-none text-base-content mb-1">{value}</p>
            <p className="text-[13px] font-semibold text-base-content/70">{label}</p>
            <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-40"
              style={{ background: accent }} />
          </div>
        ))}
      </div>

      {/* ── District bar chart + Appeal pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* District person counts */}
        <div className="lg:col-span-2 stat-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-display font-semibold text-base-content text-[15px]">
                Tumanlar bo'yicha shaxslar soni
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">Har bir tumandagi ijtimoiy himoya beneficiarlari</p>
            </div>
          </div>
          {districtChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={districtChartData} layout="vertical" barSize={14}
                margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.12)" horizontal={false} />
                <XAxis type="number"
                  tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.6)', fontFamily: 'JetBrains Mono' }}
                  axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={88}
                  tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.7)', fontFamily: 'Plus Jakarta Sans' }}
                  axisLine={false} tickLine={false} />
                <Tooltip content={<BarTip />} cursor={{ fill: 'rgba(79,121,224,0.05)', radius: 3 }} />
                <Bar dataKey="persons" radius={[0, 5, 5, 0]}>
                  {districtChartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-base-content/30">Ma'lumot yo'q</p>
            </div>
          )}
        </div>

        {/* Appeal breakdown */}
        <div className="stat-card flex flex-col">
          <p className="font-display font-semibold text-base-content text-[15px] mb-1">Murojaatlar holati</p>
          <p className="text-xs text-base-content/40 mb-4">Statuslar bo'yicha taqsimot</p>

          {appealPieData.length > 0 ? (
            <div className="flex-1 flex flex-col items-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={appealPieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                    dataKey="value" paddingAngle={3}>
                    {appealPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v) => [`${v} ta`, '']}
                    contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-full space-y-1.5 mt-2">
                {appealPieData.map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-base-content/60">{item.name}</span>
                    </div>
                    <span className="font-mono font-semibold text-base-content">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-base-content/30">Murojaat yo'q</p>
            </div>
          )}

          {/* Resolution rate */}
          {totalAppeals > 0 && (
            <div className="mt-4 pt-4 border-t border-base-300">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-base-content/50">Hal qilish darajasi</span>
                <span className="font-semibold text-success">{resolutionRate}%</span>
              </div>
              <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full transition-all duration-700"
                  style={{ width: `${resolutionRate}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section stats cards */}
      {sections.length > 0 && (
        <div>
          <p className="font-display font-semibold text-base-content text-[15px] mb-3">
            Bo'limlar kesimida
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            {sections.map((s, i) => (
              <div key={s.id}
                className="bg-base-100 rounded-xl border border-base-300 p-3 text-center hover:shadow-sm transition-shadow">
                <div className={`w-9 h-9 rounded-lg mx-auto mb-2 flex items-center justify-center text-base`}
                  style={{ background: `${COLORS[i % COLORS.length]}18` }}>
                  {s.icon || '📊'}
                </div>
                <p className="font-mono font-bold text-xl text-base-content leading-none">
                  {fmt(s.persons > 0 ? s.persons : s.total)}
                </p>
                <p className="text-[10px] text-base-content/35 mt-0.5 font-mono">
                  {s.persons > 0 ? 'ta shaxs' : 'ta yozuv'}
                </p>
                <p className="text-[11px] text-base-content/50 mt-1 leading-tight line-clamp-2">{s.name}</p>
                {s.persons > 0 && s.total > 0 && (
                  <p className="text-[10px] text-base-content/25 mt-0.5">{fmt(s.total)} MFY</p>
                )}
                <div className="mt-2 h-0.5 rounded-full mx-auto w-8" style={{ background: COLORS[i % COLORS.length], opacity: 0.5 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── District × Section matrix */}
      {districts.length > 0 && sections.length > 0 && (
        <div className="stat-card overflow-hidden">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-display font-semibold text-base-content text-[15px]">
                Tumanlar va bo'limlar kesimi
              </p>
              <p className="text-xs text-base-content/40 mt-0.5">Shaxslar soni · qavs ichida MFY yozuvlar soni</p>
            </div>
          </div>
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="table table-xs w-full min-w-max">
              <thead>
                <tr className="bg-base-200/70">
                  <th className="font-semibold text-base-content/60 text-xs sticky left-0 bg-base-200/70 w-36">
                    Tuman
                  </th>
                  {sections.map(s => (
                    <th key={s.id} className="text-center font-medium text-base-content/60 text-[11px] max-w-[72px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span>{s.icon || '📊'}</span>
                        <span className="leading-tight">{s.name}</span>
                      </div>
                    </th>
                  ))}
                  <th className="text-center font-semibold text-base-content/60 text-xs">Jami</th>
                </tr>
              </thead>
              <tbody>
                {districts
                  .slice()
                  .sort((a, b) => b.total - a.total)
                  .map(d => (
                  <tr key={d.id} className="hover border-b border-base-200">
                    <td className="font-medium text-xs text-base-content/80 sticky left-0 bg-base-100 max-w-[144px]">
                      <span className="truncate block">{d.name}</span>
                    </td>
                    {sections.map(s => {
                      const sec = d.sections.find(x => x.id === s.id)
                      const persons = sec?.persons || 0
                      const cnt = sec?.count || 0
                      const display = persons > 0 ? persons : cnt
                      return (
                        <td key={s.id} className="text-center">
                          {display > 0 ? (
                            <div className="flex flex-col items-center">
                              <span className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-semibold bg-success/10 text-success">
                                {fmt(display)}
                              </span>
                              {persons > 0 && cnt > 0 && (
                                <span className="text-[10px] text-base-content/25 font-mono mt-0.5">{cnt} MFY</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-base-content/20 text-xs">—</span>
                          )}
                        </td>
                      )
                    })}
                    <td className="text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                        (d.persons_total || d.total) > 0 ? 'bg-primary/10 text-primary' : 'text-base-content/20'
                      }`}>
                        {(d.persons_total || d.total) > 0 ? fmt(d.persons_total || d.total) : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-base-200/50 font-semibold">
                  <td className="text-xs sticky left-0 bg-base-200/50">Jami</td>
                  {sections.map(s => (
                    <td key={s.id} className="text-center">
                      <span className="text-xs font-mono font-bold text-base-content/70">
                        {fmt(s.persons > 0 ? s.persons : s.total)}
                      </span>
                    </td>
                  ))}
                  <td className="text-center">
                    <span className="text-xs font-mono font-bold text-primary">
                      {fmt(totalPersons || totalRecords)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
