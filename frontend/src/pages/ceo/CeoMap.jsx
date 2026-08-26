import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../../services/api';
import { Radio, Users, Wifi, WifiOff } from 'lucide-react';
function mkIco(img) {
  if (img) {
    return L.divIcon({
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -50],
      html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #4169E1;background:rgba(255,255,255,0.25);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow:hidden;box-shadow:0 4px 15px rgba(65,105,225,0.4)"><img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'"/></div>`,
    });
  }
  return L.divIcon({
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -50],
    html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid #4169E1;background:rgba(255,255,255,0.25);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(65,105,225,0.4)"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4169E1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  });
}
function FitBounds({ emps }) {
  const map = useMap();
  useEffect(() => {
    const pts = Object.values(emps);
    if (pts.length === 0) return;
    const bounds = pts.map(p => [p.lat, p.lon]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [Object.keys(emps).length]);
  return null;
}
export default function CeoMap() {
  const [emps, setEmps] = useState({});
  const [connected, setConnected] = useState(false);
  const ws = useRef(null);
  useEffect(() => {
    const tok = localStorage.getItem('access_token');
    const base = API_BASE_URL || window.location.origin;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = base.replace(/^https?:\/\//, '');
    const url = `${proto}://${host}/ws/ceo/track/?token=${tok}`;
    const sock = new WebSocket(url);
    sock.onopen = () => setConnected(true);
    sock.onclose = () => setConnected(false);
    sock.onerror = () => setConnected(false);
    sock.onmessage = (evt) => {
      const d = JSON.parse(evt.data);
      if (d.status === 'offline') {
        setEmps(prev => {
          const nxt = { ...prev };
          delete nxt[d.eid];
          return nxt;
        });
        return;
      }
      setEmps(prev => ({
        ...prev,
        [d.eid]: { name: d.name, lat: d.lat, lon: d.lon, ts: d.ts, img: d.img || '' },
      }));
    };
    ws.current = sock;
    return () => sock.close();
  }, []);
  const cnt = Object.keys(emps).length;
  return (
    <div className="relative w-full h-[calc(100vh-8rem)]">
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border shadow-lg backdrop-blur-md ${connected ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' : 'bg-red-500/15 border-red-500/30 text-red-400'}`}>
          {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {connected ? 'Live' : 'Disconnected'}
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-lg backdrop-blur-md">
          <Users className="w-3.5 h-3.5" />
          {cnt} Active
        </div>
      </div>
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md">
        <Radio className="w-4 h-4 text-brand-400 animate-pulse" />
        <span className="text-sm font-bold text-white">Employee Live Tracker</span>
      </div>
      <MapContainer center={[20.5937, 78.9629]} zoom={5} className="w-full h-full rounded-2xl overflow-hidden border border-slate-800" style={{ background: '#0f172a' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
        <FitBounds emps={emps} />
        {Object.entries(emps).map(([eid, d]) => (
          <Marker key={eid} position={[d.lat, d.lon]} icon={mkIco(d.img)}>
            <Popup>
              <div style={{ minWidth: '160px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  {d.img && <img src={d.img} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #4169E1' }} />}
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{d.name}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{eid}</p>
                  </div>
                </div>
                <p style={{ margin: '2px 0', fontSize: '11px', color: '#475569' }}>{d.lat.toFixed(6)}, {d.lon.toFixed(6)}</p>
                <p style={{ margin: '2px 0', fontSize: '10px', color: '#94a3b8' }}>{new Date(d.ts * 1000).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
