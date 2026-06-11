import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'
import { MapPin, Users, MessageSquare, FileSpreadsheet, X, TrendingUp } from 'lucide-react'

// Andijon viloyati tumanlari koordinatalari (taxminiy)
const DISTRICT_COORDS = {
  "Andijon shahri": [40.7821, 72.3442],
  "Asaka":          [40.6422, 72.2292],
  "Baliqchi":       [40.8944, 72.3892],
  "Bo'ston":        [40.5267, 72.6483],
  "Jalolquduq":     [40.9417, 72.4944],
  "Izboskan":       [40.5636, 72.3539],
  "Qo'rg'ontepa":   [40.7183, 72.7856],
  "Marhamat":       [40.4747, 72.5425],
  "Oltinko'l":      [40.9822, 72.5722],
  "Paxtaobod":      [40.3319, 72.5553],
  "Shahrixon":      [40.7108, 72.0500],
  "Ulug'nor":       [41.0467, 72.1189],
  "Xo'jaobod":      [40.8578, 72.6156],
}

export default function MapView() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const [selectedDistrict, setSelectedDistrict] = useState(null)
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  const { data: districts = [] } = useQuery({
    queryKey: ['districts'],
    queryFn: () => api.get('/districts').then(r => r.data),
  })

  const { data: districtStats, isLoading: statsLoading } = useQuery({
    queryKey: ['district-stats', selectedDistrict?.id],
    queryFn: () => api.get(`/districts/${selectedDistrict.id}/stats`).then(r => r.data),
    enabled: !!selectedDistrict?.id,
  })

  // Load Leaflet from CDN
  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => setLeafletLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return

    const L = window.L
    const map = L.map(mapRef.current, {
      center: [40.73, 72.40],
      zoom: 10,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 17,
    }).addTo(map)

    mapInstanceRef.current = map
  }, [leafletLoaded])

  // Add markers when districts + map ready
  useEffect(() => {
    if (!leafletLoaded || !mapInstanceRef.current || !districts.length) return
    const L = window.L
    const map = mapInstanceRef.current

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    districts.forEach(d => {
      const coords = DISTRICT_COORDS[d.name]
      if (!coords) return

      const isSelected = selectedDistrict?.id === d.id

      const icon = L.divIcon({
        className: '',
        html: `<div style="
          width:${isSelected ? 44 : 36}px;
          height:${isSelected ? 44 : 36}px;
          border-radius:50%;
          background:${isSelected ? '#1E3A5F' : '#3B82F6'};
          border:3px solid ${isSelected ? '#F59E0B' : 'white'};
          display:flex;align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.3);
          cursor:pointer;
          font-size:11px;font-weight:700;color:white;
          transition:all 0.2s;
        ">${d.name.slice(0, 2).toUpperCase()}</div>`,
        iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
        iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
      })

      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindTooltip(d.name, { permanent: false, direction: 'top', offset: [0, -20] })
        .on('click', () => setSelectedDistrict(d))

      markersRef.current.push(marker)
    })
  }, [leafletLoaded, districts, selectedDistrict])

  return (
    <div className="flex gap-4 h-[calc(100vh-10rem)]">
      {/* Map */}
      <div className="flex-1 rounded-2xl overflow-hidden shadow-lg border border-base-300 relative">
        {!leafletLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-200 z-10">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}
        <div ref={mapRef} className="w-full h-full" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-base-100/90 backdrop-blur rounded-xl p-3 border border-base-300 shadow-lg">
          <p className="text-xs font-semibold text-base-content/60 mb-2">Andijon viloyati</p>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full bg-primary border border-white shadow" />
            <span>Tuman</span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <div className="w-4 h-4 rounded-full bg-[#1E3A5F] border-2 border-yellow-400 shadow" />
            <span>Tanlangan</span>
          </div>
        </div>

        {/* Hint */}
        {!selectedDistrict && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-base-100/90 backdrop-blur px-4 py-2 rounded-xl border border-base-300 shadow text-sm text-base-content/70">
            📍 Tuman ustiga bosing — ma'lumotlarni ko'ring
          </div>
        )}
      </div>

      {/* Stats panel */}
      <div className={`transition-all duration-300 ${selectedDistrict ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}`}>
        {selectedDistrict && (
          <div className="w-80 h-full overflow-y-auto bg-base-100 rounded-2xl border border-base-300 shadow-lg p-5 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-primary" />
                  <h2 className="font-bold text-lg leading-tight">{selectedDistrict.name}</h2>
                </div>
                <p className="text-xs text-base-content/50 mt-0.5">Andijon viloyati</p>
              </div>
              <button
                onClick={() => setSelectedDistrict(null)}
                className="btn btn-ghost btn-xs btn-circle"
              >
                <X size={14} />
              </button>
            </div>

            {statsLoading ? (
              <div className="flex justify-center py-8">
                <span className="loading loading-spinner loading-md text-primary" />
              </div>
            ) : districtStats ? (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-primary/10 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare size={14} className="text-primary" />
                      <span className="text-xs text-base-content/60">Murojaatlar</span>
                    </div>
                    <p className="text-2xl font-bold text-primary">{districtStats.appeals.total}</p>
                    <div className="mt-1 space-y-0.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-warning">Yangi</span>
                        <span className="font-semibold">{districtStats.appeals.new}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-success">Hal qilindi</span>
                        <span className="font-semibold">{districtStats.appeals.resolved}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-success/10 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users size={14} className="text-success" />
                      <span className="text-xs text-base-content/60">Bot users</span>
                    </div>
                    <p className="text-2xl font-bold text-success">{districtStats.bot_users}</p>
                    <p className="text-xs text-base-content/50 mt-1">Ro'yxatdan o'tgan</p>
                  </div>
                </div>

                {/* Divider */}
                <div className="divider my-1 text-xs text-base-content/40">Bo'limlar bo'yicha</div>

                {/* Sections breakdown */}
                <div className="space-y-2">
                  {districtStats.sections.length === 0 ? (
                    <p className="text-sm text-base-content/40 text-center py-4">Ma'lumot yo'q</p>
                  ) : (
                    districtStats.sections.map(s => (
                      <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-base-200">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                          style={{ background: s.color || '#3B82F6', color: 'white' }}
                        >
                          {s.icon || '📊'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileSpreadsheet size={12} className="text-base-content/40" />
                          <span className="text-sm font-bold text-primary">{s.count}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Total records */}
                <div className="bg-base-200 rounded-xl p-3 flex items-center gap-3">
                  <TrendingUp size={16} className="text-primary" />
                  <span className="text-sm flex-1">Jami yozuvlar</span>
                  <span className="font-bold text-primary">
                    {districtStats.sections.reduce((a, s) => a + s.count, 0)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
