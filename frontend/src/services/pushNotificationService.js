import api from './api';

// Helper to convert base64 url-safe string to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const pushNotificationService = {
  isSupported() {
    return (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    );
  },

  getPermission() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  },

  async registerServiceWorker() {
    if (!this.isSupported()) return null;
    try {
      return await navigator.serviceWorker.register('/sw.js');
    } catch (err) {
      console.error('Service Worker registration failed:', err);
      return null;
    }
  },

  async getExistingSubscription() {
    if (!this.isSupported()) return null;
    try {
      const reg = await navigator.serviceWorker.ready;
      return await reg.pushManager.getSubscription();
    } catch (e) {
      console.warn('Could not retrieve existing push subscription:', e);
      return null;
    }
  },

  async subscribe(deviceName = '') {
    if (!this.isSupported()) {
      return { success: false, reason: 'unsupported' };
    }

    try {
      // 1. Request user permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return { success: false, reason: permission };
      }

      // 2. Ensure Service Worker is ready
      await this.registerServiceWorker();
      const reg = await navigator.serviceWorker.ready;

      // 3. Fetch VAPID public key from backend
      const { data } = await api.get('/notifications/vapid_public_key/');
      const vapidPublicKey = data.public_key;

      if (!vapidPublicKey) {
        throw new Error('Server did not return a valid VAPID public key.');
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      // 4. Subscribe with the browser's PushManager
      // Cleanly rotate any previous subscription to avoid key mismatch errors
      try {
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          await existingSub.unsubscribe();
        }
      } catch (subErr) {
        console.warn('Could not reset previous push subscription:', subErr);
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const subJson = subscription.toJSON();

      // 5. Register subscription with Django backend (supports multi-device)
      const payload = {
        endpoint: subJson.endpoint,
        keys: {
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth
        },
        device_name: deviceName || navigator.userAgent.slice(0, 60),
        user_agent: navigator.userAgent
      };

      await api.post('/notifications/subscribe/', payload);

      return { success: true, subscription };
    } catch (error) {
      console.error('Push notification subscription failed:', error);
      return { success: false, error: error.message || 'Subscription failed' };
    }
  },

  async unsubscribe() {
    if (!this.isSupported()) return { success: false };

    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await api.post('/notifications/unsubscribe/', { endpoint }).catch(() => {});
      }

      return { success: true };
    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return { success: false, error: error.message };
    }
  }
};

export default pushNotificationService;
