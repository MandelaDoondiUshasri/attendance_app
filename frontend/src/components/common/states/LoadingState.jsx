import React from 'react';

const LoadingState = ({ type = 'table', text = 'Loading...' }) => {
  if (type === 'button') {
    return (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
        {text}
      </span>
    );
  }

  if (type === 'skeleton') {
    return (
      <div className="space-y-4 w-full">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-16 bg-slate-800/50 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${type === 'full' ? 'min-h-[50vh]' : 'min-h-[200px]'}`}>
      <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      <p className="text-sm font-semibold text-brand-300 animate-pulse">{text}</p>
    </div>
  );
};

export default LoadingState;
