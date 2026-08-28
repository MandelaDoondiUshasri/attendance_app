import React, { useState, useEffect } from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { WifiOff, Wifi, Activity, AlertCircle, CheckCircle2, X, LogIn, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';

const GlobalStateOverlay = () => {
  const { isOffline, isSlowNetwork, sessionExpired, resetSessionExpired, toasts, removeToast, addToast } = useAppState();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [wasOffline, setWasOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (isOffline) {
      setWasOffline(true);
    } else if (wasOffline) {
      addToast('Internet connection restored. Back online!', 'success');
      setWasOffline(false);
    }
  }, [isOffline, wasOffline, addToast]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    if (navigator.onLine) {
      window.location.reload();
    } else {
      setTimeout(() => {
        setIsRetrying(false);
      }, 1000);
    }
  };

  const handleSessionExpiredAction = () => {
    resetSessionExpired();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* 4. NO INTERNET STATE (Persistent Non-Intrusive Offline Banner) */}
      {isOffline && (
        <div 
          role="status" 
          aria-live="assertive"
          className="fixed top-0 left-0 w-full z-[100] bg-gradient-to-r from-rose-600 to-red-600 text-white px-4 py-2 flex items-center justify-between shadow-lg shadow-rose-950/40 text-xs sm:text-sm font-semibold animate-fade-in"
        >
          <div className="flex items-center gap-2.5 mx-auto">
            <WifiOff className="w-4 h-4 shrink-0 animate-pulse" aria-hidden="true" />
            <span><strong>No Internet Connection:</strong> You're currently offline. Check your connection and try again.</span>
          </div>
          <button
            onClick={handleManualRetry}
            disabled={isRetrying}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-all shrink-0 active:scale-95 disabled:opacity-50"
            aria-label="Retry network connection"
          >
            <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isRetrying ? 'Checking...' : 'Retry'}</span>
          </button>
        </div>
      )}

      {/* 5. SLOW NETWORK STATE (Floating Non-Blocking Indicator) */}
      {isSlowNetwork && !isOffline && (
        <div 
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[90] bg-slate-900/95 border border-slate-700/80 p-3 sm:p-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-xs backdrop-blur-md"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-400">
            <Activity className="w-4 h-4 animate-pulse" aria-hidden="true" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Taking a little longer...</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">Your connection seems slow. We're still trying to load this.</p>
          </div>
        </div>
      )}

      {/* 8. SESSION EXPIRED STATE (Security Modal) */}
      <Modal 
        isOpen={sessionExpired} 
        onClose={handleSessionExpiredAction} 
        title="Your session has expired"
      >
        <div className="p-4 sm:p-6 text-center space-y-5" role="alert">
          <div className="mx-auto w-16 h-16 bg-rose-500/10 text-rose-400 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-inner">
            <AlertCircle className="w-8 h-8" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1.5">Session Timeout</h3>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              For your security, please sign in again to continue. Any unsaved form data has been protected where possible.
            </p>
          </div>
          <button 
            onClick={handleSessionExpiredAction}
            className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-brand-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 hover:from-indigo-500 hover:to-brand-500 transition-all text-xs sm:text-sm active:scale-98"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" /> 
            <span>Sign In Again</span>
          </button>
        </div>
      </Modal>

      {/* 10. SUCCESS & 3. ERROR TOAST FEEDBACK SYSTEM */}
      <div 
        aria-live="polite" 
        aria-atomic="false" 
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4"
      >
        {toasts.map(toast => (
          <div 
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl shadow-2xl border ${
              toast.type === 'error' 
                ? 'bg-slate-900/95 border-rose-500/30 text-rose-100 shadow-rose-950/20' 
                : 'bg-slate-900/95 border-emerald-500/30 text-emerald-100 shadow-emerald-950/20'
            } backdrop-blur-md transition-all animate-fade-up`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' ? (
                <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="flex-1 text-xs font-medium text-slate-200 pr-1 leading-snug">
              {toast.message}
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default GlobalStateOverlay;
