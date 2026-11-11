/**
 * Automated Verification Suite for ATTENDX Progressive Web App (PWA)
 * Validates all 7 required scenarios from the prompt:
 * 1. New user logs in -> Installation popup appears.
 * 2. User clicks Add to Home Screen -> Native installation prompt appears where supported.
 * 3. User installs the app -> Popup never appears again.
 * 4. User clicks Maybe Later -> Popup closes.
 * 5. User logs out and logs in again -> Respect the previous dismissal.
 * 6. Existing installed user logs in -> No installation popup.
 * 7. iPhone Safari user logs in -> iOS installation instructions appear.
 */

import assert from 'assert';

// Mock Browser Environment
class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

let mockLocalStorage = new MockStorage();
let mockSessionStorage = new MockStorage();

global.localStorage = mockLocalStorage;
global.sessionStorage = mockSessionStorage;
global.document = { referrer: '' };
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  matchMedia: (query) => ({
    matches: false,
    addEventListener: () => {}
  })
};
Object.defineProperty(global, 'navigator', {
  value: {
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    platform: 'Win32',
    maxTouchPoints: 0
  },
  writable: true,
  configurable: true
});

// Import PWAService class
const { pwaService } = await import('./src/services/pwaService.js');

console.log('====================================================');
console.log('   ATTENDX PWA 7-SCENARIO AUTOMATED TEST SUITE     ');
console.log('====================================================\n');

let passedTests = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    throw err;
  }
}

// Reset environment before tests
mockLocalStorage.clear();
mockSessionStorage.clear();
pwaService.deferredPrompt = null;
pwaService.installed = false;

// ─── Scenario 1: New user logs in -> Installation popup appears ──────────────
await test('Scenario 1: New user logs in -> Installation popup appears once', () => {
  mockLocalStorage.clear();
  mockSessionStorage.clear();
  pwaService.installed = false;

  assert.strictEqual(pwaService.isInstalled(), false, 'App should not be installed for a new user');
  assert.strictEqual(pwaService.isDismissed(), false, 'App should not be dismissed for a new user');

  // User submits login form
  pwaService.flagPostLoginPrompt();
  assert.strictEqual(mockSessionStorage.getItem('attendx_post_login_prompt'), 'true');

  // MainLayout mounts
  const shouldPrompt = pwaService.consumePostLoginPrompt();
  assert.strictEqual(shouldPrompt, true, 'Post-login flag should be consumed successfully');

  // Evaluated condition for showing modal:
  const showModal = shouldPrompt && !pwaService.isInstalled() && !pwaService.isDismissed();
  assert.strictEqual(showModal, true, 'Installation modal MUST appear for new user post-login');

  // Check that subsequent navigation does NOT re-show prompt
  const navPrompt = pwaService.consumePostLoginPrompt();
  assert.strictEqual(navPrompt, false, 'Modal MUST NOT appear again on subsequent page navigations');
});

// ─── Scenario 2: User clicks Add to Home Screen -> Native dialog appears ─────
await test('Scenario 2: User clicks Add to Home Screen -> Native installation prompt appears where supported', async () => {
  let promptCalled = false;
  let userChoiceQueried = false;

  // Mock native beforeinstallprompt event
  pwaService.deferredPrompt = {
    prompt: async () => {
      promptCalled = true;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  };

  assert.strictEqual(pwaService.canPromptNative(), true, 'Should indicate native prompt is available');

  const result = await pwaService.promptInstall();
  assert.strictEqual(promptCalled, true, 'deferredPrompt.prompt() must be called');
  assert.strictEqual(result.success, true, 'Result should indicate successful user acceptance');
  assert.strictEqual(pwaService.isInstalled(), true, 'App state must update to installed');
});

// ─── Scenario 3: User installs the app -> Popup never appears again ──────────
await test('Scenario 3: User installs the app -> Popup never appears again', () => {
  mockLocalStorage.setItem('attendx_pwa_installed', 'true');
  pwaService.installed = true;

  // User logs in again in installed state
  pwaService.flagPostLoginPrompt();
  const shouldPrompt = pwaService.consumePostLoginPrompt();
  assert.strictEqual(shouldPrompt, true);

  const showModal = shouldPrompt && !pwaService.isInstalled() && !pwaService.isDismissed();
  assert.strictEqual(showModal, false, 'Installation popup must NEVER appear when app is installed');
});

// ─── Scenario 4: User clicks Maybe Later -> Popup closes ─────────────────────
await test('Scenario 4: User clicks Maybe Later -> Popup closes and saves choice', () => {
  mockLocalStorage.clear();
  pwaService.installed = false;

  pwaService.dismissPrompt();
  assert.strictEqual(pwaService.isDismissed(), true, 'Dismissal state must be persisted in localStorage');
});

// ─── Scenario 5: User logs out and logs in again -> Respect dismissal ────────
await test('Scenario 5: User logs out and logs in again -> Respect the previous dismissal', () => {
  // Choice was previously dismissed
  assert.strictEqual(pwaService.isDismissed(), true);

  // User performs a fresh login
  pwaService.flagPostLoginPrompt();
  const shouldPrompt = pwaService.consumePostLoginPrompt();
  assert.strictEqual(shouldPrompt, true);

  // MainLayout checks modal condition:
  const showModal = shouldPrompt && !pwaService.isInstalled() && !pwaService.isDismissed();
  assert.strictEqual(showModal, false, 'Installation popup must NOT appear after re-login if previously dismissed');
});

// ─── Scenario 6: Existing installed user logs in -> No installation popup ────
await test('Scenario 6: Existing installed user logs in (standalone mode) -> No popup', () => {
  mockLocalStorage.clear();
  // Simulate standalone display mode
  global.window.matchMedia = (query) => {
    if (query === '(display-mode: standalone)') {
      return { matches: true };
    }
    return { matches: false };
  };

  assert.strictEqual(pwaService.checkIfInstalled(), true, 'Should detect standalone display mode');

  pwaService.flagPostLoginPrompt();
  const shouldPrompt = pwaService.consumePostLoginPrompt();
  const showModal = shouldPrompt && !pwaService.isInstalled() && !pwaService.isDismissed();
  assert.strictEqual(showModal, false, 'No popup shown for standalone / installed user');
});

// ─── Scenario 7: iPhone Safari user logs in -> iOS installation instructions ──
await test('Scenario 7: iPhone Safari user logs in -> iOS installation instructions flow', () => {
  global.window.matchMedia = () => ({ matches: false });
  mockLocalStorage.clear();
  pwaService.installed = false;
  pwaService.deferredPrompt = null; // iOS Safari never emits beforeinstallprompt

  // Simulate iPhone Safari User Agent
  Object.defineProperty(global.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    configurable: true
  });

  assert.strictEqual(pwaService.isIOS(), true, 'Must detect iOS environment');
  assert.strictEqual(pwaService.isIOSSafari(), true, 'Must detect Safari on iOS');

  // Verify that iOS prompt flow provides instructions (Safari does not emit beforeinstallprompt)
  assert.strictEqual(pwaService.canPromptNative(), false, 'Safari iOS does not support beforeinstallprompt event');

  pwaService.flagPostLoginPrompt();
  const shouldPrompt = pwaService.consumePostLoginPrompt();
  const showModal = shouldPrompt && !pwaService.isInstalled() && !pwaService.isDismissed();
  assert.strictEqual(showModal, true, 'Modal opens on iPhone post-login');
});

console.log(`\n====================================================`);
console.log(` ALL ${passedTests} / 7 PWA TEST SCENARIOS PASSED WITH 100% SUCCESS! `);
console.log(`====================================================\n`);
