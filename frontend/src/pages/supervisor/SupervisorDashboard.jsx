import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Users, CalendarCheck, CheckCircle2, XCircle, Clock,
  Plus, Search, ArrowRight, UserCheck, Calendar, ShieldCheck,
  AlertCircle, RefreshCw, ChevronRight, Phone, Mail
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';

export const SupervisorDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [todaySummary, setTodaySummary] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [roster, setRoster] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Attendance Modal
  const [attendanceModal, setAttendanceModal] = useState({
    isOpen: false,
    worker: null,
    status: 'PRESENT',
    check_in: '09:00',
    check_out: '17:00',
    work_mode: 'OFFICE',
    submitting: false
  });

  const fetchData = async () => {
    try {
      setError(null);
      const [summaryRes, workersRes, rosterRes] = await Promise.all([
        api.get('/attendance/today-summary/'),
        api.get('/employees/'),
        api.get(`/attendance/?date=${selectedDate}`)
      ]);
      setTodaySummary(summaryRes.data);
      setWorkers(workersRes.data.results || workersRes.data || []);
      setRoster(rosterRes.data.results || rosterRes.data || []);
    } catch (err) {
      console.error('Failed to load supervisor data:', err);
      setError('Unable to load Maintenance dashboard data. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Quick 1-click status update
  const handleQuickStatus = async (workerId, newStatus) => {
    try {
      await api.post('/attendance/mark-attendance/', {
        employee_id: workerId,
        date: selectedDate,
        status: newStatus,
        check_in: newStatus === 'PRESENT' ? '09:00' : null,
        check_out: newStatus === 'PRESENT' ? '17:00' : null,
        work_mode: 'OFFICE'
      });
      addToast(`Marked as ${newStatus}`, 'success');
      // Refresh roster
      const rosterRes = await api.get(`/attendance/?date=${selectedDate}`);
      setRoster(rosterRes.data.results || rosterRes.data || []);
      const summaryRes = await api.get('/attendance/today-summary/');
      setTodaySummary(summaryRes.data);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to update attendance.', 'error');
    }
  };

  const handleOpenAttendanceModal = (record) => {
    setAttendanceModal({
      isOpen: true,
      worker: record,
      status: record.status && record.status !== 'NOT_MARKED' ? record.status : 'PRESENT',
      check_in: record.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '09:00',
      check_out: record.check_out ? new Date(record.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : '17:00',
      work_mode: record.work_mode || 'OFFICE',
      submitting: false
    });
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!attendanceModal.worker) return;
    setAttendanceModal(prev => ({ ...prev, submitting: true }));

    try {
      const empId = attendanceModal.worker.employee || attendanceModal.worker.id.replace('mock-', '');
      await api.post('/attendance/mark-attendance/', {
        employee_id: empId,
        date: selectedDate,
        status: attendanceModal.status,
        check_in: attendanceModal.check_in,
        check_out: attendanceModal.check_out,
        work_mode: attendanceModal.work_mode
      });
      addToast(`Attendance saved for ${attendanceModal.worker.employee_name}`, 'success');
      setAttendanceModal(prev => ({ ...prev, isOpen: false }));
      // Refresh
      const rosterRes = await api.get(`/attendance/?date=${selectedDate}`);
      setRoster(rosterRes.data.results || rosterRes.data || []);
      const summaryRes = await api.get('/attendance/today-summary/');
      setTodaySummary(summaryRes.data);
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to save attendance.', 'error');
    } finally {
      setAttendanceModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const filteredRoster = roster.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.employee_name?.toLowerCase().includes(q) ||
      r.employee_id_code?.toLowerCase().includes(q)
    );
  });

  if (loading) return <LoadingState type="full" text="Loading Maintenance operations..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const totalWorkers = workers.length;
  const presentCount = todaySummary?.present_count || 0;
  const absentCount = (todaySummary?.total_recorded || 0) - presentCount - (todaySummary?.leave_count || 0) - (todaySummary?.wfh_count || 0);

  return (
    <div className="space-y-6">
      {/* HEADER BANNER */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 to-brand-500/20 flex items-center justify-center border border-amber-500/30 shadow-lg">
              <Wrench className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">Maintenance Supervisor Hub</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Supervisor View
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Oversee Maintenance department personnel records and record daily shift attendance.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-stretch sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 rounded-xl border border-slate-700/60 transition-all flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => navigate('/attendance')}
            className="px-4 py-2.5 bg-slate-900/80 hover:bg-slate-800 text-white rounded-xl border border-slate-700/60 transition-all flex items-center gap-2 text-xs font-bold shadow-md"
          >
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
            <span>Attendance Governance</span>
          </button>

          <button
            onClick={() => navigate('/employees')}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl transition-all flex items-center gap-2 text-xs font-black shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Users className="w-4 h-4" />
            <span>Manage Workers ({totalWorkers})</span>
          </button>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Total Workers</p>
            <p className="text-2xl font-extrabold text-white mt-1">{totalWorkers}</p>
            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Maintenance Department</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Present Today</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{presentCount}</p>
            <p className="text-[10px] text-emerald-500/80 font-semibold mt-0.5">Logged on duty</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Absent / Off Duty</p>
            <p className="text-2xl font-extrabold text-rose-400 mt-1">{absentCount > 0 ? absentCount : 0}</p>
            <p className="text-[10px] text-rose-500/80 font-semibold mt-0.5">Not recorded / absent</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Late / Other</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">{todaySummary?.late_count || 0}</p>
            <p className="text-[10px] text-indigo-400/80 font-semibold mt-0.5">Late arrivals</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DAILY WORKER ATTENDANCE ROSTER */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-amber-400" />
              Maintenance Daily Attendance Roster
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review and record attendance for maintenance workers on the selected date.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-auto">
            {/* Date Picker */}
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-xl">
              <Calendar className="w-4 h-4 text-amber-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-white font-mono focus:outline-none"
              />
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search worker..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500 w-44"
              />
            </div>
          </div>
        </div>

        {/* ROSTER TABLE */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[700px]">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Worker Name</th>
                <th className="p-3">Date</th>
                <th className="p-3">Check-In</th>
                <th className="p-3">Check-Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Attendance Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-0">
                    <EmptyState
                      title="No Maintenance Workers Found"
                      description="No active workers found in the Maintenance department."
                      icon={Wrench}
                    />
                  </td>
                </tr>
              ) : (
                filteredRoster.map((item) => {
                  const empId = item.employee || item.id.replace('mock-', '');
                  const isMarked = item.status && item.status !== 'ABSENT' && item.attendance_method !== 'N/A';
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white flex items-center gap-2">
                          {item.employee_name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.employee_id_code}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-300">{item.date}</td>
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        {item.check_in ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="p-3 font-mono font-bold text-indigo-400">
                        {item.check_out ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                      </td>
                      <td className="p-3 font-mono font-extrabold text-white">
                        {item.working_hours ? `${parseFloat(item.working_hours).toFixed(2)} hrs` : '--'}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleQuickStatus(empId, 'PRESENT')}
                            className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/30 text-[11px] font-bold transition-all"
                            title="Quick Mark Present"
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleQuickStatus(empId, 'ABSENT')}
                            className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg border border-rose-500/30 text-[11px] font-bold transition-all"
                            title="Quick Mark Absent"
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleOpenAttendanceModal(item)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-[11px] font-bold transition-all"
                            title="Edit / Detailed Attendance"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MAINTENANCE WORKERS PREVIEW */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Maintenance Workers Directory ({workers.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Assigned personnel in the Maintenance department.
            </p>
          </div>
          <button
            onClick={() => navigate('/employees')}
            className="text-xs text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-all"
          >
            <span>Full Directory</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {workers.slice(0, 6).map((w) => (
            <div
              key={w.id}
              className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-amber-500/40 transition-all flex flex-col justify-between space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-white text-xs">{w.full_name}</h4>
                  <p className="text-[10px] text-amber-400 font-mono mt-0.5">{w.employee_id}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {w.employment_status || 'ACTIVE'}
                </span>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-slate-500" />
                  <span className="truncate">{w.email}</span>
                </div>
                {w.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{w.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                <span>Joined: {w.joining_date || 'N/A'}</span>
                <span className="font-semibold text-slate-400">{w.designation_title || 'Worker'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* DETAILED ATTENDANCE MODAL */}
      {attendanceModal.isOpen && (
        <Modal
          isOpen={attendanceModal.isOpen}
          onClose={() => setAttendanceModal(prev => ({ ...prev, isOpen: false }))}
          title={`Record Attendance: ${attendanceModal.worker?.employee_name}`}
        >
          <form onSubmit={handleSaveAttendance} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Worker</label>
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white font-medium flex items-center justify-between">
                <span>{attendanceModal.worker?.employee_name}</span>
                <span className="font-mono text-slate-400">{attendanceModal.worker?.employee_id_code}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  disabled
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Status</label>
                <select
                  value={attendanceModal.status}
                  onChange={(e) => setAttendanceModal(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="PRESENT">PRESENT</option>
                  <option value="ABSENT">ABSENT</option>
                  <option value="LATE">LATE</option>
                  <option value="LEAVE">LEAVE</option>
                  <option value="WFH">WFH</option>
                </select>
              </div>
            </div>

            {attendanceModal.status !== 'ABSENT' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Check-In Time</label>
                  <input
                    type="time"
                    value={attendanceModal.check_in}
                    onChange={(e) => setAttendanceModal(prev => ({ ...prev, check_in: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1">Check-Out Time</label>
                  <input
                    type="time"
                    value={attendanceModal.check_out}
                    onChange={(e) => setAttendanceModal(prev => ({ ...prev, check_out: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAttendanceModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={attendanceModal.submitting}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 text-xs font-black rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {attendanceModal.submitting ? 'Saving...' : 'Save Attendance'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default SupervisorDashboard;
