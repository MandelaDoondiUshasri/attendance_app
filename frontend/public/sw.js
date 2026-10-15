const CACHE_NAME = 'frg-attendance-v1.3.0';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html'
];

// ─── Lifecycle: Installation & Caching ──────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// ─── Lifecycle: Activation & Cache Pruning ──────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Offline Support & SPA Fetch Interception ───────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  // Bypass caching for dynamic API, WebSocket, Django admin, and media calls
  const url = new URL(request.url);
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/ws/') || 
    url.pathname.startsWith('/admin/') ||
    url.pathname.startsWith('/media/')
  ) {
    return;
  }

  // Network First, Fallback to Cache for SPA offline support
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (request.mode === 'navigate') {
            return caches.match('/index.html') || caches.match('/');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});

// ─── Push Event: Reliable Service Worker Notification Delivery (Section 6) ─
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = {
        title: 'Attendance Notification',
        message: event.data.text() || 'New attendance event received.'
      };
    }
  }

  const title = data.title || 'Attendance Notification';
  const message = data.message || data.body || 'You have an attendance update.';
  
  // Rule: Do NOT suppress distinct legitimate attendance events.
  // Use tag only per unique event_id so distinct events do not overwrite each other.
  const tag = data.event_id ? `attendance-event-${data.event_id}` : (data.tag || undefined);

  const options = {
    body: message,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    tag: tag,
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200],
    data: {
      url: data.url || (data.payload && data.payload.route) || '/attendance',
      notification_id: data.id,
      event_id: data.event_id,
      timestamp: data.created_at || new Date().toISOString()
    }
  };

  const tasks = [];

  // 1. Display notification natively in the device notification tray
  tasks.push(self.registration.showNotification(title, options));

  // 2. Optional Telemetry: report browser display acknowledgement (Section 8)
  if (data.id && self.fetch) {
    tasks.push(
      fetch(`/api/v1/notifications/${data.id}/ack_displayed/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: data.event_id,
          displayed_at: new Date().toISOString()
        }),
        keepalive: true
      }).catch(() => {
        // Safe catch: network/browser offline prevents display ack without failing notification
      })
    );
  }

  event.waitUntil(Promise.all(tasks));
});

// ─── Notification Click Handler (Section 6) ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/attendance';

  // Navigate existing client window or open new window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a tab is already open with the app, focus and navigate it
      for (const client of clientList) {
        if (client.url && client.url.startsWith(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise open a new browser window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
