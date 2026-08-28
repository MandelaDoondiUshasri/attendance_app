import React from 'react';

const EmptyState = ({ title, description, icon: Icon, action }) => {
  return (
    <div 
      role="status"
      aria-label={title}
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[300px] animate-fade-in"
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center mb-4 text-slate-400 shadow-inner">
        {Icon && <Icon className="w-8 h-8 opacity-80" aria-hidden="true" />}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">{description}</p>
      {action && (
        <div className="mt-1">{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
