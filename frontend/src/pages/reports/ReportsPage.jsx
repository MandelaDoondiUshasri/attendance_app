import React, { useState } from 'react';
import { Download, FileText, Calendar, Users, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const ReportsPage = () => {
  const { companyName } = useAuth();
  const [downloading, setDownloading] = useState('');
  const [message, setMessage] = useState(null);

  const downloadReport = async (type, filenamePrefix) => {
    setDownloading(type);
    setMessage(null);

    try {
      const response = await api.get(`/reports/export-${type}/`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Successfully exported ${filenamePrefix} CSV.` });
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setMessage({ type: 'error', text: 'Failed to download report. Please verify your administrative permissions.' });
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">{companyName || 'Enterprise'} Reports & Compliance Exports</h1>
        <p className="text-xs text-slate-400 mt-1">Download official CSV attendance, leave, WFH, and audit compliance data</p>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="text-xs font-semibold">{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Attendance Audit Export */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Attendance Audit Report</h3>
            <p className="text-xs text-slate-400 mt-1">Complete log of daily check-ins, check-outs, verification methods, and work modes.</p>
          </div>
          <button
            onClick={() => downloadReport('attendance', 'attendance_report')}
            disabled={downloading === 'attendance'}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'attendance' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Attendance CSV</span>
              </>
            )}
          </button>
        </div>

        {/* Leave Summary Export */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Leave Summary Report</h3>
            <p className="text-xs text-slate-400 mt-1">Comprehensive breakdown of all employee leave applications, approvals, rejections, and balance deductions.</p>
          </div>
          <button
            onClick={() => downloadReport('leaves', 'leaves_report')}
            disabled={downloading === 'leaves'}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'leaves' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Leaves CSV</span>
              </>
            )}
          </button>
        </div>

        {/* Employee Roster Export */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Employee Roster Export</h3>
            <p className="text-xs text-slate-400 mt-1">Active employee profiles, departments, designations, work modes, and contact details.</p>
          </div>
          <button
            onClick={() => downloadReport('employees', 'employees_roster')}
            disabled={downloading === 'employees'}
            className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {downloading === 'employees' ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Exporting CSV...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export Roster CSV</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
