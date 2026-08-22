import React from 'react';
import { BarChart3, Download, FileText, Calendar, Users, DollarSign } from 'lucide-react';
import { API_V1_URL } from '../../services/api';

export const ReportsPage = () => {
  const downloadReport = (type) => {
    window.open(`${API_V1_URL}/reports/export-${type}/`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Reports & Compliance Exports</h1>
        <p className="text-xs text-slate-400 mt-1">Download official CSV attendance, leave, WFH, and audit compliance data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Attendance Audit Report</h3>
            <p className="text-xs text-slate-400 mt-1">Complete log of daily check-ins, check-outs, biometric verification methods, and work modes.</p>
          </div>
          <button
            onClick={() => downloadReport('attendance')}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Attendance CSV
          </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Leave Summary Report</h3>
            <p className="text-xs text-slate-400 mt-1">Comprehensive breakdown of all employee leave applications, approvals, rejections, and balance deductions.</p>
          </div>
          <button
            onClick={() => downloadReport('leaves')}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Leaves CSV
          </button>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Employee Roster Export</h3>
            <p className="text-xs text-slate-400 mt-1">Active employee profiles, departments, designations, work modes, and contact details.</p>
          </div>
          <button
            onClick={() => downloadReport('attendance')}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Export Roster CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
