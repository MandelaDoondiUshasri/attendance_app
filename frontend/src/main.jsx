import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './services/pwaService';

// Register native Service Worker for offline PWA support, background push, and caching
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(reg => {
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('AttendX PWA update available.');
            }
          };
        }
      };
    }).catch(err => {
      console.log('SW registration skipped:', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
