import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_BASE_URL } from '../../services/api';
import {
  Radio, Users, Wifi, WifiOff, Search, MapPin, Clock, 
  Signal, X, ChevronRight, Loader2, AlertTriangle, RefreshCw
} from 'lucide-react';

// ─── Marker Icon Factory ───────────────────────────────────────────────────
function mkIco(img, status) {
  const borderColor = status === 'live' ? '#10b981' : status === 'stale' ? '#f59e0b' : '#ef4444';
  const shadowColor = status === 'live' ? 'rgba(16,185,129,0.4)' : status === 'stale' ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)';
  const pulse = status === 'live' ? 'animation:pulse 2s infinite;' : '';

  if (img) {
    return L.divIcon({
      className: '',
      iconSize: [48, 48],
      iconAnchor: [24, 48],
      popupAnchor: [0, -50],
      html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid ${borderColor};background:rgba(255,255,255,0.25);backdrop-filter:blur(8px);overflow:hidden;box-shadow:0 4px 15px ${shadowColor};${pulse}"><img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.style.display='none'"/></div>`,
    });
  }
  return L.divIcon({
    className: '',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -50],
    html: `<div style="width:48px;height:48px;border-radius:50%;border:3px solid ${borderColor};background:rgba(255,255,255,0.25);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px ${shadowColor};${pulse}"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${borderColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`,
  });
}

// ─── Auto Fit Bounds ───────────────────────────────────────────────────────
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

// ─── Focus on Employee ─────────────────────────────────────────────────────
function FocusOnEmp({ target, onDone }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.setView([target.lat, target.lon], 16, { animate: true });
      onDone();
    }
  }, [target]);
  return null;
}

// ─── Time Ago Helper ───────────────────────────────────────────────────────
function timeAgo(epochSec) {
  const seconds = Math.floor(Date.now() / 1000 - epochSec);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function statusBadge(status) {
  if (status === 'live') return { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30', label: '● Live' };
  if (status === 'stale') return { color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30', label: '● Stale' };
  return { color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30', label: '● Offline' };
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function CeoMap() {
  const [emps, setEmps] = useState({});
  const [connected, setConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const [focusTarget, setFocusTarget] = useState(null);
  const [tick, setTick] = useState(0); // For re-rendering time-ago
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempt = useRef(0);

  // Auto-tick for time-ago refresh
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // WebSocket connection with auto-reconnect
  const connectWs = useCallback(() => {
    const tok = localStorage.getItem('access_token');
    const base = API_BASE_URL || window.location.origin;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = base.replace(/^https?:\/\//, '');
    const url = `${proto}://${host}/ws/ceo/live/?token=${tok}`;
    
    if (ws.current && ws.current.readyState !== WebSocket.CLOSED) {
      ws.current.close();
    }

    const sock = new WebSocket(url);

    sock.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
    };

    sock.onclose = () => {
      setConnected(false);
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectAttempt.current += 1;
      reconnectTimer.current = setTimeout(connectWs, delay);
    };

    sock.onerror = () => setConnected(false);

    sock.onmessage = (evt) => {
      try {
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
          [d.eid]: {
            name: d.name,
            lat: d.lat,
            lon: d.lon,
            ts: d.ts,
            img: d.img || '',
            status: d.status || 'live',
            accuracy: d.accuracy ?? null,
            speed: d.speed ?? null,
          },
        }));
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    ws.current = sock;
  }, []);

  useEffect(() => {
    connectWs();
    return () => {
      if (ws.current) ws.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWs]);

  // Derive status from timestamp age
  const enrichedEmps = {};
  const now = Date.now() / 1000;
  Object.entries(emps).forEach(([eid, d]) => {
    const age = now - (d.ts || 0);
    let status = 'live';
    if (age > 120) status = 'stale';
    else if (age > 60) status = 'stale';
    enrichedEmps[eid] = { ...d, status };
  });

  const empList = Object.entries(enrichedEmps);
  const cnt = empList.length;

  // Filter for search
  const filteredList = empList.filter(([eid, d]) =>
    d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    eid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleFocusEmployee = (eid) => {
    const emp = enrichedEmps[eid];
    if (emp) {
      setFocusTarget({ lat: emp.lat, lon: emp.lon });
      setShowList(false);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-8rem)]">
      {/* ─── Status Badges (Top Right) ──────────────────────────── */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-3">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border shadow-lg backdrop-blur-md ${
          connected
            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            : 'bg-red-500/15 border-red-500/30 text-red-400'
        }`}>
          {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          {connected ? 'Live' : 'Disconnected'}
        </div>
        <button
          onClick={() => setShowList(!showList)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shadow-lg backdrop-blur-md hover:bg-indigo-500/25 transition-colors cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          {cnt} Active
        </button>
      </div>

      {/* ─── Title Badge (Top Left) ─────────────────────────────── */}
      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/90 border border-slate-700 shadow-xl backdrop-blur-md">
        <Radio className="w-4 h-4 text-brand-400 animate-pulse" />
        <span className="text-sm font-bold text-white">Employee Live Tracker</span>
      </div>

      {/* ─── Employee List Panel ────────────────────────────────── */}
      {showList && (
        <div className="absolute top-16 right-4 z-[1001] w-80 max-h-[60vh] glass-panel rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-fade-in">
          {/* Search Header */}
          <div className="p-3 border-b border-slate-800 bg-slate-900/80">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-brand-400" />
                Tracked Employees ({cnt})
              </h3>
              <button onClick={() => setShowList(false)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Employee List */}
          <div className="overflow-y-auto max-h-[45vh] custom-scrollbar">
            {filteredList.length === 0 ? (
              <div className="p-6 text-center">
                <MapPin className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">
                  {cnt === 0 ? 'No employees are currently sharing their location.' : 'No matching employees found.'}
                </p>
              </div>
            ) : (
              filteredList.map(([eid, d]) => {
                const badge = statusBadge(d.status);
                return (
                  <button
                    key={eid}
                    onClick={() => handleFocusEmployee(eid)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-slate-800/60 transition-colors border-b border-slate-800/50 text-left"
                  >
                    {d.img ? (
                      <img src={d.img} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" onError={(e) => e.target.style.display='none'} />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                        {d.name?.[0] || '?'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{d.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-bold ${badge.color}`}>{badge.label}</span>
                        <span className="text-[10px] text-slate-500">{timeAgo(d.ts)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── Map ───────────────────────────────────────────────── */}
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        className="w-full h-full rounded-2xl overflow-hidden border border-slate-800"
        style={{ background: '#0f172a' }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OSM' />
        <FitBounds emps={enrichedEmps} />
        <FocusOnEmp target={focusTarget} onDone={() => setFocusTarget(null)} />

        {Object.entries(enrichedEmps).map(([eid, d]) => {
          const badge = statusBadge(d.status);
          return (
            <Marker key={eid} position={[d.lat, d.lon]} icon={mkIco(d.img, d.status)}>
              <Popup>
                <div style={{ minWidth: '200px', fontFamily: 'system-ui, sans-serif' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingBottom: '8px', borderBottom: '1px solid #e2e8f0' }}>
                    {d.img && <img src={d.img} style={{ width: '36px', height: '36px', borderRadius: '10px', objectFit: 'cover', border: '2px solid #4169E1' }} alt="" />}
                    <div>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>{d.name}</p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{eid}</p>
                    </div>
                  </div>

                  {/* Status */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '2px 8px', borderRadius: '6px', fontSize: '10px', fontWeight: 700,
                      background: d.status === 'live' ? '#ecfdf5' : '#fffbeb',
                      color: d.status === 'live' ? '#059669' : '#d97706',
                      border: `1px solid ${d.status === 'live' ? '#a7f3d0' : '#fde68a'}`
                    }}>
                      {badge.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{timeAgo(d.ts)}</span>
                  </div>

                  {/* Details */}
                  <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.8' }}>
                    <div><strong>Coordinates:</strong> {d.lat.toFixed(6)}, {d.lon.toFixed(6)}</div>
                    {d.accuracy != null && (
                      <div><strong>Accuracy:</strong> ±{Math.round(d.accuracy)}m</div>
                    )}
                    {d.speed != null && d.speed > 0 && (
                      <div><strong>Speed:</strong> {(d.speed * 3.6).toFixed(1)} km/h</div>
                    )}
                    <div><strong>Last Update:</strong> {new Date(d.ts * 1000).toLocaleTimeString()}</div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* ─── Empty State Overlay ────────────────────────────────── */}
      {connected && cnt === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[999]">
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center max-w-sm pointer-events-auto">
            <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-7 h-7 text-slate-500" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">No Active Locations</h3>
            <p className="text-xs text-slate-400">No employees are currently sharing their live location. Locations will appear on the map automatically when employees grant permission.</p>
          </div>
        </div>
      )}

      {/* ─── Disconnected Overlay ───────────────────────────────── */}
      {!connected && (
        <div className="absolute bottom-4 left-4 z-[1000] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold backdrop-blur-md shadow-lg">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Connection lost. Showing last known locations. Reconnecting...</span>
        </div>
      )}
    </div>
  );
}
