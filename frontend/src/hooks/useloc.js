import { useEffect, useRef } from 'react';
import api from '../services/api';
export default function useLoc() {
  const wid = useRef(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    wid.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        api.post('/loc/update/', { lat, lon }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );
    return () => {
      if (wid.current !== null) navigator.geolocation.clearWatch(wid.current);
    };
  }, []);
}
