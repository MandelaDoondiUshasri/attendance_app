import React, { useState } from 'react';
import { useAuth, getMediaUrl } from '../../context/AuthContext';

export const CompanyLogo = ({ size = 'md', className = '', showGlow = false }) => {
  const auth = useAuth() || {};
  const companyLogo = auth.companyLogo || null;
  const companyName = auth.companyName || 'FRG Enterprise';
  const [imageError, setImageError] = useState(false);

  const sizeMap = {
    xs: 'w-6 h-6 text-[10px] rounded-lg',
    sm: 'w-8 h-8 text-xs rounded-xl',
    md: 'w-10 h-10 text-sm rounded-xl',
    lg: 'w-14 h-14 text-lg rounded-2xl',
    xl: 'w-20 h-20 text-2xl rounded-2xl',
    '2xl': 'w-24 h-24 text-3xl rounded-3xl',
  };

  const currentSizeClass = sizeMap[size] || sizeMap.md;
  const logoUrl = typeof getMediaUrl === 'function' ? getMediaUrl(companyLogo) : companyLogo;

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

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {showGlow && (
        <div className="absolute -inset-1.5 bg-gradient-to-r from-brand-600 via-indigo-500 to-cyan-400 rounded-3xl blur-md opacity-40 group-hover:opacity-80 transition duration-700 pointer-events-none" />
      )}

      <div
        className={`relative ${currentSizeClass} flex items-center justify-center overflow-hidden border border-white/15 shadow-xl transition-all duration-300 ${
          logoUrl && !imageError
            ? 'bg-slate-900/90 p-1.5 backdrop-blur-md'
            : 'bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 text-white font-black tracking-wider'
        }`}
      >
        {logoUrl && !imageError ? (
          <img
            src={logoUrl}
            alt={companyName || 'Company Logo'}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain filter drop-shadow-md"
          />
        ) : (
          <span className="font-extrabold uppercase select-none drop-shadow">
            {initials || 'FRG'}
          </span>
        )}
      </div>
    </div>
  );
};

export default CompanyLogo;
