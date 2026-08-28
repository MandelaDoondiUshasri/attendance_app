import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Shield, RefreshCw, AlertTriangle, Loader2, Eye, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * LocationGate — Mandatory full-screen blocking component for employee location access.
 * 
 * CEO/HR/SYSTEM_ADMIN roles bypass the gate (they are viewers, not tracked).
 * EMPLOYEE users must grant location permission before accessing the app.
 */

const STATES = {
  CHECKING: 'CHECKING',
  REQUESTING: 'REQUESTING',
  GRANTED: 'GRANTED',
  DENIED: 'DENIED',
  UNAVAILABLE: 'UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  ERROR: 'ERROR',
};

const LocationGate = ({ children }) => {
  const { user } = useAuth();
  const role = user?.role || 'EMPLOYEE';
  const isManagement = ['CEO', 'SYSTEM_ADMIN', 'HR'].includes(role);

  const [locState, setLocState] = useState(() => isManagement ? STATES.GRANTED : STATES.CHECKING);
  const [errorDetail, setErrorDetail] = useState('');
  const permResultRef = useRef(null);
  const pollRef = useRef(null);

  const requestLocation = useCallback(() => {
    if (isManagement) return;

    if (!navigator.geolocation) {
      setLocState(STATES.UNAVAILABLE);
      setErrorDetail('Your browser does not support location services.');
      return;
    }

    setLocState(STATES.REQUESTING);
    setErrorDetail('');

    navigator.geolocation.getCurrentPosition(
      (_position) => {
        setLocState(STATES.GRANTED);
      },
      (error) => {
        switch (error.code) {
          case 1: // PERMISSION_DENIED
            setLocState(STATES.DENIED);
            setErrorDetail('Location access has been blocked by your browser.');
            break;
          case 2: // POSITION_UNAVAILABLE
            setLocState(STATES.UNAVAILABLE);
            setErrorDetail('Location services are unavailable. Please enable GPS on your device.');
            break;
          case 3: // TIMEOUT
            setLocState(STATES.TIMEOUT);
            setErrorDetail('Location request timed out. Check your GPS signal and try again.');
            break;
          default:
            setLocState(STATES.ERROR);
            setErrorDetail('An unexpected error occurred while requesting your location.');
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [isManagement]);

  // Initial permission check + listen for permission changes
  useEffect(() => {
    if (isManagement) return;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        permResultRef.current = result;

        if (result.state === 'granted') {
          requestLocation();
        } else if (result.state === 'denied') {
          setLocState(STATES.DENIED);
          setErrorDetail('Location access has been blocked by your browser.');
        } else {
          // 'prompt' — ask for permission
          requestLocation();
        }

        // Auto-detect when user changes permission in browser settings
        result.addEventListener('change', () => {
          if (result.state === 'granted') {
            setLocState(STATES.REQUESTING);
            requestLocation();
          } else if (result.state === 'denied') {
            setLocState(STATES.DENIED);
            setErrorDetail('Location access has been blocked by your browser.');
          }
        });
      }).catch(() => {
        requestLocation();
      });
    } else {
      requestLocation();
    }
  }, [isManagement, requestLocation]);

  // Poll permission state every 3s when denied (fallback for browsers where onchange doesn't fire)
  useEffect(() => {
    if (isManagement || locState === STATES.GRANTED) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    if (locState === STATES.DENIED || locState === STATES.UNAVAILABLE || locState === STATES.TIMEOUT || locState === STATES.ERROR) {
      pollRef.current = setInterval(() => {
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted') {
              setLocState(STATES.REQUESTING);
              requestLocation();
            } else if (result.state === 'prompt') {
              // User reset the permission — we can try again
              setLocState(STATES.REQUESTING);
              requestLocation();
            }
          }).catch(() => {});
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isManagement, locState, requestLocation]);

  // Re-check on tab visibility change
  useEffect(() => {
    if (isManagement) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && locState !== STATES.GRANTED) {
        // Try to check permission state first
        if (navigator.permissions && navigator.permissions.query) {
          navigator.permissions.query({ name: 'geolocation' }).then((result) => {
            if (result.state === 'granted' || result.state === 'prompt') {
              requestLocation();
            }
          }).catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isManagement, locState, requestLocation]);

  // If granted (or management), render children
  if (locState === STATES.GRANTED) {
    return children;
  }

  const isLoading = locState === STATES.CHECKING || locState === STATES.REQUESTING;
  const isDenied = locState === STATES.DENIED;

  // Detect browser for specific instructions
  const isChrome = /chrome/i.test(navigator.userAgent) && !/edg/i.test(navigator.userAgent);
  const isEdge = /edg/i.test(navigator.userAgent);
  const isFirefox = /firefox/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full space-y-6 text-center animate-fade-in">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border shadow-2xl ${
            isLoading
              ? 'bg-brand-500/15 border-brand-500/30 shadow-brand-500/10'
              : isDenied
                ? 'bg-rose-500/15 border-rose-500/30 shadow-rose-500/10'
                : 'bg-amber-500/15 border-amber-500/30 shadow-amber-500/10'
          }`}>
            {isLoading ? (
              <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            ) : isDenied ? (
              <Shield className="w-10 h-10 text-rose-400" />
            ) : (
              <AlertTriangle className="w-10 h-10 text-amber-400" />
            )}
          </div>
          {isLoading && (
            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-brand-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {isLoading ? 'Requesting Location Access' : 
             isDenied ? 'Location Permission Required' :
             locState === STATES.UNAVAILABLE ? 'Location Services Unavailable' :
             locState === STATES.TIMEOUT ? 'Location Request Timed Out' :
             'Location Access Required'}
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            {isLoading
              ? 'Please allow location access when prompted by your browser. This is required to use the attendance system.'
              : isDenied
                ? 'Your browser has blocked location access. Follow the steps below to enable it — this page will automatically detect the change.'
                : (errorDetail || 'Location access is required to continue using this application.')}
          </p>
        </div>

        {/* Browser-Specific Instructions (only shown when DENIED) */}
        {isDenied && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-3">
            <p className="text-xs font-bold text-white mb-2">How to enable location:</p>
            
            {isChrome && (
              <ol className="text-xs text-slate-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>Click the <strong className="text-white">🔒 lock icon</strong> (or ⓘ) in the address bar</li>
                <li>Find <strong className="text-white">Location</strong> and change it to <strong className="text-emerald-400">Allow</strong></li>
                <li>The page will automatically reload</li>
              </ol>
            )}

            {isEdge && (
              <ol className="text-xs text-slate-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>Click the <strong className="text-white">🔒 lock icon</strong> in the address bar</li>
                <li>Click <strong className="text-white">Permissions for this site</strong></li>
                <li>Set <strong className="text-white">Location</strong> to <strong className="text-emerald-400">Allow</strong></li>
                <li>The page will automatically detect the change</li>
              </ol>
            )}

            {isFirefox && (
              <ol className="text-xs text-slate-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>Click the <strong className="text-white">🔒 lock icon</strong> in the address bar</li>
                <li>Click <strong className="text-white">Clear This Permission</strong> next to Location</li>
                <li>Refresh the page to be prompted again</li>
              </ol>
            )}

            {isSafari && (
              <ol className="text-xs text-slate-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>Go to <strong className="text-white">Safari → Settings → Websites → Location</strong></li>
                <li>Find this site and change to <strong className="text-emerald-400">Allow</strong></li>
                <li>Refresh the page</li>
              </ol>
            )}

            {!isChrome && !isEdge && !isFirefox && !isSafari && (
              <ol className="text-xs text-slate-300 leading-relaxed space-y-1.5 list-decimal list-inside">
                <li>Open your browser's <strong className="text-white">site settings</strong></li>
                <li>Find <strong className="text-white">Location</strong> and change it to <strong className="text-emerald-400">Allow</strong></li>
                <li>Refresh the page</li>
              </ol>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-800 mt-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[11px] text-emerald-400 font-medium">Listening for permission changes...</p>
            </div>
          </div>
        )}

        {/* Privacy Info Box (shown when not denied) */}
        {!isDenied && !isLoading && (
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-left space-y-3">
            <div className="flex items-start gap-3">
              <Eye className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">
                Your live location is shared with authorized management and HR while the tracking system is active. Only your current position is recorded — no location history is stored.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-300 leading-relaxed">
                Location data is encrypted in transit and accessible only to authorized personnel.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isLoading && (
          <div className="space-y-3">
            {!isDenied && (
              <button
                onClick={requestLocation}
                className="w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-brand-500/25 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Enable Location</span>
              </button>
            )}

            {isDenied && (
              <button
                onClick={() => window.location.reload()}
                className="w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-brand-500/25 transition-all active:scale-[0.98]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Page After Enabling</span>
              </button>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
            <span>Waiting for browser permission...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationGate;
