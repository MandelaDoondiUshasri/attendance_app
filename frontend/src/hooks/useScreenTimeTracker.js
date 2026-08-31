import { useEffect, useRef } from 'react';
import api, { API_V1_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';

const IDLE_TIMEOUT_MS = 60000; // 60 seconds without interaction considered idle
const HEARTBEAT_INTERVAL_SEC = 30; // Send heartbeat every 30s of active time

export const useScreenTimeTracker = () => {
  const { user } = useAuth();
  const lastActivityRef = useRef(Date.now());
  const activeSecondsRef = useRef(0);
  const isDocumentVisibleRef = useRef(!document.hidden);

  useEffect(() => {
    // Only track screen time for authenticated employees
    if (!user || user.role !== 'EMPLOYEE') return;

    // 1. User activity listener (debounced update of lastActivity timestamp)
    let activityThrottleTimer = null;
    const handleUserActivity = () => {
      const now = Date.now();
      if (!activityThrottleTimer) {
        lastActivityRef.current = now;
        activityThrottleTimer = setTimeout(() => {
          activityThrottleTimer = null;
        }, 1000);
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach((ev) => {
      window.addEventListener(ev, handleUserActivity, { passive: true });
    });

    // 2. Visibility change listener (tab switch / minimize)
    const handleVisibilityChange = () => {
      isDocumentVisibleRef.current = !document.hidden;
      if (document.hidden) {
        flushHeartbeat();
      } else {
        lastActivityRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 3. Heartbeat sender
    const flushHeartbeat = async () => {
      const secondsToSend = activeSecondsRef.current;
      if (secondsToSend <= 0) return;

      activeSecondsRef.current = 0; // Reset before async call to avoid race conditions

      try {
        await api.post('/tracking/screen-time/heartbeat/', {
          active_seconds: secondsToSend
        });
      } catch (err) {
        // If failed, restore unsent seconds (capped at 120s)
        activeSecondsRef.current = Math.min(120, activeSecondsRef.current + secondsToSend);
      }
    };

    // 4. Per-second active time accumulator
    const ticker = setInterval(() => {
      const now = Date.now();
      const isIdle = now - lastActivityRef.current > IDLE_TIMEOUT_MS;
      const isVisible = isDocumentVisibleRef.current;

      if (!isIdle && isVisible) {
        activeSecondsRef.current += 1;
      }

      // Check if heartbeat threshold reached
      if (activeSecondsRef.current >= HEARTBEAT_INTERVAL_SEC) {
        flushHeartbeat();
      }
    }, 1000);

    // 5. Cleanup on logout / tab close
    const handleBeforeUnload = () => {
      const pendingSeconds = activeSecondsRef.current;
      if (pendingSeconds > 0) {
        const token = localStorage.getItem('access_token');
        if (token && navigator.sendBeacon) {
          const payload = JSON.stringify({ active_seconds: pendingSeconds });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`${API_V1_URL}/tracking/screen-time/heartbeat/`, blob);
        }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(ticker);
      activityEvents.forEach((ev) => window.removeEventListener(ev, handleUserActivity));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushHeartbeat();
    };
  }, [user]);
};

export default useScreenTimeTracker;
