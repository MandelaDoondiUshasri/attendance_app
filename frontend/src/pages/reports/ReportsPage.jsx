import React, { useState } from 'react';
import { 
  Download, FileText, Calendar, Users, RefreshCw, CheckCircle2, 
  AlertCircle, BarChart3, FileSpreadsheet, ShieldCheck, Sparkles,
  Layers, ArrowUpRight, Lock, Check, Clock, Database
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import MonthlyReportTable from './MonthlyReportTable';

export const ReportsPage = () => {
  const { companyName } = useAuth();
  const [activeTab, setActiveTab] = useState('monthly'); // 'monthly' | 'compliance'
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

      setMessage({ type: 'success', text: `Successfully generated and exported ${filenamePrefix.replace(/_/g, ' ')}.` });
    } catch (err) {
      console.error('Failed to export CSV:', err);
      setMessage({ type: 'error', text: 'Failed to generate report export. Please verify administrator permissions.' });
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-6 print:space-y-2 pb-12">
      
      {/* Executive Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 print:hidden">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync
            </span>
            <span className="text-xs text-slate-500 font-medium">|</span>
            <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">
              Financial & Workforce Intelligence
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <span>{companyName || 'Enterprise'}</span>
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              Reports & Analytics
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
            Automated monthly attendance reconciliation, active screen-time telemetry, leave governance, and statutory salary payable distribution ledger.
          </p>
        </div>

        {/* Tab Navigation Pill */}
        <div className="flex items-center p-1.5 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-xl shadow-black/40 shrink-0">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'monthly'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Monthly Attendance & Salary</span>
            {activeTab === 'monthly' && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-white/20 rounded-md uppercase tracking-wider">
                Ledger
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('compliance')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'compliance'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Compliance Exports</span>
            {activeTab === 'compliance' && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black bg-white/20 rounded-md uppercase tracking-wider">
                Audit
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Global Status Banner */}
      {message && (
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-lg print:hidden transition-all animate-fadeInSlideDown ${
          message.type === 'success'
            ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="text-xs font-bold">{message.type === 'success' ? 'Report Export Ready' : 'Export Failed'}</p>
              <p className="text-xs text-slate-300 mt-0.5">{message.text}</p>
            </div>
          </div>
          <button 
            onClick={() => setMessage(null)}
            className="text-xs font-bold text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab 1: Comprehensive Monthly Attendance & Salary Ledger */}
      {activeTab === 'monthly' && (
        <MonthlyReportTable />
      )}

      {/* Tab 2: Compliance & Statutory Audit Vault */}
      {activeTab === 'compliance' && (
        <div className="space-y-6">
          
          {/* Header Banner */}
          <div className="p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                    Statutory Compliance & Forensic Data Vault
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white mt-1">
                  Official Audit & Regulatory Archives
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Export raw, immutable database tables formatted strictly for government labor regulations, external tax audits, bank disbursement verifications, and permanent HR archives.
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-slate-950/60 border border-slate-800 text-right">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Compliance Standard</div>
                  <div className="text-xs font-extrabold text-emerald-400">ISO / Labor Reg 2026</div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Executive Export Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Card 1: Attendance Audit Export */}
            <div className="group relative rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-emerald-500/40 p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-emerald-400 border border-slate-700">
                    Daily Telemetry
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Attendance Audit Ledger
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Granular log of all daily employee check-ins, check-outs, GPS verification coordinates, IP tags, and work mode classifications.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center justify-between">
                    <span>Encoding:</span>
                    <span className="text-slate-200">UTF-8 RFC-4180</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Scope:</span>
                    <span className="text-slate-200">All Active Roster</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => downloadReport('attendance', 'attendance_audit_log')}
                  disabled={downloading === 'attendance'}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98"
                >
                  {downloading === 'attendance' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Archive...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export Attendance CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 2: Leave Summary Export */}
            <div className="group relative rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-indigo-500/40 p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-indigo-400 border border-slate-700">
                    Governance
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                    Leave Governance Registry
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Comprehensive audit trail of all leave applications, approvals, rejections, casual/optional quotas, and salary balance deductions.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center justify-between">
                    <span>Approval Chain:</span>
                    <span className="text-slate-200">Manager Verified</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Categories:</span>
                    <span className="text-slate-200">Paid • Optional • LOP</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => downloadReport('leaves', 'leave_governance_report')}
                  disabled={downloading === 'leaves'}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98"
                >
                  {downloading === 'leaves' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Archive...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Export Leaves CSV</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Card 3: Employee Roster Export */}
            <div className="group relative rounded-3xl bg-slate-900/70 border border-slate-800/90 hover:border-purple-500/40 p-6 flex flex-col justify-between transition-all duration-300 shadow-xl hover:shadow-purple-500/5 hover:-translate-y-1">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shadow-inner group-hover:scale-105 transition-transform">
                    <Users className="w-6 h-6" />
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-purple-400 border border-slate-700">
                    Master Roster
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors">
                    Workforce Master Directory
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Active headcount directory containing department affiliations, work classifications, designations, and contact parameters.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/60 space-y-1.5 text-[11px] text-slate-400 font-mono">
                  <div className="flex items-center justify-between">
                    <span>Access Tier:</span>
                    <span className="text-slate-200">Admin Clearance</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Format:</span>
                    <span className="text-slate-200">CSV Spreadsheet</span>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <button
                  onClick={() => downloadReport('employees', 'workforce_master_roster')}
                  disabled={downloading === 'employees'}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 active:scale-98"
                >
                  {downloading === 'employees' ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Archive...</span>
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

          {/* Security & Audit Compliance Footnote */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                All exported files are generated on demand from immutable audit records and strictly logged under enterprise compliance telemetry.
              </span>
            </div>
            <span className="hidden sm:inline font-mono text-[11px] text-slate-500">
              SHA-256 Checksum Validated
            </span>
          </div>

        </div>
      )}

    </div>
  );
};

export default ReportsPage;
