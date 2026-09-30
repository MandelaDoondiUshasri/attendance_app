import React, { useState, useEffect } from 'react';
import {
  Coffee, Play, Pause, Clock, Users, User,
  CheckCircle2, AlertCircle, Sparkles, RefreshCw, Loader2,
  MapPin, ShieldAlert
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

export const LunchBreakControl = ({ onStatusChange, compact = false }) => {
  const { user } = useAuth();
  const { addToast } = useAppState();

  const [breakStatus, setBreakStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [selectedScope, setSelectedScope] = useState('ALL'); // 'ALL' or 'SUPERVISOR_ONLY'
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/maintenance/breaks/status/');
      setBreakStatus(res.data);
      if (onStatusChange) {
        onStatusChange(res.data);
      }
    } catch (err) {
      console.error('Failed to load break status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // Polling every 15s
    return () => clearInterval(interval);
  }, []);

  // Live timer tick when break is active
  const isActive = Boolean(breakStatus?.department_on_break || breakStatus?.supervisor_break?.is_on_break);

  useEffect(() => {
    if (!isActive) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  const getCoordinates = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        (err) => {
          if (err.code === 1) {
            reject(new Error('Location permission denied. CEO policy requires GPS verification to resume from lunch.'));
          } else if (err.code === 2) {
            reject(new Error('GPS location unavailable. Please check your device location services.'));
          } else {
            reject(new Error('GPS location request timed out. Please retry.'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handlePause = async (scope = selectedScope) => {
    setActionLoading(true);
    setGeoError(null);
    try {
      const res = await api.post('/maintenance/breaks/pause/', {
        scope,
        break_type: 'LUNCH',
        notes: 'Department Lunch Break'
      });
      addToast(res.data.message || 'Shift paused for lunch break!', 'success');
      await fetchStatus();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to pause for lunch break.';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (scope = selectedScope) => {
    setActionLoading(true);
    setGeoError(null);
    setAcquiringGps(true);

    let coords = null;
    try {
      coords = await getCoordinates();
    } catch (locErr) {
      console.warn('GPS resume error:', locErr.message);
      setGeoError(locErr.message);
      addToast(locErr.message, 'error');
      setAcquiringGps(false);
      setActionLoading(false);
      return;
    }

    setAcquiringGps(false);

    try {
      const payload = {
        scope,
        latitude: coords.latitude,
        longitude: coords.longitude
      };
      const res = await api.post('/maintenance/breaks/resume/', payload);
      addToast(res.data.message || 'Work resumed from lunch break!', 'success');
      setGeoError(null);
      await fetchStatus();
    } catch (err) {
      const data = err.response?.data;
      if (data?.geofence_blocked) {
        const distMsg = `Outside Worksite: You are ${data.distance_meters}m away from ${data.site_name || 'worksite'}. CEO requires you to return within ${data.allowed_radius_meters}m to resume work.`;
        setGeoError(distMsg);
        addToast(distMsg, 'error');
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
    if (mins < 60) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ${secs.toString().padStart(2, '0')}s`;
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

  // Compact variant for toolbars / tables
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isActive ? (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-semibold text-amber-300">
              🍱 Lunch Break Active ({activeCount} on break)
            </span>
            <button
              onClick={() => handleResume('ALL')}
              disabled={actionLoading}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold transition-all border border-emerald-500/30 disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              Resume All
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePause('ALL')}
              disabled={actionLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600/90 to-orange-600/90 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold transition-all shadow-md shadow-amber-500/10 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              <Coffee className="w-3.5 h-3.5" />
              Pause for Lunch
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border transition-all duration-300 shadow-xl ${
      isActive
        ? 'bg-gradient-to-r from-amber-950/40 via-[#0F172A] to-orange-950/40 border-amber-500/40 shadow-amber-500/10'
        : 'bg-[#0F172A]/90 border-slate-800 hover:border-slate-700/80 shadow-slate-950/50'
    }`}>
      {/* Background glow when active */}
      {isActive && (
        <div className="pointer-events-none absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
      )}

      <div className="relative p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left Side: Status & Timer */}
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
            isActive
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 ring-4 ring-amber-500/10'
              : 'bg-slate-800/80 text-slate-400 border border-slate-700/80'
          }`}>
            {isActive ? (
              <Coffee className="w-6 h-6 animate-bounce" />
            ) : (
              <Coffee className="w-6 h-6" />
            )}
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
              {isActive
                ? 'Maintenance Department Lunch Break'
                : 'Lunch Break & Pause Controller'}
            </h3>

            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              {isActive ? (
                <>
                  Started at <span className="text-slate-200 font-medium">{breakStart}</span> •{' '}
                  <span className="text-amber-300 font-semibold">{activeCount}</span> of {totalStaff} staff currently on break
                  {supervisorOnBreak && <span className="ml-1 text-emerald-400 font-medium">(Supervisor included)</span>}
                </>
              ) : (
                'Supervisor can pause the shift for lunch break collectively for all workers or specifically for self.'
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Scope Selector & Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Scope Selector */}
          <div className="flex bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setSelectedScope('ALL')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                selectedScope === 'ALL'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              All Staff
            </button>
            <button
              type="button"
              onClick={() => setSelectedScope('SUPERVISOR_ONLY')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                selectedScope === 'SUPERVISOR_ONLY'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Self Only
            </button>
          </div>

          {/* Action Trigger */}
          {isActive ? (
            <button
              onClick={() => handleResume(selectedScope)}
              disabled={actionLoading}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {acquiringGps ? 'Acquiring GPS...' : 'Verifying Geofence...'}
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Resume Work {selectedScope === 'ALL' ? '(All)' : '(Self)'}
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => handlePause(selectedScope)}
              disabled={actionLoading}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pausing...
                </>
              ) : (
                <>
                  <Coffee className="w-4 h-4" />
                  Pause for Lunch {selectedScope === 'ALL' ? '(All)' : '(Self)'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Geofence warning banner when resume is blocked outside perimeter */}
      {geoError && (
        <div className="mx-5 mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 animate-shake">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-bold block text-rose-200 mb-0.5">Worksite Perimeter Verification</span>
            {geoError}
          </div>
        </div>
      )}
    </div>
  );
};

export default LunchBreakControl;
