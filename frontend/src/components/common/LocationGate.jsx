import React, { useState, useEffect, useCallback } from 'react';
import { MapPin, Shield, RefreshCw, AlertTriangle, Loader2, Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

/**
 * LocationGate — Mandatory full-screen blocking component for employee location access.
 * 
 * CEO/HR/SYSTEM_ADMIN roles bypass the gate (they are viewers, not tracked).
 * EMPLOYEE users must grant location permission before accessing the app.
 * 
 * States: CHECKING → REQUESTING → GRANTED → DENIED → UNAVAILABLE → TIMEOUT → ERROR
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

  // Determine if this user is management (bypasses gate)
  const role = user?.role || 'EMPLOYEE';
  const isManagement = ['CEO', 'SYSTEM_ADMIN', 'HR'].includes(role);

  const [locState, setLocState] = useState(() => isManagement ? STATES.GRANTED : STATES.CHECKING);
  const [errorDetail, setErrorDetail] = useState('');

  const requestLocation = useCallback(() => {
    if (isManagement) return; // No-op for management

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
          case error.PERMISSION_DENIED:
            setLocState(STATES.DENIED);
            setErrorDetail('You have blocked location access in your browser. Please enable it from your browser or device settings.');
            break;
          case error.POSITION_UNAVAILABLE:
            setLocState(STATES.UNAVAILABLE);
            setErrorDetail('Location services are unavailable on your device. Please enable GPS/location services and try again.');
            break;
          case error.TIMEOUT:
            setLocState(STATES.TIMEOUT);
            setErrorDetail('Location request timed out. Please check your GPS signal and try again.');
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

  // Initial permission check (skipped for management)
  useEffect(() => {
    if (isManagement) return;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        if (result.state === 'granted') {
          requestLocation();
        } else if (result.state === 'denied') {
          setLocState(STATES.DENIED);
          setErrorDetail('Location access has been blocked. Please enable it in your browser settings.');
        } else {
          requestLocation();
        }

        result.onchange = () => {
          if (result.state === 'granted') {
            requestLocation();
          } else if (result.state === 'denied') {
            setLocState(STATES.DENIED);
            setErrorDetail('Location access has been blocked. Please enable it in your browser settings.');
          }
        };
      }).catch(() => {
        requestLocation();
      });
    } else {
      requestLocation();
    }
  }, [isManagement, requestLocation]);

  // Re-check on tab visibility change
  useEffect(() => {
    if (isManagement) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && locState !== STATES.GRANTED) {
        requestLocation();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isManagement, locState, requestLocation]);

  // If granted (or management), render children
  if (locState === STATES.GRANTED) {
    return children;
  }

  // Blocking states (only for EMPLOYEE users)
  const isLoading = locState === STATES.CHECKING || locState === STATES.REQUESTING;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-4 select-none">
      <div className="max-w-md w-full space-y-8 text-center animate-fade-in">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24">
          <div className={`w-24 h-24 rounded-3xl flex items-center justify-center border shadow-2xl ${
            isLoading
              ? 'bg-brand-500/15 border-brand-500/30 shadow-brand-500/10'
              : locState === STATES.DENIED
                ? 'bg-rose-500/15 border-rose-500/30 shadow-rose-500/10'
                : 'bg-amber-500/15 border-amber-500/30 shadow-amber-500/10'
          }`}>
            {isLoading ? (
              <Loader2 className="w-10 h-10 text-brand-400 animate-spin" />
            ) : locState === STATES.DENIED ? (
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
             locState === STATES.DENIED ? 'Location Permission Required' :
             locState === STATES.UNAVAILABLE ? 'Location Services Unavailable' :
             locState === STATES.TIMEOUT ? 'Location Request Timed Out' :
             'Location Access Required'}
          </h1>

          <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto">
            {isLoading ? (
              'Please allow location access when prompted by your browser. This is required to use the attendance tracking system.'
            ) : (
              errorDetail || 'Location access is required to continue using this application.'
            )}
          </p>
        </div>

        {/* Info Box */}
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
              Location data is encrypted in transit and accessible only to authorized personnel. Regular employees cannot view other employees' locations.
            </p>
          </div>
        </div>

        {/* Action Button */}
        {!isLoading && (
          <button
            onClick={requestLocation}
            className="w-full px-6 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-brand-500/25 transition-all active:scale-[0.98]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{locState === STATES.DENIED ? 'Try Again' : 'Enable Location'}</span>
          </button>
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
