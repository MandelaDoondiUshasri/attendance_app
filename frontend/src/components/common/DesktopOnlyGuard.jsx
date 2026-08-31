import React, { useState, useEffect } from 'react';
import { Monitor, Laptop, ShieldAlert, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import CompanyLogo from './CompanyLogo';

export const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;

  // 1. User Agent Regex Check
  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const mobileUARegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile|CriOS/i;
  const isMobileUA = mobileUARegex.test(ua);

  // 2. iPad / Tablet touch detection (e.g. iPadOS masquerading as macOS Safari)
  const isIPadOS = navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(ua);

  // 3. Viewport width check (e.g., screen < 1024px)
  const isNarrowScreen = window.innerWidth < 1024;

  return isMobileUA || isIPadOS || (isNarrowScreen && 'ontouchstart' in window);
};

export const DesktopOnlyGuard = ({ children }) => {
  const { companyName } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkDevice = () => {
      setIsMobile(isMobileDevice());
      setChecking(false);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (checking) {
    return null;
  }

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#090d16] text-white flex items-center justify-center p-6 select-none overflow-y-auto">
        {/* Background ambient lighting */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-md w-full glass-panel bg-slate-900/90 border border-white/10 rounded-3xl p-8 text-center shadow-2xl backdrop-blur-2xl space-y-6">
          {/* Logo & Device Icon Badge */}
          <div className="flex flex-col items-center gap-3">
            <CompanyLogo size="lg" showGlow={true} />
            <div className="relative inline-flex mt-1">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-white/10 shadow-lg">
                <Laptop className="w-7 h-7 text-brand-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 p-1 bg-rose-500 rounded-full border-2 border-slate-900 shadow-md">
                <Smartphone className="w-3.5 h-3.5 text-white line-through" />
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <ShieldAlert className="w-3.5 h-3.5" /> Desktop Access Only
            </span>
          </div>

          {/* Headings & Message */}
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white tracking-tight">
              Desktop Device Required
            </h1>
            <p className="text-sm font-medium text-slate-300 leading-relaxed">
              This application is available only on desktop devices. Please access it using a desktop or laptop.
            </p>
          </div>

          {/* Details callout */}
          <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-left space-y-2">
            <p className="text-xs text-slate-400 font-medium leading-normal">
              Mobile and tablet access is restricted to ensure secure attendance tracking and optimal workstation performance.
            </p>
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Platform:</span>
              <span className="text-brand-400 font-mono font-bold">Authorized PC / Mac Only</span>
            </div>
          </div>

          {/* Footer Note */}
          <p className="text-[11px] text-slate-500 font-mono">
            {companyName || 'FRG Enterprise'} Attendance & Management Portal
          </p>
        </div>
      </div>
    );
  }

  return children;
};

export default DesktopOnlyGuard;
