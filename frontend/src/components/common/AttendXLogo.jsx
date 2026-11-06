import React from 'react';

/**
 * Official AttendX Brand Logo Component
 * Available sizes: 'xs' (24px), 'sm' (36px), 'md' (48px), 'lg' (64px), 'xl' (96px), 'full'
 */
export const AttendXLogo = ({
  size = 'md',
  showWordmark = false,
  showGlow = true,
  className = ''
}) => {
  const sizeMap = {
    xs: { box: 'w-6 h-6', img: 24, font: 'text-xs' },
    sm: { box: 'w-9 h-9', img: 36, font: 'text-sm' },
    md: { box: 'w-11 h-11', img: 44, font: 'text-lg' },
    lg: { box: 'w-16 h-16', img: 64, font: 'text-2xl' },
    xl: { box: 'w-24 h-24 sm:w-28 sm:h-28', img: 112, font: 'text-3xl' },
    full: { box: 'w-full max-w-[280px]', img: 200, font: 'text-4xl' },
  };

  const current = sizeMap[size] || sizeMap.md;

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Icon Emblem */}
      <div className={`relative ${current.box} shrink-0 flex items-center justify-center`}>
        {showGlow && (
          <div className="absolute -inset-1.5 bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-500 rounded-2xl blur-md opacity-50 group-hover:opacity-80 transition duration-500 pointer-events-none animate-pulse" />
        )}
        <div className="relative w-full h-full rounded-2xl p-1 bg-slate-900/90 border border-cyan-500/30 backdrop-blur-xl shadow-2xl overflow-hidden flex items-center justify-center">
          <img
            src="/attendx-icon.png"
            alt="AttendX Logo"
            className="w-full h-full object-contain filter drop-shadow-[0_2px_12px_rgba(6,182,212,0.5)]"
            onError={(e) => {
              // Fallback to SVG if PNG fails
              e.currentTarget.src = '/attendx-icon.svg';
            }}
          />
        </div>
      </div>

      {/* Wordmark (Optional) */}
      {showWordmark && (
        <div className="flex flex-col text-left">
          <div className="flex items-center tracking-wider">
            <span className={`font-black text-white ${current.font} tracking-widest`}>
              ATTEND
            </span>
            <span className={`font-black bg-gradient-to-r from-cyan-400 via-sky-400 to-indigo-400 bg-clip-text text-transparent ${current.font} tracking-widest ml-0.5`}>
              X
            </span>
          </div>
          <span className="text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase -mt-0.5">
            Workforce Suite
          </span>
        </div>
      )}
    </div>
  );
};

export default AttendXLogo;
