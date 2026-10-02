import React, { useState, useEffect } from 'react';
import {
  BarChart3, Calendar, Download, RefreshCw,
  Users, CheckCircle2, FileText, ChevronLeft, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';

export const MaintenanceReportsPage = () => {
  const { addToast } = useAppState();

  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [roleFilter, setRoleFilter] = useState('ALL');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  const months = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  const fetchMonthlyReport = async () => {
    try {
      setError(null);
      const res = await api.get(`/maintenance/attendance/monthly-summary/?year=${selectedYear}&month=${selectedMonth}&role=${roleFilter}`);
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
      setError('Unable to load monthly attendance report.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear, selectedMonth, roleFilter]);

  const handleExportCSV = () => {
    if (!reportData?.results || reportData.results.length === 0) {
      addToast('No data available to export.', 'info');
      return;
    }
    const headers = ['Worker ID', 'Worker Name', 'Designation', 'Shift', 'Present', 'Absent', 'Late', 'Leave', 'Half Day', 'Attendance %'];
    const rows = reportData.results.map(r => [
      r.employee_id,
      `"${r.worker_name}"`,
      `"${r.designation}"`,
      r.shift,
      r.present,
      r.absent,
      r.late,
      r.leave,
      r.half_day,
      `${r.attendance_rate}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Maintenance_Attendance_${reportData.month_name.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('CSV Export downloaded.', 'success');
  };

  if (loading) return <LoadingState type="full" text="Calculating Monthly Report..." />;
  if (error) return <ErrorState message={error} onRetry={fetchMonthlyReport} />;

  const results = reportData?.results || [];

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 mb-1">
            <BarChart3 className="w-3.5 h-3.5" />
            MONTHLY ANALYTICS
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Maintenance — {reportData?.month_name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Aggregated worker monthly attendance totals and compliance summary.
          </p>
        </div>

        {/* Action controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month selector */}
          <select
            value={selectedMonth}
            onChange={e => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {months.map(m => (
              <option key={m.num} value={m.num}>{m.name}</option>
            ))}
          </select>

          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Role selector */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Staff (Supervisors & Workers)</option>
            <option value="SUPERVISOR">Supervisors Only</option>
            <option value="WORKER">Workers Only</option>
          </select>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchMonthlyReport();
            }}
            disabled={refreshing}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08]"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/[0.1] transition-all"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            Export CSV
          </button>
        </div>
      </div>

      {/* MONTHLY SUMMARY TABLE */}
      <div className="rounded-3xl bg-[#0B0F19] border border-white/[0.08] shadow-2xl overflow-hidden p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Worker Breakdown — {reportData?.month_name}
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {results.length} active workers
          </span>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No Maintenance Records Found"
            description="No workers were active during this calendar month."
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Staff ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Shift</th>
                  <th className="py-3 px-3 text-center text-emerald-400">Present</th>
                  <th className="py-3 px-3 text-center text-rose-400">Absent</th>
                  <th className="py-3 px-3 text-center text-amber-400">Late</th>
                  <th className="py-3 px-3 text-center text-purple-400">Leave</th>
                  <th className="py-3 px-3 text-center text-orange-400">Half Day</th>
                  <th className="py-3 px-3 text-right">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {results.map(r => (
                  <tr key={r.worker_id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                      {r.employee_id}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-100">{r.worker_name}</div>
                      <div className="text-[10px] text-slate-400">{r.designation}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        r.role === 'SUPERVISOR'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                          : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {r.role || 'WORKER'}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {r.shift}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-emerald-400">
                      {r.present}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-rose-400">
                      {r.absent}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-amber-400">
                      {r.late}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-purple-400">
                      {r.leave}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold text-orange-400">
                      {r.half_day}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-black text-cyan-300">
                      {r.attendance_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenanceReportsPage;
