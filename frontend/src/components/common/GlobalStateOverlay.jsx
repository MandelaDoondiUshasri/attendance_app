import React from 'react';
import { useAppState } from '../../context/AppStateContext';
import { useAuth } from '../../context/AuthContext';
import { WifiOff, Activity, AlertCircle, CheckCircle, X, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';

const GlobalStateOverlay = () => {
  const { isOffline, isSlowNetwork, sessionExpired, resetSessionExpired, toasts, removeToast } = useAppState();
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleSessionExpiredAction = () => {
    resetSessionExpired();
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      {/* NO INTERNET STATE */}
      {isOffline && (
        <div className="fixed top-0 left-0 w-full z-[100] bg-rose-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm font-semibold shadow-lg shadow-rose-500/20 slide-down">
          <WifiOff className="w-4 h-4" />
          <span>You're currently offline. Check your connection and try again.</span>
        </div>
      )}

      {/* SLOW NETWORK STATE */}
      {isSlowNetwork && !isOffline && (
        <div className="fixed bottom-6 right-6 z-[90] bg-slate-900 border border-slate-700 p-3 sm:p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fade-in max-w-sm">
          <Activity className="w-5 h-5 text-amber-500 animate-pulse" />
          <div>
            <h4 className="text-sm font-bold text-white">Taking a little longer...</h4>
            <p className="text-xs text-slate-400 mt-0.5">Your connection seems slow. We're still trying to load this.</p>
          </div>
        </div>
      )}

      {/* SESSION EXPIRED STATE */}
      <Modal 
        isOpen={sessionExpired} 
        onClose={handleSessionExpiredAction} 
        title="Your session has expired"
      >
        <div className="p-4 sm:p-6 text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center border border-rose-500/20 mb-2">
            <AlertCircle className="w-8 h-8" />
          </div>
          <p className="text-slate-300 text-sm">For your security, please sign in again to continue. Any unsaved changes may be lost.</p>
          <button 
            onClick={handleSessionExpiredAction}
            className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 text-white font-bold rounded-xl shadow-lg hover:from-brand-500 hover:to-indigo-500 transition-all"
          >
            <LogIn className="w-4 h-4" /> Sign In Again
          </button>
        </div>
      </Modal>

      {/* TOAST SYSTEM (SUCCESS/ERROR STATES) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map(toast => (
          <div 
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3 rounded-xl shadow-xl border ${
              toast.type === 'error' 
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-100' 
                : 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100'
            } backdrop-blur-md transition-all animate-fade-up`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : (
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div className="flex-1 text-sm font-medium pr-2">
              {toast.message}
            </div>
            <button 
              onClick={() => removeToast(toast.id)}
              className={`shrink-0 p-1 rounded-md opacity-70 hover:opacity-100 ${
                toast.type === 'error' ? 'hover:bg-rose-500/20' : 'hover:bg-emerald-500/20'
              } transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </>
  );
};

export default GlobalStateOverlay;
