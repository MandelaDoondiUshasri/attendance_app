import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck, Calendar, Clock, CheckCircle2,
  AlertTriangle, ShieldCheck, ShieldAlert, RefreshCw,
  Send, Save, ArrowLeft, Users, Check, Lock, Edit3,
  Coffee, Play, Pause
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';
import SupervisorClockInGate from './SupervisorClockInGate';
import LunchBreakControl from './LunchBreakControl';

export const MaintenanceAttendancePage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [workersState, setWorkersState] = useState([]);
  const [clockInGateOpen, setClockInGateOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submittingFinal, setSubmittingFinal] = useState(false);

  // Review & Submit Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);

  const fetchAttendance = async (targetDate = selectedDate) => {
    try {
      setError(null);
      const res = await api.get(`/maintenance/attendance/?date=${targetDate}`);
      setAttendanceData(res.data);

      // Clone workers list to local mutable state for quick editing
      const workers = (res.data.workers || []).map(w => ({
        ...w,
        // Default unmarked to PRESENT for convenience if supervisor wants
        current_status: w.status === 'NOT_MARKED' ? 'PRESENT' : w.status,
        current_check_in: w.check_in || (w.status === 'PRESENT' || w.status === 'NOT_MARKED' ? '09:00' : ''),
        has_changed: false
      }));
      setWorkersState(workers);

      // Check supervisor clock-in rule
      if (user?.role === 'SUPERVISOR' && !res.data.supervisor_clocked_in) {
        setClockInGateOpen(true);
      }
    } catch (err) {
      console.error('Failed to load maintenance attendance:', err);
      setError('Unable to load attendance roster. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendance(selectedDate);
  }, [selectedDate]);

  const handleStatusChange = (workerId, newStatus) => {
    if (attendanceData?.is_submitted && user?.role === 'SUPERVISOR') {
      addToast('Attendance for this date is already submitted and locked.', 'error');
      return;
    }
    setWorkersState(prev => prev.map(w => {
      if (w.worker_id === workerId) {
        let defaultCheckIn = w.current_check_in;
        if (newStatus === 'PRESENT' && !defaultCheckIn) defaultCheckIn = '09:00';
        if (newStatus === 'LATE' && !defaultCheckIn) defaultCheckIn = '09:30';
        if (['ABSENT', 'LEAVE'].includes(newStatus)) defaultCheckIn = '';

        return {
          ...w,
          current_status: newStatus,
          current_check_in: defaultCheckIn,
          has_changed: true
        };
      }
      return w;
    }));
  };

  const handleTimeChange = (workerId, newTime) => {
    if (attendanceData?.is_submitted && user?.role === 'SUPERVISOR') return;
    setWorkersState(prev => prev.map(w => {
      if (w.worker_id === workerId) {
        return { ...w, current_check_in: newTime, has_changed: true };
      }
      return w;
    }));
  };

  // Toggle individual worker break
  const handleToggleWorkerBreak = async (workerId, currentlyOnBreak) => {
    if (user?.role === 'SUPERVISOR' && !attendanceData?.supervisor_clocked_in) {
      setClockInGateOpen(true);
      return;
    }
    try {
      if (currentlyOnBreak) {
        await api.post('/maintenance/breaks/resume/', {
          scope: 'WORKER',
          worker_id: workerId
        });
        addToast('Worker resumed from lunch break', 'success');
      } else {
        await api.post('/maintenance/breaks/pause/', {
          scope: 'WORKER',
          worker_id: workerId,
          break_type: 'LUNCH'
        });
        addToast('Worker paused for lunch break', 'success');
      }
      fetchAttendance(selectedDate);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update break status.';
      addToast(msg, 'error');
    }
  };

  // Save Attendance (Draft / Incremental)
  const handleSaveAttendance = async () => {
    if (user?.role === 'SUPERVISOR' && !attendanceData?.supervisor_clocked_in) {
      setClockInGateOpen(true);
      return;
    }

    setSavingDraft(true);
    try {
      const recordsToSave = workersState.map(w => ({
        worker_id: w.worker_id,
        status: w.current_status,
        check_in: w.current_check_in || null,
        date: selectedDate
      }));

      const res = await api.post('/maintenance/attendance/', {
        records: recordsToSave
      });

      addToast(res.data.message || 'Attendance saved successfully.', 'success');
      fetchAttendance(selectedDate);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to save attendance.';
      addToast(msg, 'error');
    } finally {
      setSavingDraft(false);
    }
  };

  // Submit Final Attendance
  const handleFinalSubmit = async () => {
    setSubmittingFinal(true);
    try {
      // 1. First save all current states
      const recordsToSave = workersState.map(w => ({
        worker_id: w.worker_id,
        status: w.current_status,
        check_in: w.current_check_in || null,
        date: selectedDate
      }));
      await api.post('/maintenance/attendance/', { records: recordsToSave });

      // 2. Submit daily attendance
      const res = await api.post('/maintenance/attendance/submit/', {
        date: selectedDate,
        notes: `Submitted by supervisor for ${selectedDate}`
      });

      addToast('Attendance Submitted Successfully!', 'success');
      setReviewModalOpen(false);
      fetchAttendance(selectedDate);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to submit attendance.';
      addToast(msg, 'error');
    } finally {
      setSubmittingFinal(false);
    }
  };

  if (loading) return <LoadingState type="full" text="Loading Maintenance Attendance Roster..." />;
  if (error) return <ErrorState message={error} onRetry={() => fetchAttendance(selectedDate)} />;

  const isSupervisorClockedIn = attendanceData?.supervisor_clocked_in;
  const isSubmitted = attendanceData?.is_submitted;

  // Live Summary from state
  const totalCount = workersState.length;
  const presentCount = workersState.filter(w => w.current_status === 'PRESENT').length;
  const lateCount = workersState.filter(w => w.current_status === 'LATE').length;
  const absentCount = workersState.filter(w => w.current_status === 'ABSENT').length;
  const halfDayCount = workersState.filter(w => w.current_status === 'HALF_DAY').length;
  const leaveCount = workersState.filter(w => w.current_status === 'LEAVE').length;

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Supervisor Clock-In Gate Modal */}
      <SupervisorClockInGate
        isOpen={clockInGateOpen}
        onClose={() => setClockInGateOpen(false)}
        onClockedIn={() => {
          setClockInGateOpen(false);
          fetchAttendance(selectedDate);
        }}
        reason="Please clock in before taking or submitting maintenance worker attendance."
      />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <CalendarCheck className="w-3.5 h-3.5" />
              MAINTENANCE ATTENDANCE
            </span>
            {isSubmitted ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <Lock className="w-3 h-3" />
                Submitted & Locked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25">
                <Edit3 className="w-3 h-3" />
                In Progress (Draft)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Today's Maintenance Attendance
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Record, review, and finalize daily shift attendance for maintenance workers.
          </p>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/70 rounded-xl px-3 py-1.5 text-xs text-white">
            <Calendar className="w-4 h-4 text-cyan-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-white focus:outline-none text-xs font-mono"
            />
          </div>

          <button
            onClick={() => {
              setRefreshing(true);
              fetchAttendance(selectedDate);
            }}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* CLOCK-IN WARNING BANNER IF SUPERVISOR NOT CLOCKED IN */}
      {!isSupervisorClockedIn && user?.role === 'SUPERVISOR' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                Please clock in before taking worker attendance.
              </h4>
              <p className="text-xs text-amber-300/80">
                Enterprise policy requires the Maintenance Supervisor to check in before recording or submitting attendance.
              </p>
            </div>
          </div>
          <button
            onClick={() => setClockInGateOpen(true)}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all shrink-0"
          >
            Clock In Now
          </button>
        </div>
      )}

      {/* SUBMISSION LOCKED BANNER */}
      {isSubmitted && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-200">
                Attendance Submitted Successfully
              </h4>
              <p className="text-xs text-emerald-300/80">
                Submitted on {attendanceData?.formatted_date} by {attendanceData?.submitted_by || 'Supervisor'}. Direct edits are locked.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.07] text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Workers</span>
          <span className="text-2xl font-mono font-black text-white mt-1 block">{totalCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/25 text-center">
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Present</span>
          <span className="text-2xl font-mono font-black text-emerald-300 mt-1 block">{presentCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/25 text-center">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Late</span>
          <span className="text-2xl font-mono font-black text-amber-300 mt-1 block">{lateCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-rose-500/5 border border-rose-500/25 text-center">
          <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block">Absent</span>
          <span className="text-2xl font-mono font-black text-rose-300 mt-1 block">{absentCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-orange-500/5 border border-orange-500/25 text-center">
          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block">Half Day</span>
          <span className="text-2xl font-mono font-black text-orange-300 mt-1 block">{halfDayCount}</span>
        </div>
        <div className="p-3.5 rounded-2xl bg-purple-500/5 border border-purple-500/25 text-center">
          <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Leave</span>
          <span className="text-2xl font-mono font-black text-purple-300 mt-1 block">{leaveCount}</span>
        </div>
      </div>

      {/* LUNCH BREAK CONTROLLER */}
      <LunchBreakControl onStatusChange={() => fetchAttendance(selectedDate)} />

      {/* ATTENDANCE TABLE & MOBILE CARDS */}
      <div className="rounded-3xl bg-[#0B0F19] border border-white/[0.08] shadow-2xl overflow-hidden p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            Worker Attendance Roster — {attendanceData?.formatted_date}
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {workersState.length} active workers
          </span>
        </div>

        {workersState.length === 0 ? (
          <EmptyState
            title="No Maintenance Workers"
            description="Add maintenance workers to record daily attendance."
            actionText="Add Worker"
            onAction={() => navigate('/maintenance/workers/add')}
          />
        ) : (
          <div>
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-3">Worker ID</th>
                    <th className="py-3 px-3">Worker</th>
                    <th className="py-3 px-3">Shift</th>
                    <th className="py-3 px-3">Attendance Status</th>
                    <th className="py-3 px-3">Break</th>
                    <th className="py-3 px-3">Check-In Time</th>
                    <th className="py-3 px-3">Marked By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {workersState.map(w => {
                    const st = w.current_status;

                    return (
                      <tr key={w.worker_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-3 font-mono font-bold text-cyan-300">
                          {w.employee_id}
                        </td>
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-100">{w.worker_name}</div>
                          <div className="text-[10px] text-slate-400">{w.designation}</div>
                        </td>
                        <td className="py-3.5 px-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {w.shift}
                          </span>
                        </td>
                        <td className="py-3.5 px-3">
                          {isSubmitted ? (
                            <StatusBadge status={st} />
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {[
                                { id: 'PRESENT', label: 'Present', color: 'bg-emerald-500 text-white', idle: 'text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/30' },
                                { id: 'LATE', label: 'Late', color: 'bg-amber-500 text-white', idle: 'text-amber-400 hover:bg-amber-500/20 border-amber-500/30' },
                                { id: 'ABSENT', label: 'Absent', color: 'bg-rose-500 text-white', idle: 'text-rose-400 hover:bg-rose-500/20 border-rose-500/30' },
                                { id: 'HALF_DAY', label: 'Half Day', color: 'bg-orange-500 text-white', idle: 'text-orange-400 hover:bg-orange-500/20 border-orange-500/30' },
                                { id: 'LEAVE', label: 'Leave', color: 'bg-purple-500 text-white', idle: 'text-purple-400 hover:bg-purple-500/20 border-purple-500/30' },
                              ].map(btn => (
                                <button
                                  key={btn.id}
                                  type="button"
                                  disabled={isSubmitted}
                                  onClick={() => handleStatusChange(w.worker_id, btn.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                    st === btn.id
                                      ? btn.color + ' border-transparent shadow-md scale-105'
                                      : 'bg-white/[0.02] ' + btn.idle
                                  }`}
                                >
                                  {btn.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {w.is_on_break ? (
                            <div className="inline-flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                <Coffee className="w-3 h-3 text-amber-400 animate-pulse" />
                                Lunch ({w.break_info?.duration_minutes || 0}m)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleWorkerBreak(w.worker_id, true)}
                                className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                                title="Resume Work"
                              >
                                <Play className="w-3 h-3 fill-current" />
                              </button>
                            </div>
                          ) : ['PRESENT', 'LATE', 'HALF_DAY'].includes(st) ? (
                            <button
                              type="button"
                              onClick={() => handleToggleWorkerBreak(w.worker_id, false)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all"
                              title="Pause for Lunch Break"
                            >
                              <Coffee className="w-3 h-3" />
                              Pause
                            </button>
                          ) : (
                            <span className="text-slate-500 text-[10px] font-mono">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-3">
                          {isSubmitted ? (
                            <span className="font-mono text-slate-300">{w.current_check_in || '-'}</span>
                          ) : (
                            <input
                              type="time"
                              disabled={['ABSENT', 'LEAVE'].includes(st)}
                              value={w.current_check_in}
                              onChange={e => handleTimeChange(w.worker_id, e.target.value)}
                              className="bg-slate-900 border border-slate-700/70 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-30 disabled:cursor-not-allowed"
                            />
                          )}
                        </td>
                        <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                          {w.marked_by || (w.has_changed ? 'Modified (Unsaved)' : 'Not Marked')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE-RESPONSIVE CARD VIEW (Section 23) */}
            <div className="block md:hidden space-y-3">
              {workersState.map(w => {
                const st = w.current_status;

                return (
                  <div key={w.worker_id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-cyan-300 text-xs">{w.employee_id}</span>
                          <span className="font-bold text-white text-sm">{w.worker_name}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{w.designation} • {w.shift}</p>
                      </div>
                      <StatusBadge status={st} />
                    </div>

                    {!isSubmitted ? (
                      <div>
                        <div className="grid grid-cols-3 gap-1.5 mb-2">
                          {[
                            { id: 'PRESENT', label: 'Present', color: 'bg-emerald-500 text-white', idle: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
                            { id: 'LATE', label: 'Late', color: 'bg-amber-500 text-white', idle: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
                            { id: 'ABSENT', label: 'Absent', color: 'bg-rose-500 text-white', idle: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
                            { id: 'HALF_DAY', label: 'Half Day', color: 'bg-orange-500 text-white', idle: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
                            { id: 'LEAVE', label: 'Leave', color: 'bg-purple-500 text-white', idle: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
                          ].map(btn => (
                            <button
                              key={btn.id}
                              type="button"
                              onClick={() => handleStatusChange(w.worker_id, btn.id)}
                              className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                                st === btn.id
                                  ? btn.color + ' border-transparent shadow-md'
                                  : btn.idle
                              }`}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>

                        {!['ABSENT', 'LEAVE'].includes(st) && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-slate-400">Check-in:</span>
                            <input
                              type="time"
                              value={w.current_check_in}
                              onChange={e => handleTimeChange(w.worker_id, e.target.value)}
                              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono text-xs"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 flex justify-between">
                        <span>Check-in: {w.current_check_in || '-'}</span>
                        <span>Marked by: {w.marked_by}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        {!isSubmitted && workersState.length > 0 && (
          <div className="mt-6 pt-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-400 text-center sm:text-left">
              Review all workers before submitting. Once submitted, daily attendance is permanently logged and locked.
            </p>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleSaveAttendance}
                disabled={savingDraft || !isSupervisorClockedIn}
                className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/[0.1] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4 text-cyan-400" />
                {savingDraft ? 'Saving Draft...' : 'Save Attendance'}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!isSupervisorClockedIn && user?.role === 'SUPERVISOR') {
                    setClockInGateOpen(true);
                  } else {
                    setReviewModalOpen(true);
                  }
                }}
                disabled={!isSupervisorClockedIn}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                Review & Submit Attendance
              </button>
            </div>
          </div>
        )}
      </div>

      {/* REVIEW & SUBMIT MODAL (Section 13) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title="Review Attendance Submission"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
            <h4 className="font-bold text-emerald-300 text-sm mb-1">
              Attendance Summary
            </h4>
            <p className="text-slate-300">
              Department: <strong className="text-white">Maintenance</strong> • Date: <strong className="text-white">{attendanceData?.formatted_date}</strong>
            </p>
          </div>

          {/* Breakdown Table */}
          <div className="space-y-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-medium">Total Workers:</span>
              <span className="font-mono font-bold text-white text-sm">{totalCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-800">
              <span className="text-emerald-400 font-medium">Present:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">{presentCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-800">
              <span className="text-amber-400 font-medium">Late:</span>
              <span className="font-mono font-bold text-amber-400 text-sm">{lateCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-800">
              <span className="text-rose-400 font-medium">Absent:</span>
              <span className="font-mono font-bold text-rose-400 text-sm">{absentCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-800">
              <span className="text-orange-400 font-medium">Half Day:</span>
              <span className="font-mono font-bold text-orange-400 text-sm">{halfDayCount}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-t border-slate-800">
              <span className="text-purple-400 font-medium">Leave:</span>
              <span className="font-mono font-bold text-purple-400 text-sm">{leaveCount}</span>
            </div>
          </div>

          <p className="text-slate-400 text-[11px]">
            Once submitted, records will be locked and an audit trail will be permanently saved with your signature.
          </p>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold"
            >
              Edit Attendance
            </button>

            <button
              type="button"
              disabled={submittingFinal}
              onClick={handleFinalSubmit}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs tracking-wide shadow-md transition-all flex items-center gap-1.5"
            >
              {submittingFinal ? 'Submitting...' : 'Submit Attendance'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default MaintenanceAttendancePage;
