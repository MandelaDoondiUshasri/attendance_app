import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorState = ({ 
  title = 'Something went wrong', 
  message = 'We couldn\'t load this information right now. Please try again.', 
  onRetry,
  compact = false
}) => {
  return (
    <div 
      role="alert"
      className={`glass-card border-rose-500/20 bg-rose-950/20 text-center w-full mx-auto animate-fade-in ${
        compact 
          ? 'p-4 rounded-xl max-w-sm flex items-center justify-between gap-3 text-left' 
          : 'p-6 sm:p-8 rounded-2xl max-w-md my-6 flex flex-col items-center justify-center'
      }`}
    >
      <div className={`${compact ? 'w-9 h-9' : 'w-12 h-12 mb-4'} rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20 shadow-inner`}>
        <AlertTriangle className={`${compact ? 'w-4 h-4' : 'w-6 h-6'}`} aria-hidden="true" />
      </div>

      <div className={compact ? 'flex-1 min-w-0' : ''}>
        <h3 className={`font-bold text-white ${compact ? 'text-sm' : 'text-base mb-1.5'}`}>{title}</h3>
        <p className={`text-slate-400 leading-relaxed ${compact ? 'text-xs truncate' : 'text-xs sm:text-sm mb-5 max-w-sm'}`}>{message}</p>
      </div>
      
      {onRetry && (
        <button 
          onClick={onRetry}
          className={`bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2 text-xs shadow-md shrink-0 active:scale-95 ${
            compact ? 'px-3 py-1.5' : 'px-4 py-2.5'
          }`}
          aria-label="Retry loading this section"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" /> 
          <span>Try Again</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
