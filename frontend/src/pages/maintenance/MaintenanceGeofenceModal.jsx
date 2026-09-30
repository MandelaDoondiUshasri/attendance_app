import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin, Shield, CheckCircle2, AlertCircle, Save,
  X, RefreshCw, Crosshair, Sliders, Info, Loader2, Power
} from 'lucide-react';
import api from '../../services/api';
import { useAppState } from '../../context/AppStateContext';

// Custom Pin Icon for Leaflet
const createPinIcon = () => {
  return L.divIcon({
    className: '',
    iconSize: [44, 52],
    iconAnchor: [22, 50],
    popupAnchor: [0, -45],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
        <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg, #06b6d4, #3b82f6);border:3px solid #ffffff;box-shadow:0 4px 15px rgba(6,182,212,0.6);display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:16px;">
          📍
        </div>
        <div style="width:4px;height:10px;background:#06b6d4;border-radius:2px;"></div>
      </div>
    `
  });
};

// Map click listener to reposition the pin
const MapClickHandler = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    }
  });
  return null;
};

// Map recentering controller
const MapRecenter = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center]);
  return null;
};

export const MaintenanceGeofenceModal = ({ isOpen, onClose, onSaved }) => {
  const { addToast } = useAppState();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geofence, setGeofence] = useState({
    site_name: 'Maintenance Central Worksite',
    latitude: 17.385044,
    longitude: 78.486671,
    radius_meters: 100,
    is_active: true,
    updated_at: null,
    updated_by: null
  });

  const fetchGeofence = async () => {
    setLoading(true);
    try {
      const res = await api.get('/maintenance/geofence/');
      if (res.data) {
        setGeofence({
          site_name: res.data.site_name || 'Maintenance Central Worksite',
          latitude: parseFloat(res.data.latitude) || 17.385044,
          longitude: parseFloat(res.data.longitude) || 78.486671,
          radius_meters: parseInt(res.data.radius_meters, 10) || 100,
          is_active: res.data.is_active !== false,
          updated_at: res.data.updated_at,
          updated_by: res.data.updated_by
        });
      }
    } catch (err) {
      console.error('Failed to load geofence:', err);
      addToast('Could not load current geofence setting.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGeofence();
    }
  }, [isOpen]);

  const handleMapLocationChange = (lat, lng) => {
    setGeofence(prev => ({
      ...prev,
      latitude: parseFloat(lat.toFixed(6)),
      longitude: parseFloat(lng.toFixed(6))
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      addToast('Geolocation is not supported by your browser.', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        handleMapLocationChange(latitude, longitude);
        addToast('Acquired your current GPS location!', 'success');
      },
      (err) => {
        console.error(err);
        addToast('Unable to retrieve current location. Please check browser permissions.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.post('/maintenance/geofence/', {
        site_name: geofence.site_name,
        latitude: geofence.latitude,
        longitude: geofence.longitude,
        radius_meters: geofence.radius_meters,
        is_active: geofence.is_active
      });

      addToast('Maintenance geofence updated successfully!', 'success');
      if (onSaved) onSaved(res.data);
      if (onClose) onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save geofence settings.';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentCenter = [geofence.latitude, geofence.longitude];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0F172A] border border-cyan-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/[0.08] bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-inner">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-0.5">
                CEO EXCLUSIVE CONTROL
              </div>
              <h3 className="text-lg font-black text-white tracking-tight">
                Maintenance Worksite Geofence & Radius
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-semibold">Loading worksite coordinates...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 flex-1">
              {/* Map Preview (7 cols) */}
              <div className="lg:col-span-7 h-[320px] lg:h-auto min-h-[320px] relative border-b lg:border-b-0 lg:border-r border-white/[0.08]">
                <MapContainer
                  center={currentCenter}
                  zoom={16}
                  style={{ height: '100%', width: '100%', minHeight: '320px' }}
                  className="z-0"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />
                  <MapClickHandler onLocationSelect={handleMapLocationChange} />
                  <MapRecenter center={currentCenter} />

                  {/* Worksite Center Marker */}
                  <Marker
                    position={currentCenter}
                    icon={createPinIcon()}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const m = e.target;
                        const pos = m.getLatLng();
                        handleMapLocationChange(pos.lat, pos.lng);
                      }
                    }}
                  />

                  {/* Dynamic Allowed Radius Circle */}
                  {geofence.is_active && (
                    <Circle
                      center={currentCenter}
                      radius={geofence.radius_meters}
                      pathOptions={{
                        color: '#06b6d4',
                        fillColor: '#06b6d4',
                        fillOpacity: 0.18,
                        weight: 2,
                        dashArray: '4, 4'
                      }}
                    />
                  )}
                </MapContainer>

                {/* Map Overlay Badge */}
                <div className="absolute top-3 left-3 z-[400] bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/[0.1] text-[11px] text-slate-300 shadow-lg pointer-events-none flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  Click or drag pin to adjust worksite center
                </div>

                <div className="absolute bottom-3 right-3 z-[400]">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 text-xs font-bold shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    Use My Location
                  </button>
                </div>
              </div>

              {/* Controls Column (5 cols) */}
              <div className="lg:col-span-5 p-5 space-y-4 bg-slate-900/40">
                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <div>
                    <span className="text-xs font-bold text-white block">Geofence Enforcement</span>
                    <span className="text-[11px] text-slate-400 block">
                      Enforce boundary on login & lunch resume
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGeofence(prev => ({ ...prev, is_active: !prev.is_active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      geofence.is_active ? 'bg-cyan-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        geofence.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Worksite Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Worksite Name / Label
                  </label>
                  <input
                    type="text"
                    value={geofence.site_name}
                    onChange={e => setGeofence(prev => ({ ...prev, site_name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-500 font-medium"
                    placeholder="e.g. Maintenance Plant 1"
                    required
                  />
                </div>

                {/* Radius Slider */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                      Allowed Radius (Meters)
                    </label>
                    <span className="text-xs font-mono font-black text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      {geofence.radius_meters}m
                    </span>
                  </div>

                  <input
                    type="range"
                    min="15"
                    max="1500"
                    step="5"
                    value={geofence.radius_meters}
                    onChange={e => setGeofence(prev => ({ ...prev, radius_meters: parseInt(e.target.value, 10) }))}
                    className="w-full accent-cyan-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
                  />

                  {/* Quick Radius Presets */}
                  <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[50, 100, 250, 500].map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setGeofence(prev => ({ ...prev, radius_meters: r }))}
                        className={`py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          geofence.radius_meters === r
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-white/[0.02] text-slate-400 hover:text-white border-white/[0.06]'
                        }`}
                      >
                        {r}m
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coordinates Readout */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={geofence.latitude}
                      onChange={e => setGeofence(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase font-semibold">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={geofence.longitude}
                      onChange={e => setGeofence(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono text-[11px]"
                    />
                  </div>
                </div>

                {/* Audit Information */}
                {geofence.updated_at && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-white/[0.04] text-[11px] text-slate-400 space-y-0.5">
                    <p>Last updated: <span className="text-slate-200">{new Date(geofence.updated_at).toLocaleString()}</span></p>
                    {geofence.updated_by && <p>Updated by: <span className="text-cyan-400">{geofence.updated_by}</span></p>}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/[0.08] bg-slate-900/60">
              <span className="text-xs text-slate-400 hidden sm:inline">
                Applies dynamically to all Maintenance Department clock-ins & lunch resumes.
              </span>

              <div className="flex items-center gap-2.5 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving Geofence...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Location & Radius
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default MaintenanceGeofenceModal;
