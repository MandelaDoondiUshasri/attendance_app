import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const SuccessState = ({ 
  title = 'Action Completed Successfully', 
  message = 'Your request has been processed and saved.', 
  action,
  compact = false 
}) => {
  return (
    <div 
      role="status"
      aria-live="polite"
      className={`text-center w-full mx-auto animate-fade-in ${
        compact 
          ? 'p-4 rounded-xl glass-card border-emerald-500/20 bg-emerald-950/20 flex items-center justify-between gap-3 text-left' 
          : 'p-6 sm:p-8 rounded-2xl glass-panel border-emerald-500/20 bg-emerald-950/10 max-w-md my-6 flex flex-col items-center justify-center'
      }`}
    >
      <div className={`${compact ? 'w-9 h-9' : 'w-14 h-14 mb-4'} rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.15)]`}>
        <CheckCircle2 className={`${compact ? 'w-4 h-4' : 'w-7 h-7'}`} aria-hidden="true" />
      </div>

      <div className={compact ? 'flex-1 min-w-0' : ''}>
        <h3 className={`font-bold text-white ${compact ? 'text-sm' : 'text-lg mb-1.5'}`}>{title}</h3>
        <p className={`text-slate-300 leading-relaxed ${compact ? 'text-xs truncate' : 'text-xs sm:text-sm mb-6 max-w-sm'}`}>{message}</p>
      </div>

      {action && (
        <div className={compact ? 'shrink-0' : 'w-full flex justify-center'}>
          {action}
        </div>
      )}
    </div>
  );
};

export default SuccessState;
