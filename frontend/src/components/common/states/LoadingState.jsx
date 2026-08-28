import React from 'react';

const LoadingState = ({ type = 'spinner', count = 3, text = 'Loading...' }) => {
  if (type === 'button') {
    return (
      <span className="inline-flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
        <span>{text}</span>
      </span>
    );
  }

  if (type === 'skeleton' || type === 'table') {
    return (
      <div className="space-y-3 w-full animate-pulse" role="status" aria-label="Loading content">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="w-full h-14 bg-slate-850/60 rounded-xl border border-slate-800/60 flex items-center px-4 gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-800/80 shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-800/80 rounded w-1/3"></div>
              <div className="h-2.5 bg-slate-800/50 rounded w-1/4"></div>
            </div>
            <div className="w-20 h-6 bg-slate-800/60 rounded-lg shrink-0"></div>
          </div>
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }

  if (type === 'cards') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full animate-pulse" role="status">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="p-5 rounded-2xl bg-slate-850/60 border border-slate-800/60 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 bg-slate-800/80 rounded w-1/2"></div>
              <div className="w-6 h-6 rounded bg-slate-800/60"></div>
            </div>
            <div className="h-7 bg-slate-800/90 rounded w-2/3"></div>
            <div className="h-2.5 bg-slate-800/50 rounded w-1/3"></div>
          </div>
        ))}
        <span className="sr-only">{text}</span>
      </div>
    );
  }

  return (
    <div 
      role="status" 
      aria-label={text}
      className={`flex flex-col items-center justify-center p-8 text-center animate-fade-in ${
        type === 'full' ? 'min-h-[50vh]' : 'min-h-[220px]'
      }`}
    >
      <div className="relative flex items-center justify-center mb-4">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_15px_rgba(99,102,241,0.4)]"></div>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300 animate-pulse">{text}</p>
    </div>
  );
};

export default LoadingState;
