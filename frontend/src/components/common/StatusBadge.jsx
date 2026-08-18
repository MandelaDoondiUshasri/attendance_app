import React from 'react';

const statusStyles = {
  PRESENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  LATE: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HALF_DAY: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  ABSENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  LEAVE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  WFH: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  PENDING: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  APPROVED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  INACTIVE: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  INCREMENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DECREMENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

export const StatusBadge = ({ status }) => {
  const style = statusStyles[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  const label = status ? status.replace('_', ' ') : 'N/A';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse"></span>
      {label}
    </span>
  );
};

export default StatusBadge;
