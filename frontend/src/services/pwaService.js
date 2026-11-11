/**
 * ATTENDX Progressive Web App (PWA) Management Service
 * Provides native installation prompts, standalone detection, iOS Safari instructions,
 * and user choice persistence according to enterprise UX requirements.
 */

class PWAService {
  constructor() {
    this.deferredPrompt = null;
    this.listeners = new Set();
    this.installed = this.checkIfInstalled();

    if (typeof window !== 'undefined') {
      // 1. Capture native beforeinstallprompt event for Chromium / Android / Desktop Chrome / Edge
      window.addEventListener('beforeinstallprompt', (e) => {
        // Prevent default browser mini-infobar from appearing automatically
        e.preventDefault();
        this.deferredPrompt = e;
        this.notifyListeners();
      });

      // 2. Capture appinstalled event when native install successfully finishes
      window.addEventListener('appinstalled', () => {
        this.markInstalled();
        this.deferredPrompt = null;
        this.notifyListeners();
      });

      // 3. Listen to display-mode media query changes (e.g. user opens as standalone)
      try {
        const mediaQuery = window.matchMedia('(display-mode: standalone)');
        mediaQuery.addEventListener?.('change', (e) => {
          if (e.matches) {
            this.markInstalled();
            this.notifyListeners();
          }
        });
      } catch (err) {
        // Ignore legacy mediaQuery error
      }
    }
  }

  // Subscribe to install availability changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach((callback) => {
      try {
        callback(state);
      } catch (err) {
        console.error('PWA listener error:', err);
      }
    });
  }

  // Detect iOS Safari / iPadOS devices
  isIOS() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const isIOSDevice = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return isIOSDevice;
  }

  // Detect whether current browser is iOS Safari
  isIOSSafari() {
    if (!this.isIOS()) return false;
    const ua = navigator.userAgent || '';
    // Safari on iOS does not contain 'CriOS', 'FxiOS', 'EdgiOS'
    return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  }

  // Detect standalone / already installed mode
  checkIfInstalled() {
    if (typeof window === 'undefined') return false;

    // Check display-mode media query
    const isStandaloneDisplay = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    // Check iOS legacy standalone flag
    const isIOSStandalone = window.navigator && window.navigator.standalone === true;
    // Check document referrer (Android TWA or standalone launcher)
    const isAndroidReferrer = document.referrer && document.referrer.includes('android-app://');
    // Check persisted localStorage flag
    const isMarkedInstalled = localStorage.getItem('attendx_pwa_installed') === 'true';

    return Boolean(isStandaloneDisplay || isIOSStandalone || isAndroidReferrer || isMarkedInstalled);
  }

  isInstalled() {
    return this.checkIfInstalled();
  }

  markInstalled() {
    this.installed = true;
    try {
      localStorage.setItem('attendx_pwa_installed', 'true');
      localStorage.removeItem('attendx_pwa_dismissed');
    } catch (e) {
      // Storage unavailable fallback
    }
  }

  // User dismissal management
  isDismissed() {
    try {
      return localStorage.getItem('attendx_pwa_dismissed') === 'true';
    } catch (e) {
      return false;
    }
  }

  dismissPrompt() {
    try {
      localStorage.setItem('attendx_pwa_dismissed', 'true');
    } catch (e) {
      // Storage unavailable fallback
    }
  }

  resetDismissal() {
    try {
      localStorage.removeItem('attendx_pwa_dismissed');
    } catch (e) {
      // Storage unavailable fallback
    }
  }

  // Post-login trigger flags
  flagPostLoginPrompt() {
    try {
      sessionStorage.setItem('attendx_post_login_prompt', 'true');
    } catch (e) {
      // Storage fallback
    }
  }

  consumePostLoginPrompt() {
    try {
      const val = sessionStorage.getItem('attendx_post_login_prompt');
      sessionStorage.removeItem('attendx_post_login_prompt');
      return val === 'true';
    } catch (e) {
      return false;
    }
  }

  canPromptNative() {
    return Boolean(this.deferredPrompt);
  }

  // Trigger native prompt or guide
  async promptInstall() {
    const prompt = this.deferredPrompt;
    if (prompt) {
      try {
        await prompt.prompt();
        const choiceResult = await prompt.userChoice;
        if (choiceResult && choiceResult.outcome === 'accepted') {
          this.markInstalled();
          this.deferredPrompt = null;
          this.notifyListeners();
          return { success: true, outcome: 'accepted' };
        }
        this.deferredPrompt = null;
        this.notifyListeners();
        return { success: false, outcome: 'dismissed' };
      } catch (err) {
        console.error('Error triggering PWA native prompt:', err);
        return { success: false, error: err };
      }
    }

    return { success: false, outcome: 'unsupported' };
  }

  getState() {
    return {
      isInstalled: this.isInstalled(),
      isDismissed: this.isDismissed(),
      canPromptNative: this.canPromptNative(),
      isIOS: this.isIOS(),
      isIOSSafari: this.isIOSSafari()
    };
  }
}

export const pwaService = new PWAService();
export default pwaService;
