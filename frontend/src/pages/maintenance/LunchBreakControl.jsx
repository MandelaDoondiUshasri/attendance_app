import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Coffee, Play, Clock, Users, User,
  Loader2, MapPin, ShieldAlert,
  Navigation, Wifi, WifiOff, Target, AlertTriangle, RefreshCw
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

// ─── Haversine distance (metres) ────────────────────────────────────────────────
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Mobile GPS drift tolerance buffer (civilian phone GPS has standard 10-25m jitter)
const GPS_ACCURACY_TOLERANCE = 15;

// ─── Live Proximity Ring ────────────────────────────────────────────────────────
const ProximityRing = ({ distanceMeters, radiusMeters, gpsReady, onRefresh, refreshing }) => {
  if (!gpsReady) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-[11px]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
        <span>Acquiring GPS signal...</span>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="ml-2 inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            Retry
          </button>
        )}
      </div>
    );
  }

  const effectiveRadius = (radiusMeters || 100) + GPS_ACCURACY_TOLERANCE;
  const isInside = distanceMeters <= effectiveRadius;
  const fillPct = Math.max(0, Math.min(100, Math.round(
    (1 - (distanceMeters / (effectiveRadius * 1.5))) * 100
  )));

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 shrink-0">
        <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
          <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
          <circle
            cx="20" cy="20" r="16" fill="none"
            stroke={isInside ? '#10b981' : '#f59e0b'}
            strokeWidth="4"
            strokeDasharray={`${fillPct} 100`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {isInside
            ? <Target className="w-3.5 h-3.5 text-emerald-400" />
            : <Navigation className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-bold ${isInside ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isInside ? '✓ Inside Worksite' : `${Math.round(distanceMeters)}m away`}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh your live GPS location"
              className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white font-medium px-2 py-0.5 rounded-md bg-slate-800/80 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${refreshing ? 'animate-spin text-cyan-400' : 'text-slate-400'}`} />
              Re-check GPS
            </button>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          Perimeter: <span className="text-slate-300 font-mono">{radiusMeters}m</span>
          <span className="text-slate-600 ml-1">(±{GPS_ACCURACY_TOLERANCE}m GPS buffer)</span>
        </div>
      </div>
    </div>
  );
};

export const LunchBreakControl = ({ onStatusChange, compact = false }) => {
  const { user } = useAuth();
  const { addToast } = useAppState();

  const [breakStatus, setBreakStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [gpsRefreshing, setGpsRefreshing] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [selectedScope, setSelectedScope] = useState('ALL');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Geofence config fetched from backend
  const [geofence, setGeofence] = useState(null);

  // Live GPS state
  const [userPosition, setUserPosition] = useState(null);
  const [gpsReady, setGpsReady] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const watchIdRef = useRef(null);

  // Derived: real-time distance from worksite
  const distanceMeters = userPosition && geofence
    ? haversineDistance(
        userPosition.latitude, userPosition.longitude,
        geofence.latitude, geofence.longitude
      )
    : null;

  const effectiveRadius = (geofence?.radius_meters || 100) + GPS_ACCURACY_TOLERANCE;
  const isInsideGeofence = geofence && distanceMeters !== null
    ? distanceMeters <= effectiveRadius
    : true;

  const geofenceActive = Boolean(geofence?.is_active);
  const isSupervisor = user?.role === 'SUPERVISOR';

  // Block buttons when supervisor is outside and GPS has a fix
  const geofenceBlocking = isSupervisor && geofenceActive && gpsReady && !isInsideGeofence;
  const gpsWaiting = isSupervisor && geofenceActive && !gpsReady;

  // ── Fetch geofence config ──────────────────────────────────────────────────────
  const fetchGeofence = useCallback(async () => {
    try {
      const res = await api.get('/maintenance/geofence/');
      setGeofence(res.data);
    } catch {
      setGeofence(null);
    }
  }, []);

  // ── Fetch break status ─────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await api.get('/maintenance/breaks/status/');
      setBreakStatus(res.data);
      if (onStatusChange) onStatusChange(res.data);
    } catch (err) {
      console.error('Failed to load break status:', err);
    } finally {
      setLoading(false);
    }
  }, [onStatusChange]);

  // ── Dedicated Live Location Refresh (Fresh GPS with zero cache) ───────────────
  const refreshLocation = useCallback((showToastNotice = false) => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }
    setGpsRefreshing(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fresh = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10
        };
        setUserPosition(fresh);
        setGpsReady(true);
        setGpsError(null);
        setGeoError(null);
        setGpsRefreshing(false);

        if (geofence) {
          const dist = haversineDistance(
            fresh.latitude, fresh.longitude,
            geofence.latitude, geofence.longitude
          );
          const effRad = (geofence.radius_meters || 100) + GPS_ACCURACY_TOLERANCE;
          if (dist <= effRad) {
            if (showToastNotice) {
              addToast(`GPS Updated: Inside worksite perimeter (${Math.round(dist)}m)`, 'success');
            }
          } else {
            if (showToastNotice) {
              addToast(`GPS Updated: ${Math.round(dist)}m from worksite`, 'info');
            }
          }
        }
      },
      (err) => {
        setGpsRefreshing(false);
        const msgs = {
          1: 'Location permission denied. Please allow GPS access in settings.',
          2: 'GPS signal unavailable. Please ensure location services are ON.',
          3: 'GPS request timed out. Retrying...'
        };
        if (showToastNotice) {
          addToast(msgs[err.code] || 'Could not acquire fresh GPS position.', 'error');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [geofence, addToast]);

  // ── Continuous GPS watchPosition ──────────────────────────────────────────────
  const startGPSWatch = useCallback(() => {
    if (!navigator.geolocation || watchIdRef.current !== null) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 10
        });
        setGpsReady(true);
        setGpsError(null);
      },
      (err) => {
        const msgs = {
          1: 'Location permission denied. Allow GPS to use geofence-controlled breaks.',
          2: 'GPS signal unavailable. Check device location services.',
          3: 'GPS request timed out. Retrying...'
        };
        setGpsError(msgs[err.code] || 'GPS error. Please retry.');
        setGpsReady(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  }, []);

  const stopGPSWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // ── Init & Auto-polling ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchGeofence();
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchGeofence, fetchStatus]);

  useEffect(() => {
    if (isSupervisor && geofence?.is_active) {
      startGPSWatch();
      refreshLocation(false);

      // Periodic fresh GPS check every 8 seconds to detect entering worksite
      const gpsInterval = setInterval(() => {
        refreshLocation(false);
      }, 8000);

      const handleFocus = () => refreshLocation(false);
      window.addEventListener('focus', handleFocus);

      return () => {
        stopGPSWatch();
        clearInterval(gpsInterval);
        window.removeEventListener('focus', handleFocus);
      };
    }
    return () => stopGPSWatch();
  }, [isSupervisor, geofence?.is_active, startGPSWatch, stopGPSWatch, refreshLocation]);

  // ── Live timer when break is active ───────────────────────────────────────────
  const isActive = Boolean(
    breakStatus?.department_on_break || breakStatus?.supervisor_break?.is_on_break
  );
  useEffect(() => {
    if (!isActive) { setElapsedSeconds(0); return; }
    const timer = setInterval(() => setElapsedSeconds((p) => p + 1), 1000);
    return () => clearInterval(timer);
  }, [isActive]);

  // ── Force Fresh Coords for API Call ───────────────────────────────────────────
  const getCoords = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        if (userPosition) return resolve(userPosition);
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const fresh = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy || 10
          };
          setUserPosition(fresh);
          setGpsReady(true);
          setGeoError(null);
          resolve(fresh);
        },
        (err) => {
          // If fresh read times out, fallback to userPosition if recent
          if (userPosition) {
            resolve(userPosition);
          } else {
            const msgs = {
              1: 'Location permission denied. GPS is required for worksite verification.',
              2: 'GPS location unavailable. Check device location services.',
              3: 'GPS request timed out. Please retry.'
            };
            reject(new Error(msgs[err.code] || 'GPS error.'));
          }
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  };

  // ── PAUSE ─────────────────────────────────────────────────────────────────────
  const handlePause = async (scope = selectedScope) => {
    setActionLoading(true);
    setGeoError(null);
    let coords = null;
    if (isSupervisor && geofenceActive) {
      setAcquiringGps(true);
      try {
        coords = await getCoords();
      } catch (locErr) {
        setGeoError(locErr.message);
        addToast(locErr.message, 'error');
        setAcquiringGps(false);
        setActionLoading(false);
        return;
      }
      setAcquiringGps(false);

      // Verify client-side distance with tolerance
      if (coords && geofence) {
        const d = haversineDistance(coords.latitude, coords.longitude, geofence.latitude, geofence.longitude);
        const effRad = (geofence.radius_meters || 100) + GPS_ACCURACY_TOLERANCE;
        if (d > effRad) {
          const msg = `Outside Worksite: You are ${Math.round(d)}m from ${geofence.site_name || 'worksite'}. Move within ${geofence.radius_meters}m.`;
          setGeoError(msg);
          addToast(msg, 'error');
          setActionLoading(false);
          return;
        }
      }
    }
    try {
      const payload = {
        scope,
        break_type: 'LUNCH',
        notes: 'Department Lunch Break'
      };
      if (coords) {
        payload.latitude = coords.latitude;
        payload.longitude = coords.longitude;
        payload.accuracy = coords.accuracy || 10;
      }
      const res = await api.post('/maintenance/breaks/pause/', payload);
      addToast(res.data.message || 'Shift paused for lunch break!', 'success');
      setGeoError(null);
      await fetchStatus();
    } catch (err) {
      const data = err.response?.data;
      if (data?.geofence_blocked) {
        const msg = `Outside Worksite: You are ${data.distance_meters}m from ${data.site_name || 'worksite'}. Move within ${data.allowed_radius_meters}m.`;
        setGeoError(msg);
        addToast(msg, 'error');
      } else {
        const msg = data?.error || 'Failed to pause for lunch break.';
        setGeoError(msg);
        addToast(msg, 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  // ── RESUME ────────────────────────────────────────────────────────────────────
  const handleResume = async (scope = selectedScope) => {
    setActionLoading(true);
    setGeoError(null);
    setAcquiringGps(true);
    let coords = null;
    try {
      coords = await getCoords();
    } catch (locErr) {
      setGeoError(locErr.message);
      addToast(locErr.message, 'error');
      setAcquiringGps(false);
      setActionLoading(false);
      return;
    }
    setAcquiringGps(false);

    // Verify client-side distance with tolerance
    if (coords && geofence && geofenceActive) {
      const d = haversineDistance(coords.latitude, coords.longitude, geofence.latitude, geofence.longitude);
      const effRad = (geofence.radius_meters || 100) + GPS_ACCURACY_TOLERANCE;
      if (d > effRad) {
        const msg = `Outside Worksite: You are ${Math.round(d)}m from ${geofence.site_name || 'worksite'}. Return within ${geofence.radius_meters}m.`;
        setGeoError(msg);
        addToast(msg, 'error');
        setActionLoading(false);
        return;
      }
    }

    try {
      const payload = {
        scope,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy || 10
      };
      const res = await api.post('/maintenance/breaks/resume/', payload);
      addToast(res.data.message || 'Work resumed from lunch break!', 'success');
      setGeoError(null);
      await fetchStatus();
    } catch (err) {
      const data = err.response?.data;
      if (data?.geofence_blocked) {
        const msg = `Outside Worksite: You are ${data.distance_meters}m from ${data.site_name || 'worksite'}. Return within ${data.allowed_radius_meters}m.`;
        setGeoError(msg);
        addToast(msg, 'error');
      } else {
        const msg = data?.error || 'Failed to resume work.';
        setGeoError(msg);
        addToast(msg, 'error');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const formatElapsed = (totalMins = 0) => {
    const mins = totalMins + Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    if (mins < 60) return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ${secs.toString().padStart(2, '0')}s`;
  };

  if (loading && !breakStatus) {
    return (
      <div className="bg-[#0F172A]/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-center gap-3 text-slate-400 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
        Checking Lunch Break status...
      </div>
    );
  }

  const supervisorOnBreak = Boolean(breakStatus?.supervisor_break?.is_on_break);
  const activeCount = breakStatus?.active_breaks_count || 0;
  const totalStaff = breakStatus?.total_workforce || 0;
  const breakStart = breakStatus?.supervisor_break?.start_time || 'Just now';
  const durationMins = breakStatus?.supervisor_break?.duration_minutes || 0;

  // When outside, clicking the button attempts an instant fresh GPS check instead of dead-end disable
  const pauseDisabled = actionLoading || gpsWaiting;
  const resumeDisabled = actionLoading || gpsWaiting;

  const pauseTitle = geofenceBlocking
    ? `You are ${Math.round(distanceMeters)}m from ${geofence?.site_name || 'worksite'}. Tap to re-check GPS.`
    : gpsWaiting ? 'Acquiring GPS signal...' : 'Pause shift for lunch break';

  const resumeTitle = geofenceBlocking
    ? `You are ${Math.round(distanceMeters)}m from ${geofence?.site_name || 'worksite'}. Tap to re-check GPS.`
    : gpsWaiting ? 'Acquiring GPS signal...' : 'Resume work from lunch break';

  // ─── Compact variant ───────────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {isActive ? (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-xs font-semibold text-amber-300">
              🍱 Lunch Break Active ({activeCount} on break)
            </span>
            <button
              onClick={() => handleResume('ALL')}
              disabled={resumeDisabled}
              title={resumeTitle}
              className="ml-1 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-all border border-emerald-500/30 disabled:opacity-40"
            >
              {actionLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : geofenceBlocking
                ? <><Navigation className="w-3 h-3 text-amber-400 animate-pulse" />Re-check GPS</>
                : <><Play className="w-3 h-3 fill-current" />Resume All</>
              }
            </button>
          </div>
        ) : (
          <button
            onClick={() => handlePause('ALL')}
            disabled={pauseDisabled}
            title={pauseTitle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-600/90 to-orange-600/90 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/10 active:scale-[0.98] disabled:opacity-40"
          >
            {geofenceBlocking
              ? <><Navigation className="w-3.5 h-3.5 text-amber-300 animate-pulse" />Re-check ({Math.round(distanceMeters)}m)</>
              : gpsWaiting
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Getting GPS...</>
              : <><Coffee className="w-3.5 h-3.5" />Pause for Lunch</>
            }
          </button>
        )}
      </div>
    );
  }

  // ─── Full variant (Mobile-optimized) ──────────────────────────────────────────
  return (
    <div className={`relative overflow-hidden rounded-3xl border transition-all duration-300 shadow-xl ${
      isActive
        ? 'bg-gradient-to-r from-amber-950/40 via-[#0F172A] to-orange-950/40 border-amber-500/40 shadow-amber-500/10'
        : 'bg-[#0F172A]/90 border-slate-800 hover:border-slate-700/80 shadow-slate-950/50'
    }`}>
      {isActive && (
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
      )}

      <div className="relative p-4 sm:p-6">
        {/* ── Header ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-5">
          {/* Left: status + timer */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
              isActive
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 ring-4 ring-amber-500/10'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/80'
            }`}>
              {isActive ? <Coffee className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" /> : <Coffee className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {isActive ? 'PAUSED FOR LUNCH' : 'SHIFT ACTIVE'}
                </span>
                {isActive && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400 font-mono font-medium">
                    <Clock className="w-3.5 h-3.5" />
                    {formatElapsed(durationMins)}
                  </span>
                )}
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isActive ? 'Maintenance Department Lunch Break' : 'Lunch Break & Pause Controller'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {isActive ? (
                  <>
                    Started at <span className="text-slate-200 font-medium">{breakStart}</span> •{' '}
                    <span className="text-amber-300 font-semibold">{activeCount}</span> of {totalStaff} staff currently on break
                    {supervisorOnBreak && <span className="ml-1 text-emerald-400 font-medium">(Supervisor included)</span>}
                  </>
                ) : (
                  'Supervisor can pause the shift for lunch collectively for all workers or only for self.'
                )}
              </p>
            </div>
          </div>

          {/* Right: scope + action button (Stacks cleanly on mobile) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
            {/* Scope selector */}
            <div className="grid grid-cols-2 sm:flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedScope('ALL')}
                className={`px-3 py-2 sm:py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  selectedScope === 'ALL' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" /> All Staff
              </button>
              <button
                type="button"
                onClick={() => setSelectedScope('SUPERVISOR_ONLY')}
                className={`px-3 py-2 sm:py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  selectedScope === 'SUPERVISOR_ONLY' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" /> Self Only
              </button>
            </div>

            {/* Action button (Full width on mobile, min 44px tap target) */}
            {isActive ? (
              <button
                onClick={() => handleResume(selectedScope)}
                disabled={resumeDisabled}
                title={resumeTitle}
                className="w-full sm:w-auto py-3 sm:py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {actionLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{acquiringGps ? 'Acquiring GPS...' : 'Verifying...'}</>
                ) : geofenceBlocking ? (
                  <><Navigation className="w-4 h-4 animate-pulse text-amber-300" />{Math.round(distanceMeters)}m — Re-check & Resume</>
                ) : gpsWaiting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Acquiring GPS...</>
                ) : (
                  <><Play className="w-4 h-4 fill-current" /> Resume Work {selectedScope === 'ALL' ? '(All)' : '(Self)'}</>
                )}
              </button>
            ) : (
              <button
                onClick={() => handlePause(selectedScope)}
                disabled={pauseDisabled}
                title={pauseTitle}
                className="w-full sm:w-auto py-3 sm:py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {actionLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />{acquiringGps ? 'Acquiring GPS...' : 'Pausing...'}</>
                ) : geofenceBlocking ? (
                  <><Navigation className="w-4 h-4 animate-pulse text-amber-300" />{Math.round(distanceMeters)}m — Re-check & Pause</>
                ) : gpsWaiting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Acquiring GPS...</>
                ) : (
                  <><Coffee className="w-4 h-4" />Pause for Lunch {selectedScope === 'ALL' ? '(All)' : '(Self)'}</>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ── Live Geofence Status Bar (supervisor only) ── */}
        {isSupervisor && geofenceActive && (
          <div className={`mt-4 pt-4 border-t ${geofenceBlocking ? 'border-amber-500/20' : 'border-slate-800'} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
            <ProximityRing
              distanceMeters={distanceMeters}
              radiusMeters={geofence?.radius_meters}
              gpsReady={gpsReady}
              onRefresh={() => refreshLocation(true)}
              refreshing={gpsRefreshing}
            />
            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="text-slate-300 font-medium">{geofence?.site_name || 'Maintenance Worksite'}</span>
              {gpsReady
                ? <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><Wifi className="w-3 h-3" /> GPS Connected</span>
                : <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 animate-pulse"><WifiOff className="w-3 h-3" /> Acquiring Fix...</span>
              }
            </div>
          </div>
        )}

        {/* GPS hardware error */}
        {gpsError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block text-rose-200 mb-0.5">GPS Sensor Required</span>
              {gpsError}
            </div>
            <button
              onClick={() => refreshLocation(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold shrink-0"
            >
              Retry GPS
            </button>
          </div>
        )}

        {/* Server-side geofence error after action attempt */}
        {geoError && (
          <div className="mt-3 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">
              <span className="font-bold block text-rose-200 mb-0.5">Worksite Perimeter Verification</span>
              {geoError}
            </div>
            <button
              onClick={() => refreshLocation(true)}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-xs font-semibold shrink-0"
            >
              Re-check Location
            </button>
          </div>
        )}

        {/* Live distance blocking hint — shown proactively when outside */}
        {isSupervisor && geofenceActive && gpsReady && geofenceBlocking && !geoError && (
          <div className="mt-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Navigation className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <div className="text-xs">
                <span className="font-bold text-amber-200 block mb-0.5">
                  Currently <span className="font-mono text-amber-300">{Math.round(distanceMeters)}m</span> from worksite
                </span>
                <span className="text-amber-400/80">
                  Walk within the <span className="font-mono text-amber-300">{geofence.radius_meters}m</span> perimeter of <em>{geofence.site_name}</em>.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => refreshLocation(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs font-bold border border-amber-500/30 shrink-0 flex items-center gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${gpsRefreshing ? 'animate-spin' : ''}`} />
              Update Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LunchBreakControl;
