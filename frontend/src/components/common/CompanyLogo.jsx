import React, { useState } from 'react';
import { useAuth, getMediaUrl } from '../../context/AuthContext';

export const CompanyLogo = ({
  size = 'md',
  className = '',
  showGlow = false,
  variant = 'auto' // 'auto' | 'clean' | 'badge' | 'circle'
}) => {
  const auth = useAuth() || {};
  const companyLogo = auth.companyLogo || null;
  const companyName = auth.companyName || 'FRG Enterprise';
  const [imageError, setImageError] = useState(false);

  const sizeDimensions = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-9 h-9 text-xs rounded-xl',
    md: 'w-11 h-11 text-sm rounded-xl',
    lg: 'w-16 h-16 text-xl rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-2xl',
    '2xl': 'w-24 h-24 text-3xl rounded-3xl',
    login: 'w-24 h-24 sm:w-28 sm:h-28 text-3xl rounded-2xl',
  };

  const currentSizeClass = sizeDimensions[size] || sizeDimensions.md;
  const logoUrl = typeof getMediaUrl === 'function' ? getMediaUrl(companyLogo) : companyLogo;
  const hasValidImage = Boolean(logoUrl && !imageError);

  // Compute initials fallback (e.g. "FRG" or "FR")
  const initials = typeof companyName === 'string' && companyName.trim()
    ? companyName
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    : 'FRG';

  if (hasValidImage) {
    if (size === 'login') {
      return (
        <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
          {showGlow && (
            <div className="absolute -inset-4 bg-gradient-to-tr from-brand-600/30 via-amber-500/20 to-indigo-500/30 rounded-full blur-2xl opacity-60 pointer-events-none animate-pulse" />
          )}

          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center p-2 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300 hover:scale-105">
            <img
              src={logoUrl}
              alt={companyName || 'Company Logo'}
              onError={() => setImageError(true)}
              className="w-full h-full object-contain filter drop-shadow-xl"
            />
          </div>
        </div>
      );
    }

    return (
      <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
        {showGlow && (
          <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 via-indigo-500 to-cyan-400 rounded-2xl blur opacity-40 pointer-events-none" />
        )}
        <div className={`relative ${currentSizeClass} flex items-center justify-center p-1 rounded-xl bg-slate-900/70 border border-white/10 backdrop-blur-md shadow-lg overflow-hidden transition-all duration-300`}>
          <img
            src={logoUrl}
            alt={companyName || 'Company Logo'}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain filter drop-shadow-sm"
          />
        </div>
      </div>
    );
  }

  // Fallback monogram badge if no logo image is uploaded
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {showGlow && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-600 via-indigo-500 to-cyan-400 rounded-3xl blur-md opacity-40 group-hover:opacity-80 transition duration-700 pointer-events-none" />
      )}

      <div
        className={`relative ${currentSizeClass} flex items-center justify-center overflow-hidden border border-white/15 shadow-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 text-white font-black tracking-wider transition-all duration-300`}
      >
        <span className="font-extrabold uppercase select-none drop-shadow">
          {initials || 'FRG'}
        </span>
      </div>
    </div>
  );
};

export default CompanyLogo;
