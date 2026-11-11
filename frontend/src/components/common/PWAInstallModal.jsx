import React, { useState, useEffect } from 'react';
import { X, Smartphone, Download, Share2, PlusSquare, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import pwaService from '../../services/pwaService';

export const PWAInstallModal = ({ isOpen, onClose, onInstalled }) => {
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);
  const [canNativePrompt, setCanNativePrompt] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const ios = pwaService.isIOS();
    setIsIOS(ios);
    setCanNativePrompt(pwaService.canPromptNative());

    // If it's iOS, default to showing instructions when user clicks Add to Home Screen
    // or provide the guidance view
    if (ios) {
      setShowIOSGuide(false);
    }

    const unsubscribe = pwaService.subscribe((state) => {
      setCanNativePrompt(state.canPromptNative);
      if (state.isInstalled) {
        setInstalledSuccess(true);
        setTimeout(() => {
          onInstalled?.();
          onClose?.();
        }, 1500);
      }
    });

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddToHomeScreen = async () => {
    if (isIOS) {
      // Safari on iOS does not support beforeinstallprompt; show native iOS instructions
      setShowIOSGuide(true);
      return;
    }

    setInstalling(true);
    try {
      if (pwaService.canPromptNative()) {
        const result = await pwaService.promptInstall();
        if (result.success || result.outcome === 'accepted') {
          setInstalledSuccess(true);
          setTimeout(() => {
            onInstalled?.();
            onClose?.();
          }, 1400);
        } else {
          // User dismissed the browser prompt
          onClose?.();
        }
      } else {
        // Fallback for browsers without beforeinstallprompt or desktop
        setShowIOSGuide(true);
      }
    } catch (err) {
      console.warn('Install error:', err);
    } finally {
      setInstalling(false);
    }
  };

  const handleMaybeLater = () => {
    pwaService.dismissPrompt();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-md glass-panel-elevated bg-slate-900/95 border border-white/10 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-2xl overflow-hidden my-auto">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-brand-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={handleMaybeLater}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-10 cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Installed Success State */}
        {installedSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white">App Installed Successfully!</h3>
            <p className="text-sm text-slate-300">
              AttendX is now on your home screen. Enjoy the seamless, app-like experience!
            </p>
          </div>
        ) : showIOSGuide ? (
          /* iOS Safari / Browser Manual Instructions */
          <div className="space-y-5 text-left py-2">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-brand-600/20 border border-brand-500/30 flex items-center justify-center mb-2">
                <Smartphone className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">
                {isIOS ? 'Install on iPhone / iPad' : 'Add AttendX to Home Screen'}
              </h3>
              <p className="text-xs text-slate-400">
                Follow these simple steps in your browser:
              </p>
            </div>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-brand-500/20 text-brand-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-500/30">
                  1
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                  {isIOS ? (
                    <>
                      Tap the <strong className="text-white inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5 text-brand-400 inline" /> Share</strong> icon in the Safari toolbar (at the bottom or top).
                    </>
                  ) : (
                    <>
                      Open your browser menu or look for the <strong className="text-white">Install</strong> icon in the address bar.
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-brand-500/20 text-brand-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-500/30">
                  2
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                  Scroll down the menu and select <strong className="text-white inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5 text-brand-400 inline" /> "Add to Home Screen"</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-brand-500/20 text-brand-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 border border-brand-500/30">
                  3
                </div>
                <div className="text-xs text-slate-200 leading-relaxed">
                  Tap <strong className="text-emerald-400">"Add"</strong> in the top-right corner to finish.
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleMaybeLater}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/25 transition-all cursor-pointer"
              >
                Got It, Thanks!
              </button>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full py-2.5 text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                Back to prompt
              </button>
            </div>
          </div>
        ) : (
          /* Main Installation Prompt */
          <div className="space-y-6">
            {/* App Icon with Glow */}
            <div className="relative inline-flex mx-auto mt-2">
              <div className="w-20 h-20 rounded-2xl bg-slate-800/80 p-2.5 border border-white/10 shadow-2xl flex items-center justify-center">
                <img
                  src="/attendx-icon-192.png"
                  alt="AttendX"
                  className="w-full h-full object-contain rounded-xl drop-shadow-md"
                  onError={(e) => {
                    // Fallback to favicon if icon image is not ready
                    e.target.onerror = null;
                    e.target.src = '/favicon.svg';
                  }}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1.5 bg-brand-600 rounded-full border-2 border-slate-900 shadow-md">
                <Download className="w-4 h-4 text-white" />
              </div>
            </div>

            {/* Prompt Heading and Description - Strict user requirement */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-[10px] font-semibold text-brand-300 uppercase tracking-widest">
                <Sparkles className="w-3 h-3 text-brand-400" />
                <span>Progressive Web App</span>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">
                Install Our App
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal px-2">
                Get faster access to your account. Add our app to your home screen and enjoy an app-like experience.
              </p>
            </div>

            {/* App Highlights */}
            <div className="grid grid-cols-3 gap-2 py-1 text-center">
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs font-bold text-white">⚡ Instant</div>
                <div className="text-[10px] text-slate-400">Fast Launch</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs font-bold text-white">🔔 Alerts</div>
                <div className="text-[10px] text-slate-400">Push Updates</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
                <div className="text-xs font-bold text-white">📱 Standalone</div>
                <div className="text-[10px] text-slate-400">Full Screen</div>
              </div>
            </div>

            {/* Buttons: Add to Home Screen & Maybe Later */}
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleAddToHomeScreen}
                disabled={installing}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {installing ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Preparing Installation...</span>
                  </div>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Add to Home Screen</span>
                    <ArrowRight className="w-4 h-4 opacity-75 ml-1" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleMaybeLater}
                className="w-full py-3 px-4 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-xl border border-white/5 transition-all cursor-pointer"
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstallModal;
