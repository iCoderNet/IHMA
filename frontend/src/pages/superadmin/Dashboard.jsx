import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useRef, useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts'
import {
  Users, TrendingUp, FolderOpen, MessageSquare,
  MapPin, X, Clock, CheckCircle, XCircle, Filter,
} from 'lucide-react'
import api from '../../services/api'

/* ─── Constants ─────────────────────────────────────────────────────────── */

const MONTHS = [
  '', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
]

// Andijon viloyati — Wikipedia-verified GPS coordinates (all 16 districts)
const DISTRICT_COORDS = {
  "Andijon shahri": [40.7821, 72.3442],
  "Andijon tumani": [40.861,  72.311],   // Kuyganyor (corrected)
  "Asaka":          [40.6422, 72.2292],
  "Baliqchi":       [40.900,  71.853],   // (corrected, was 72.389)
  "Bo'ston":        [40.683,  71.917],   // Bo'z (corrected, was 72.648)
  "Buloqboshi":     [40.6222, 72.5028],
  "Jalolquduq":     [40.7194, 72.6428],
  "Izboskan":       [40.5636, 72.3539],
  "Qo'rg'ontepa":   [40.7336, 72.7583],
  "Marhamat":       [40.5000, 72.3333],
  "Oltinko'l":      [40.700,  72.167],   // (corrected, was 40.982, 72.572)
  "Paxtaobod":      [40.9283, 72.4992],  // (corrected, was 40.332)
  "Shahrixon":      [40.7108, 72.0500],
  "Ulug'nor":       [40.750,  71.706],   // Oqoltin (corrected, was 41.047, 72.119)
  "Xo'jaobod":      [40.6653, 72.5667],
  "Xonobod shahri": [40.8000, 73.0000],
}

const BOLIM_COLORS = ['#4F79E0', '#0CBFA0', '#F0A020', '#E8385A', '#7B5EF5', '#3B9EE8']

const fmt = (n) => Number(n || 0).toLocaleString('ru-RU')

// Safe abbreviation — never produces duplicate names
const shortName = (name) => {
  if (name === 'Andijon shahri') return 'And. sh.'
  if (name === 'Andijon tumani') return 'And. t.'
  if (name === 'Xonobod shahri') return 'Xonobod'
  return name.replace(' tumani', '').replace(' shahri', '')
}

/* ─── Tooltips ──────────────────────────────────────────────────────────── */

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="px-3 py-2 rounded-xl bg-base-100 border border-base-300/60 shadow-lg text-xs z-50">
      <p className="font-semibold text-base-content mb-0.5 max-w-[160px]">{label}</p>
      <p className="font-bold font-mono text-primary">{fmt(payload[0].value)} kishi</p>
    </div>
  )
}

const StackedTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="px-3 py-2.5 rounded-xl bg-base-100 border border-base-300/60 shadow-lg text-xs z-50 min-w-[170px]">
      <p className="font-semibold text-base-content mb-1.5 border-b border-base-300/50 pb-1.5">{label}</p>
      {payload.map(p => p.value > 0 && (
        <div key={p.name} className="flex items-center justify-between gap-3 mb-0.5">
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.fill }} />
            <span className="text-base-content/70 truncate">{p.name}</span>
          </span>
          <span className="font-mono font-bold flex-shrink-0" style={{ color: p.fill }}>{fmt(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-base-300/50 pt-1.5 mt-1 flex justify-between">
        <span className="text-base-content/50">Jami</span>
        <span className="font-mono font-bold text-base-content">{fmt(total)}</span>
      </div>
    </div>
  )
}

/* ─── Combined stacked chart (all sections of a bolim in one chart) ─────── */

function BolimStackedChart({ bolim }) {
  const sections = bolim.sections

  const data = useMemo(() => {
    const districtMap = {}
    sections.forEach(s => {
      s.per_district.forEach(d => {
        const key = d.district_name
        if (!districtMap[key]) {
          districtMap[key] = { name: shortName(key), _total: 0 }
        }
        districtMap[key][s.name] = d.total
        districtMap[key]._total += d.total
      })
    })
    return Object.values(districtMap)
      .filter(d => d._total > 0)
      .sort((a, b) => b._total - a._total)
  }, [sections])

  if (!data.length) return null
  const height = Math.max(160, data.length * 22 + 44)

  return (
    <div className="bg-base-200/40 border border-base-300/30 rounded-2xl p-4 mb-4">
      <p className="text-[11px] font-semibold text-base-content/50 uppercase tracking-wide mb-3">
        Barcha toifalar birgalikda — tumanlar kesimida
      </p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          barSize={13}
          margin={{ left: 0, right: 32, top: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.08)" horizontal={false} />
          <YAxis
            dataKey="name"
            type="category"
            width={68}
            tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.7)' }}
            axisLine={false}
            tickLine={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 9, fill: 'rgba(120,120,120,0.55)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <Tooltip content={<StackedTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 10 }} iconSize={8} iconType="circle" />
          {sections.map((s, i) => (
            <Bar
              key={s.id}
              dataKey={s.name}
              stackId="a"
              fill={s.color || BOLIM_COLORS[i % BOLIM_COLORS.length]}
              radius={i === sections.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ─── Individual section chart card ─────────────────────────────────────── */

function SectionChart({ section, bolimColor }) {
  const color = section.color || bolimColor || '#4F79E0'

  // ALL 16 districts, sorted desc, reversed for top-to-bottom display
  const chartData = [...section.per_district]
    .sort((a, b) => b.total - a.total)
    .map(d => ({ name: shortName(d.district_name), total: d.total }))
    .reverse()

  const hasData = chartData.some(d => d.total > 0)
  const height = Math.max(120, chartData.length * 20 + 20)

  return (
    <div className="bg-base-100 border border-base-300/60 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl flex-shrink-0">{section.icon || '📊'}</span>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-base-content leading-tight truncate">{section.name}</p>
            <p className="text-[10px] text-base-content/40 truncate max-w-[160px]">{section.full_name}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold font-mono text-lg leading-none" style={{ color }}>{fmt(section.total)}</p>
          <p className="text-[10px] text-base-content/40 mt-0.5">kishi</p>
        </div>
      </div>

      {hasData ? (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            barSize={11}
            margin={{ left: 0, right: 28, top: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" horizontal={false} />
            <YAxis
              dataKey="name"
              type="category"
              width={68}
              tick={{ fontSize: 9.5, fill: 'rgba(120,120,120,0.65)' }}
              axisLine={false}
              tickLine={false}
            />
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: 'rgba(120,120,120,0.55)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="total" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.total > 0 ? color : 'rgba(120,120,120,0.12)'} fillOpacity={entry.total > 0 ? 0.82 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-20 flex items-center justify-center">
          <p className="text-xs text-base-content/25">Ma'lumot yo'q</p>
        </div>
      )}
    </div>
  )
}

/* ─── KPI card ──────────────────────────────────────────────────────────── */

function KPICard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="stat-card relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accent}18` }}>
          <Icon size={18} style={{ color: accent }} strokeWidth={1.8} />
        </div>
      </div>
      <p className="num-display text-[26px] font-bold leading-none text-base-content mb-1">{value}</p>
      <p className="text-[13px] font-semibold text-base-content/70">{label}</p>
      {sub && <p className="text-xs text-base-content/35 mt-0.5">{sub}</p>}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl opacity-30" style={{ background: accent }} />
    </div>
  )
}

/* ─── Embedded Leaflet map ──────────────────────────────────────────────── */

function DistrictMap({ districtTotals, bolimlar }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [leafletReady, setLeafletReady] = useState(false)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (window.L) { setLeafletReady(true); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setLeafletReady(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return
    const L = window.L
    const map = L.map(mapRef.current, {
      center: [40.76, 72.20],  // shifted west to show Ulug'nor / Bo'ston / Baliqchi
      zoom: 9,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)
    mapInstanceRef.current = map
  }, [leafletReady])

  const maxTotal = useMemo(
    () => Math.max(...(districtTotals || []).map(d => d.total), 1),
    [districtTotals],
  )

  useEffect(() => {
    if (!leafletReady || !mapInstanceRef.current || !districtTotals?.length) return
    const L = window.L
    const map = mapInstanceRef.current

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    districtTotals.forEach(d => {
      const coords = DISTRICT_COORDS[d.name]
      if (!coords) return

      const pct = d.total / maxTotal
      const isSelected = selected?.name === d.name
      const size = Math.round(28 + pct * 20)
      const bg = isSelected ? '#1E3A5F' : `hsl(${220 - pct * 40}deg 70% ${60 - pct * 20}%)`
      const border = isSelected ? '#F59E0B' : 'rgba(255,255,255,0.9)'
      const borderW = isSelected ? 3 : 2
      const fontSize = Math.max(8, Math.round(size * 0.28))

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${bg};border:${borderW}px solid ${border};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 10px rgba(0,0,0,0.25);cursor:pointer;
          font-size:${fontSize}px;font-weight:700;color:#fff;
        ">${d.name.slice(0, 2).toUpperCase()}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })

      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindTooltip(
          `<b>${d.name}</b><br>${fmt(d.total)} kishi`,
          { direction: 'top', offset: [0, -(size / 2 + 4)], className: 'leaflet-tooltip-custom' },
        )
        .on('click', () => setSelected(prev => prev?.name === d.name ? null : d))

      markersRef.current.push(marker)
    })
  }, [leafletReady, districtTotals, selected, maxTotal])

  const bolimBreakdown = useMemo(() =>
    selected && bolimlar
      ? bolimlar.map(b => ({
          name: b.name,
          icon: b.icon,
          color: b.color,
          total: b.sections.reduce((sum, s) => {
            const pd = s.per_district.find(p => p.district_name === selected.name)
            return sum + (pd?.total || 0)
          }, 0),
        })).filter(b => b.total > 0)
      : [],
  [selected, bolimlar])

  return (
    <div className="flex" style={{ height: 460 }}>
      <div className="flex-1 relative">
        {!leafletReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-200 z-10">
            <span className="loading loading-spinner text-primary" />
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        <div className="absolute bottom-4 left-4 z-[999] bg-base-100/90 backdrop-blur rounded-xl p-3 border border-base-300 shadow text-xs space-y-1.5">
          <p className="font-semibold text-base-content/50 text-[10px] uppercase tracking-wider mb-2">Andijon viloyati</p>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: 'hsl(200deg 70% 55%)' }} />
            <span className="text-base-content/60">Kam qamrab</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full" style={{ background: 'hsl(180deg 70% 40%)' }} />
            <span className="text-base-content/60">Ko'p qamrab</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-[#1E3A5F] border-2 border-yellow-400" />
            <span className="text-base-content/60">Tanlangan</span>
          </div>
        </div>

        {!selected && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] bg-base-100/90 backdrop-blur px-4 py-2 rounded-xl border border-base-300 shadow text-sm text-base-content/60">
            📍 Tuman belgisiga bosing
          </div>
        )}
      </div>

      <div className={`transition-all duration-300 overflow-hidden border-l border-base-300 ${selected ? 'w-72' : 'w-0'}`}>
        {selected && (
          <div className="w-72 p-4 h-full overflow-y-auto space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  <h4 className="font-bold text-base-content">{selected.name}</h4>
                </div>
                <p className="text-xs text-base-content/40 mt-0.5">Andijon viloyati</p>
              </div>
              <button className="btn btn-ghost btn-xs btn-circle" onClick={() => setSelected(null)}>
                <X size={13} />
              </button>
            </div>

            <div className="bg-primary/10 rounded-xl p-3 text-center">
              <p className="text-xs text-base-content/50 mb-1">Jami qamrab olingan</p>
              <p className="text-3xl font-bold text-primary font-mono">{fmt(selected.total)}</p>
              <p className="text-xs text-base-content/40">kishi</p>
            </div>

            {bolimBreakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/30">Bo'limlar bo'yicha</p>
                {bolimBreakdown.map(b => (
                  <div key={b.name} className="flex items-center gap-2 p-2.5 rounded-xl bg-base-200">
                    <span className="text-base flex-shrink-0">{b.icon || '📋'}</span>
                    <span className="text-xs font-medium text-base-content flex-1">{b.name}</span>
                    <span className="font-bold text-sm font-mono" style={{ color: b.color || '#4F79E0' }}>
                      {fmt(b.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main Dashboard ────────────────────────────────────────────────────── */

export default function SuperadminDashboard() {
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const [districtId, setDistrictId] = useState('')
  const [activeBolim, setActiveBolim] = useState(0)

  const params = new URLSearchParams()
  if (year) params.set('period_year', year)
  if (month) params.set('period_month', month)
  if (districtId) params.set('district_id', districtId)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-v2', year, month, districtId],
    queryFn: () => api.get(`/dashboard/analytics/v2?${params}`).then(r => r.data),
    refetchInterval: 120_000,
    staleTime: 30_000,
  })

  const availableYears = [...new Set(
    (data?.available_periods || []).map(p => p.year).filter(Boolean)
  )].sort((a, b) => b - a)

  const bolimlar = data?.bolimlar || []

  // Safe tab index — never out of bounds
  const currentIdx = Math.min(activeBolim, Math.max(0, bolimlar.length - 1))
  const currentBolim = bolimlar[currentIdx] ?? null

  const appealTotal = data?.appeal_stats
    ? Object.values(data.appeal_stats).reduce((a, v) => a + v, 0)
    : 0

  const hasFilter = year || month || districtId

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <span className="loading loading-spinner loading-md text-primary" />
        <p className="text-sm text-base-content/40">Tahlil yuklanmoqda...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-up">

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-base-content/40">
          <Filter size={13} />
          <span>Filtr:</span>
        </div>

        <select
          className="select select-sm select-bordered min-w-[110px]"
          value={year}
          onChange={e => { setYear(e.target.value); setMonth('') }}
        >
          <option value="">Barcha yillar</option>
          {availableYears.map(y => (
            <option key={y} value={y}>{y}-yil</option>
          ))}
        </select>

        <select
          className="select select-sm select-bordered min-w-[120px]"
          value={month}
          onChange={e => setMonth(e.target.value)}
          disabled={!year}
        >
          <option value="">Barcha oylar</option>
          {MONTHS.slice(1).map((m, i) => (
            <option key={i + 1} value={i + 1}>{m}</option>
          ))}
        </select>

        <select
          className="select select-sm select-bordered min-w-[140px]"
          value={districtId}
          onChange={e => setDistrictId(e.target.value)}
        >
          <option value="">Barcha tumanlar</option>
          {(data?.district_totals || []).map(d => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>

        {hasFilter && (
          <button
            className="btn btn-sm btn-ghost text-error gap-1"
            onClick={() => { setYear(''); setMonth(''); setDistrictId('') }}
          >
            <X size={12} /> Tozalash
          </button>
        )}

        {hasFilter && (
          <div className="ml-auto flex gap-1.5 flex-wrap">
            {year && <span className="badge badge-primary badge-sm font-mono">{year}-yil</span>}
            {month && <span className="badge badge-secondary badge-sm">{MONTHS[Number(month)]}</span>}
            {districtId && (
              <span className="badge badge-accent badge-sm">
                {data?.district_totals?.find(d => String(d.id) === districtId)?.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Users}
          label="Jami qamrab olingan"
          value={fmt(data?.grand_total)}
          sub="kishilar"
          accent="#4F79E0"
        />
        <KPICard
          icon={MapPin}
          label="Faol tumanlar"
          value={data?.active_districts ?? 0}
          sub={`${data?.district_totals?.length ?? 0} tadan`}
          accent="#0CBFA0"
        />
        <KPICard
          icon={FolderOpen}
          label="Bo'limlar"
          value={bolimlar.length}
          sub={`${bolimlar.reduce((a, b) => a + b.sections.length, 0)} ta toifa`}
          accent="#7B5EF5"
        />
        <KPICard
          icon={MessageSquare}
          label="Murojaatlar"
          value={fmt(appealTotal)}
          sub={`${data?.appeal_stats?.new ?? 0} ta yangi`}
          accent="#F0A020"
        />
      </div>

      {/* ── Bo'lim tabs + charts ── */}
      {bolimlar.length > 0 && (
        <div className="stat-card p-0 overflow-hidden">

          {/* Tab bar — inline styles avoid DaisyUI class interference */}
          <div
            className="flex border-b border-base-300/70 overflow-x-auto"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {bolimlar.map((b, i) => {
              const bColor = b.color || BOLIM_COLORS[i % BOLIM_COLORS.length]
              const isActive = currentIdx === i
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveBolim(i)}
                  style={{
                    borderBottom: `2px solid ${isActive ? bColor : 'transparent'}`,
                    color: isActive ? bColor : undefined,
                    backgroundColor: isActive ? `${bColor}0d` : undefined,
                    outline: 'none',
                  }}
                  className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap
                    transition-colors flex-shrink-0 focus:outline-none ${
                    isActive ? '' : 'text-base-content/50 hover:text-base-content hover:bg-base-200/60'
                  }`}
                >
                  <span className="text-base">{b.icon || '📋'}</span>
                  <span>{b.name}</span>
                  <span
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded-md ml-0.5 flex-shrink-0"
                    style={{
                      background: isActive ? `${bColor}20` : 'rgba(128,128,128,0.1)',
                      color: isActive ? bColor : 'rgba(128,128,128,0.6)',
                    }}
                  >
                    {fmt(b.total)}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Tab content */}
          {currentBolim && (
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-display font-bold text-base-content text-[15px]">
                    {currentBolim.full_name || currentBolim.name}
                  </h3>
                  <p className="text-xs text-base-content/40 mt-0.5">
                    Jami:{' '}
                    <span
                      className="font-mono font-bold"
                      style={{ color: currentBolim.color || BOLIM_COLORS[currentIdx] }}
                    >
                      {fmt(currentBolim.total)}
                    </span>{' '}
                    kishi · {currentBolim.sections.length} ta toifa · 16 tuman
                  </p>
                </div>
              </div>

              {/* Combined stacked chart — all sections in one */}
              <BolimStackedChart bolim={currentBolim} />

              {/* Individual section charts — detailed view */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentBolim.sections.map(section => (
                  <SectionChart
                    key={section.id}
                    section={section}
                    bolimColor={currentBolim.color || BOLIM_COLORS[currentIdx]}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── District overview bar chart ── */}
      {!districtId && (data?.district_totals || []).some(d => d.total > 0) && (() => {
        const chartData = [...(data?.district_totals || [])]
          .sort((a, b) => b.total - a.total)
          .map(d => ({ name: shortName(d.name), total: d.total }))
          .reverse()
        const height = Math.max(200, chartData.length * 22 + 20)
        return (
          <div className="stat-card">
            <div className="mb-5">
              <h3 className="font-display font-semibold text-base-content text-[15px]">Tumanlar kesimida umumiy</h3>
              <p className="text-xs text-base-content/40 mt-0.5">Barcha bo'limlar bo'yicha jami qamrab olingan kishilar</p>
            </div>
            <ResponsiveContainer width="100%" height={height}>
              <BarChart
                data={chartData}
                layout="vertical"
                barSize={14}
                margin={{ left: 4, right: 32, top: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.1)" horizontal={false} />
                <YAxis
                  dataKey="name"
                  type="category"
                  width={70}
                  tick={{ fontSize: 10, fill: 'rgba(120,120,120,0.65)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 9, fill: 'rgba(120,120,120,0.55)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#4F79E0" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* ── Murojaatlar holati ── */}
      {appealTotal > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display font-semibold text-base-content text-[15px]">Murojaatlar holati</h3>
              <p className="text-xs text-base-content/40 mt-0.5">Jami: {fmt(appealTotal)} ta</p>
            </div>
            <span className="num-display text-3xl font-bold text-base-content">{fmt(appealTotal)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { key: 'new',       label: 'Yangi',       icon: Clock,        color: '#3B9EE8' },
              { key: 'in_review', label: "Ko'rilmoqda", icon: TrendingUp,   color: '#F0A020' },
              { key: 'resolved',  label: 'Hal qilindi', icon: CheckCircle,  color: '#0CBFA0' },
              { key: 'rejected',  label: 'Rad etildi',  icon: XCircle,      color: '#E8385A' },
            ].map(({ key, label, icon: Icon, color }) => {
              const count = data?.appeal_stats?.[key] ?? 0
              const pct = appealTotal ? Math.round((count / appealTotal) * 100) : 0
              return (
                <div key={key} className="bg-base-200/50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon size={12} style={{ color }} />
                    <span className="text-xs text-base-content/50">{label}</span>
                  </div>
                  <p className="num-display text-xl font-bold" style={{ color }}>{count}</p>
                  <div className="mt-2 h-1 bg-base-300 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                  </div>
                  <p className="text-[10px] text-base-content/30 mt-1 font-mono">{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Embedded map ── */}
      <div className="stat-card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-base-300/50">
          <h3 className="font-display font-semibold text-base-content text-[15px]">Xarita</h3>
          <p className="text-xs text-base-content/40 mt-0.5">
            Andijon viloyati — marker hajmi qamrab olinganlik darajasini ko'rsatadi
          </p>
        </div>
        <DistrictMap districtTotals={data?.district_totals} bolimlar={bolimlar} />
      </div>

    </div>
  )
}
