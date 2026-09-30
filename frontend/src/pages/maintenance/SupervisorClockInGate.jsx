import React, { useState, useEffect } from 'react';
import { Clock, CheckCircle2, ShieldAlert, Sparkles, ArrowRight, Loader2, MapPin, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

/**
 * SupervisorClockInGate
 * Section 6: Mandatory Supervisor Clock-In
 * Shows the mandatory clock-in prompt if the supervisor has not clocked in today.
 */
export const SupervisorClockInGate = ({ isOpen, onClose, onClockedIn, reason = "You have not clocked in today." }) => {
  const { user } = useAuth();
  const { addToast } = useAppState();

  const [loading, setLoading] = useState(false);
  const [clockInSuccess, setClockInSuccess] = useState(false);
  const [successDetails, setSuccessDetails] = useState({
    time: '',
    date: ''
  });

  const [gpsError, setGpsError] = useState(null);
  const [acquiringGps, setAcquiringGps] = useState(false);

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
            reject(new Error('Location permission denied. Please allow location access in your browser settings to verify worksite presence.'));
          } else if (err.code === 2) {
            reject(new Error('GPS location unavailable. Please check your network or GPS sensor.'));
          } else {
            reject(new Error('GPS location request timed out. Please retry.'));
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  const handleClockIn = async () => {
    setLoading(true);
    setGpsError(null);
    setAcquiringGps(true);

    let coords = null;
    try {
      coords = await getCoordinates();
    } catch (locErr) {
      console.warn('GPS acquisition error:', locErr.message);
      setGpsError(locErr.message);
      addToast(locErr.message, 'error');
      setAcquiringGps(false);
      setLoading(false);
      return;
    }

    setAcquiringGps(false);

    try {
      const payload = {
        work_mode: 'OFFICE',
        latitude: coords.latitude,
        longitude: coords.longitude
      };

      const res = await api.post('/attendance/clock-in/', payload);
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

      setSuccessDetails({
        time: timeStr,
        date: dateStr
      });
      setClockInSuccess(true);
      addToast('Clock-in successful!', 'success');
      if (onClockedIn) {
        onClockedIn();
      }
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data?.geofence_blocked) {
        const distMsg = `Outside Worksite: You are ${data.distance_meters}m away from ${data.site_name || 'worksite'}. CEO requires you to be within ${data.allowed_radius_meters}m.`;
        setGpsError(distMsg);
        addToast(distMsg, 'error');
      } else {
        const msg = data?.error || data?.message || 'Failed to clock in. Please retry.';
        setGpsError(msg);
        addToast(msg, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-md bg-[#0F172A] border border-brand-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute -top-24 -left-20 w-48 h-48 bg-brand-500/15 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl" />

        {!clockInSuccess ? (
          <div>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-5 shadow-inner">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 mb-3">
              <ShieldAlert className="w-3.5 h-3.5" />
              MANDATORY SUPERVISOR ATTENDANCE
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              Supervisor Attendance
            </h2>

            <p className="text-sm text-slate-400 mb-5 leading-relaxed">
              {reason} As per enterprise policy, you must first clock in before managing or taking daily maintenance worker attendance.
            </p>

            {gpsError && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-left flex items-start gap-2.5 animate-shake">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">
                  <span className="font-bold block text-rose-200 mb-0.5">Location Verification Required</span>
                  {gpsError}
                </div>
              </div>
            )}

            <button
              onClick={handleClockIn}
              disabled={loading}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-brand-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {acquiringGps ? 'Acquiring GPS Location...' : 'Verifying Worksite Perimeter...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  CLOCK IN NOW
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              SHIFT ACTIVE
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4">
              Clocked In Successfully
            </h2>

            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Time:</span>
                <span className="font-mono font-bold text-emerald-400">{successDetails.time}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-800 pt-2">
                <span className="text-slate-400">Date:</span>
                <span className="font-medium text-slate-200">{successDetails.date}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-t border-slate-800 pt-2">
                <span className="text-slate-400">Department:</span>
                <span className="font-semibold text-cyan-300">Maintenance</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
            >
              GO TO MAINTENANCE DASHBOARD
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupervisorClockInGate;
