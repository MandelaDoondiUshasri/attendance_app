import React, { useState } from 'react';
import { useAuth, getMediaUrl } from '../../context/AuthContext';
import AttendXLogo from './AttendXLogo';

export const CompanyLogo = ({
  size = 'md',
  className = '',
  showGlow = false,
  variant = 'auto' // 'auto' | 'clean' | 'badge' | 'circle'
}) => {
  const auth = useAuth() || {};
  const companyLogo = auth.companyLogo || null;
  const companyName = auth.user?.company_name || auth.companyName || 'ATTENDX';
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

  // If company is the platform itself or default, show the official AttendX logo emblem
  const isDefaultPlatform = !companyLogo && (!companyName || ['ATTENDX', 'ATTEND X', 'FRG ENTERPRISE', 'ENTERPRISE'].includes(companyName.trim().toUpperCase()));

  if (isDefaultPlatform) {
    return <AttendXLogo size={size === 'login' ? 'xl' : size} showGlow={showGlow} className={className} />;
  }

  // If a valid custom uploaded company logo exists, render it
  if (hasValidImage) {
    if (size === 'login') {
      return (
        <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
          {showGlow && (
            <div className="absolute -inset-4 bg-gradient-to-tr from-cyan-500/30 via-indigo-500/20 to-purple-500/30 rounded-full blur-2xl opacity-60 pointer-events-none animate-pulse" />
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
          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 rounded-2xl blur opacity-40 pointer-events-none" />
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

  // Fallback monogram badge for custom tenant companies without an uploaded logo (e.g. "FCP")
  const initials = typeof companyName === 'string' && companyName.trim()
    ? companyName
        .split(' ')
        .filter(Boolean)
        .map((w) => w[0])
        .join('')
        .slice(0, 3)
        .toUpperCase()
    : 'AX';

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {showGlow && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-500 rounded-3xl blur-md opacity-40 group-hover:opacity-80 transition duration-700 pointer-events-none" />
      )}

      <div
        className={`relative ${currentSizeClass} flex items-center justify-center overflow-hidden border border-white/15 shadow-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 text-white font-black tracking-wider transition-all duration-300`}
      >
        <span className="font-extrabold uppercase select-none drop-shadow">
          {initials || 'AX'}
        </span>
      </div>
    </div>
  );
};

export default CompanyLogo;
