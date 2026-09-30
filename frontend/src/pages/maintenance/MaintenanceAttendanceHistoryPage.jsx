import React, { useState, useEffect } from 'react';
import {
  Calendar, Search, Filter, RefreshCw, FileText,
  Clock, ArrowUpDown, ChevronDown, CheckCircle2, User
} from 'lucide-react';
import api from '../../services/api';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';

export const MaintenanceAttendanceHistoryPage = () => {
  const { addToast } = useAppState();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [historyRecords, setHistoryRecords] = useState([]);
  const [rangePreset, setRangePreset] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [workerSearch, setWorkerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');

  const fetchHistory = async () => {
    try {
      setError(null);
      let url = `/maintenance/attendance/history/?range=${rangePreset}`;
      if (rangePreset === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      if (statusFilter !== 'ALL') {
        url += `&status=${statusFilter}`;
      }
      if (shiftFilter !== 'ALL') {
        url += `&shift=${shiftFilter}`;
      }
      if (workerSearch) {
        url += `&worker=${encodeURIComponent(workerSearch)}`;
      }

      const res = await api.get(url);
      setHistoryRecords(res.data.results || []);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
      setError('Unable to load attendance history records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [rangePreset, statusFilter, shiftFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchHistory();
  };

  if (loading) return <LoadingState type="full" text="Loading Attendance History..." />;
  if (error) return <ErrorState message={error} onRetry={fetchHistory} />;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 mb-1">
            <Calendar className="w-3.5 h-3.5" />
            ATTENDANCE ARCHIVE
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Maintenance Attendance History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Audit logs and historical daily records for all maintenance workers.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-sm space-y-4">
        {/* Preset Tabs: Today, Yesterday, This Week, This Month, Custom */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'custom', label: 'Custom Date Range' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setRangePreset(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                rangePreset === tab.id
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-md'
                  : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Inputs if 'custom' is active */}
        {rangePreset === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">From:</span>
              <input
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">To:</span>
              <input
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
              />
            </div>
            <button
              onClick={fetchHistory}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Filters: Worker Search, Status, Shift */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-1">
          <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={workerSearch}
              onChange={e => setWorkerSearch(e.target.value)}
              placeholder="Filter by worker name or ID..."
              className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Status</option>
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="LEAVE">Leave</option>
              </select>
            </div>

            {/* Shift Filter */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>Shift:</span>
              <select
                value={shiftFilter}
                onChange={e => setShiftFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Shifts</option>
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
                <option value="General">General</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-mono">
              {historyRecords.length} records
            </span>
          </div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="rounded-3xl bg-[#0B0F19] border border-white/[0.08] shadow-2xl overflow-hidden">
        {historyRecords.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Attendance History Found"
              description="No attendance records match the selected date range and filter criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Worker ID</th>
                  <th className="py-3.5 px-4">Worker Name</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Check-In</th>
                  <th className="py-3.5 px-4">Check-Out</th>
                  <th className="py-3.5 px-4">Hours</th>
                  <th className="py-3.5 px-4">Marked By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {historyRecords.map(rec => (
                  <tr key={rec.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      {rec.date}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                      {rec.employee_id}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-100">{rec.worker_name}</div>
                      <div className="text-[10px] text-slate-400">{rec.designation}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        {rec.shift}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={rec.status} />
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {rec.check_in}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-300">
                      {rec.check_out}
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400 font-semibold">
                      {rec.working_hours ? `${rec.working_hours}h` : '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-[11px]">
                      {rec.marked_by}
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

export default MaintenanceAttendanceHistoryPage;
