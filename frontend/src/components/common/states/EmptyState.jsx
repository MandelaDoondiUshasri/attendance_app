import React from 'react';

const EmptyState = ({ title, description, icon: Icon, action }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[300px]">
      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-slate-500 shadow-inner">
        {Icon && <Icon className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
      {action && (
        <div>{action}</div>
      )}
    </div>
  );
};

export default EmptyState;
