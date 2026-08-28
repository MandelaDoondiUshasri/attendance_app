import { useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

// Client-side haversine distance calculation (meters)
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Configurable thresholds
const MIN_DISTANCE_M = 20;       // Client-side pre-filter: skip updates < 20m
const MIN_SEND_INTERVAL_MS = 30000; // Minimum 30s between API calls
const HEARTBEAT_INTERVAL_MS = 60000; // Force-send heartbeat every 60s even if stationary

/**
 * useLoc — Enhanced location tracking hook.
 * 
 * Watches the employee's GPS position, applies client-side distance filtering,
 * throttles API requests, sends accuracy/speed/heading data, and handles
 * cleanup (stop endpoint) on unmount.
 */
export default function useLoc() {
  const watchId = useRef(null);
  const lastSent = useRef({ lat: 0, lon: 0, ts: 0 });
  const latestPos = useRef(null);
  const heartbeatTimer = useRef(null);
  const isMounted = useRef(true);

  const sendLocation = useCallback((lat, lon, accuracy, speed, heading) => {
    const now = Date.now();
    const timeSinceLast = now - lastSent.current.ts;
    const dist = lastSent.current.ts > 0
      ? haversine(lastSent.current.lat, lastSent.current.lon, lat, lon)
      : Infinity;

    // Skip if too recent AND insignificant movement
    if (timeSinceLast < MIN_SEND_INTERVAL_MS && dist < MIN_DISTANCE_M) {
      return;
    }

    lastSent.current = { lat, lon, ts: now };

    const payload = { lat, lon };
    if (accuracy != null && isFinite(accuracy)) payload.accuracy = accuracy;
    if (speed != null && isFinite(speed) && speed >= 0) payload.speed = speed;
    if (heading != null && isFinite(heading)) payload.heading = heading;

    api.post('/loc/update/', payload).catch(() => {});
  }, []);

  const sendHeartbeat = useCallback(() => {
    const pos = latestPos.current;
    if (pos) {
      // Force-send current position as heartbeat (bypasses distance filter)
      const now = Date.now();
      lastSent.current = { lat: pos.lat, lon: pos.lon, ts: now };
      const payload = { lat: pos.lat, lon: pos.lon };
      if (pos.accuracy != null) payload.accuracy = pos.accuracy;
      api.post('/loc/update/', payload).catch(() => {});
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;

    if (!navigator.geolocation) return;

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isMounted.current) return;
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        latestPos.current = { lat: latitude, lon: longitude, accuracy, speed, heading };
        sendLocation(latitude, longitude, accuracy, speed, heading);
      },
      (error) => {
        // Location errors are handled by LocationGate; hook just logs
        console.warn('Location watch error:', error.message);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    // Heartbeat: send position periodically even if stationary
    heartbeatTimer.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // Cleanup: stop tracking and notify backend
    return () => {
      isMounted.current = false;
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
      // Notify backend that employee stopped tracking
      api.post('/loc/stop/').catch(() => {});
    };
  }, [sendLocation, sendHeartbeat]);
}
