import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const AppStateContext = createContext();

export const AppStateProvider = ({ children }) => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSlowNetwork, setIsSlowNetwork] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [toasts, setToasts] = useState([]);

  // Toast System
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  // Network State
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Custom events from API interceptors
    const handleSlowNetwork = (e) => setIsSlowNetwork(e.detail?.isSlow ?? true);
    const handleSessionExpired = () => setSessionExpired(true);

    window.addEventListener('slow-network', handleSlowNetwork);
    window.addEventListener('session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('slow-network', handleSlowNetwork);
      window.removeEventListener('session-expired', handleSessionExpired);
    };
  }, []);

  const resetSessionExpired = () => setSessionExpired(false);

  return (
    <AppStateContext.Provider value={{
      isOffline,
      isSlowNetwork,
      sessionExpired,
      resetSessionExpired,
      toasts,
      addToast,
      removeToast
    }}>
      {children}
    </AppStateContext.Provider>
  );
};

export const useAppState = () => useContext(AppStateContext);
