import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorState = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <div className="glass-card border-rose-500/20 bg-rose-500/5 p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center w-full max-w-md mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-300 mb-6">{message || 'We couldn\'t load this information right now. Please try again.'}</p>
      
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
