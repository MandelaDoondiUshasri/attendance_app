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
  CANCELLED: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  INCREMENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  DECREMENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  'Present – Approved Early Exit': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Early Exit – Approval Pending': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export const StatusBadge = ({ status }) => {
  let style = statusStyles[status];
  if (!style) {
    const s = String(status || '').toUpperCase();
    if (s.includes('APPROVED')) {
      style = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    } else if (s.includes('PENDING')) {
      style = 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    } else if (s.includes('REJECTED')) {
      style = 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    } else if (s.includes('CANCELLED')) {
      style = 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    } else {
      style = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  }
  const label = status ? String(status).replace(/_/g, ' ') : 'N/A';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse"></span>
      {label}
    </span>
  );
};

export default StatusBadge;
