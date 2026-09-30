import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Users, CalendarCheck, Clock, Plus, Search,
  ArrowRight, ShieldCheck, AlertCircle, RefreshCw,
  CheckCircle2, XCircle, UserCheck, Calendar, BarChart3,
  Sparkles, CheckSquare, ShieldAlert, Coffee, Play, Pause,
  Shield, MapPin
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
import MaintenanceGeofenceModal from './MaintenanceGeofenceModal';

export const MaintenanceDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [dashboardData, setDashboardData] = useState(null);
  const [workersList, setWorkersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [clockInGateOpen, setClockInGateOpen] = useState(false);
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);

  // Quick edit modal
  const [editModal, setEditModal] = useState({
    isOpen: false,
    worker: null,
    status: 'PRESENT',
    check_in: '09:00',
    check_out: '17:00',
    submitting: false
  });

  const fetchData = async () => {
    try {
      setError(null);
      const [dashRes, workersRes, breaksRes] = await Promise.all([
        api.get('/maintenance/dashboard/'),
        api.get('/maintenance/workers/'),
        api.get('/maintenance/breaks/status/').catch(() => ({ data: { workers: [] } }))
      ]);
      setDashboardData(dashRes.data);
      const rawWorkers = workersRes.data.results || workersRes.data || [];
      const breakMap = {};
      (breaksRes.data?.workers || []).forEach(b => {
        breakMap[b.worker_id] = b;
      });
      const merged = rawWorkers.map(w => ({
        ...w,
        break_info: breakMap[w.id] || null,
        is_on_break: Boolean(breakMap[w.id]?.is_on_break)
      }));
      setWorkersList(merged);

      // If user is SUPERVISOR and hasn't clocked in today, prompt clock in
      if (user?.role === 'SUPERVISOR' && !dashRes.data?.supervisor_attendance?.has_clocked_in_today) {
        setClockInGateOpen(true);
      }
    } catch (err) {
      console.error('Failed to load Maintenance dashboard data:', err);
      setError('Unable to load Maintenance dashboard data. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // Quick 1-click status update from dashboard table
  const handleQuickStatus = async (workerId, newStatus) => {
    if (!dashboardData?.supervisor_attendance?.has_clocked_in_today && user?.role === 'SUPERVISOR') {
      setClockInGateOpen(true);
      return;
    }
    try {
      await api.post('/maintenance/attendance/', {
        records: [{
          worker_id: workerId,
          status: newStatus,
          date: new Date().toISOString().split('T')[0]
        }]
      });
      addToast(`Status updated to ${newStatus}`, 'success');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update attendance.';
      addToast(msg, 'error');
    }
  };

  // 1-click individual worker lunch break toggle
  const handleToggleWorkerBreak = async (workerId, currentlyOnBreak) => {
    if (!dashboardData?.supervisor_attendance?.has_clocked_in_today && user?.role === 'SUPERVISOR') {
      setClockInGateOpen(true);
      return;
    }
    try {
      if (currentlyOnBreak) {
        let coords = null;
        if (navigator.geolocation) {
          try {
            coords = await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
                err => reject(err),
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
              );
            });
          } catch (locErr) {
            console.warn('Geolocation capture skipped or failed:', locErr);
          }
        }

        const payload = {
          scope: 'WORKER',
          worker_id: workerId,
          ...(coords || {})
        };

        await api.post('/maintenance/breaks/resume/', payload);
        addToast('Worker resumed from lunch break', 'success');
      } else {
        await api.post('/maintenance/breaks/pause/', {
          scope: 'WORKER',
          worker_id: workerId,
          break_type: 'LUNCH'
        });
        addToast('Worker paused for lunch break', 'success');
      }
      fetchData();
    } catch (err) {
      const data = err.response?.data;
      if (data?.geofence_blocked) {
        addToast(`Outside Worksite: ${data.distance_meters}m away. CEO requires within ${data.allowed_radius_meters}m to resume.`, 'error');
      } else {
        const msg = data?.error || 'Failed to update break status.';
        addToast(msg, 'error');
      }
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!editModal.worker) return;
    setEditModal(prev => ({ ...prev, submitting: true }));

    try {
      await api.post('/maintenance/attendance/', {
        records: [{
          worker_id: editModal.worker.id,
          status: editModal.status,
          check_in: editModal.check_in,
          check_out: editModal.check_out,
          date: new Date().toISOString().split('T')[0]
        }]
      });
      addToast(`Attendance saved for ${editModal.worker.full_name}`, 'success');
      setEditModal(prev => ({ ...prev, isOpen: false }));
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save attendance.';
      addToast(msg, 'error');
    } finally {
      setEditModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const handleSupervisorClockOut = async () => {
    try {
      await api.post('/attendance/clock-out/');
      addToast('Clocked out successfully.', 'success');
      fetchData();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to clock out.';
      addToast(msg, 'error');
    }
  };

  if (loading) return <LoadingState type="full" text="Loading Maintenance operations..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const supAtt = dashboardData?.supervisor_attendance || {};
  const workforce = dashboardData?.workforce || {};

  // Greeting
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 17 ? 'Good Afternoon' : 'Good Evening';
  const supervisorName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Supervisor';

  const filteredWorkers = workersList.filter(w => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.employee_id?.toLowerCase().includes(q) ||
      w.designation_title?.toLowerCase().includes(q) ||
      w.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mandatory Clock-In Gate Modal */}
      <SupervisorClockInGate
        isOpen={clockInGateOpen}
        onClose={() => setClockInGateOpen(false)}
        onClockedIn={() => {
          setClockInGateOpen(false);
          fetchData();
        }}
      />

      {/* CEO Worksite Geofence Modal */}
      <MaintenanceGeofenceModal
        isOpen={geofenceModalOpen}
        onClose={() => setGeofenceModalOpen(false)}
        onSaved={fetchData}
      />

      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
              <Wrench className="w-3.5 h-3.5" />
              MAINTENANCE DEPARTMENT
            </span>
            {workforce.is_submitted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 className="w-3 h-3" />
                Today's Attendance Submitted
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {greeting}, {supervisorName}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Maintenance workforce operations, real-time worker rosters, and attendance control.
          </p>
        </div>

        {/* Action button cluster */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {(user?.role === 'CEO' || user?.role === 'SYSTEM_ADMIN') && (
            <button
              onClick={() => setGeofenceModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs tracking-wide border border-cyan-500/30 transition-all shadow-sm"
              title="Configure Dynamic Worksite Geofence & Radius"
            >
              <Shield className="w-4 h-4 text-cyan-400" />
              Worksite Geofence
            </button>
          )}

          <button
            onClick={() => navigate('/maintenance/workers/add')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs tracking-wide border border-white/[0.1] transition-all shadow-sm"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            Add Worker
          </button>

          <button
            onClick={() => {
              if (!supAtt.has_clocked_in_today && user?.role === 'SUPERVISOR') {
                setClockInGateOpen(true);
              } else {
                navigate('/maintenance/attendance');
              }
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
          >
            <CalendarCheck className="w-4 h-4" />
            Take Attendance
          </button>
        </div>
      </div>

      {/* TOP CARDS: SUPERVISOR ATTENDANCE + WORKFORCE METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* SUPERVISOR ATTENDANCE CARD */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">Supervisor Attendance</h3>
                <p className="text-[11px] text-slate-400">{supAtt.date || 'Today'}</p>
              </div>
            </div>

            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
              supAtt.status === 'CLOCKED_IN'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                : supAtt.status === 'CLOCKED_OUT'
                ? 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                supAtt.status === 'CLOCKED_IN' ? 'bg-emerald-400 animate-pulse' : 'bg-current'
              }`} />
              {supAtt.status === 'CLOCKED_IN' ? 'CLOCKED IN' : supAtt.status === 'CLOCKED_OUT' ? 'CLOCKED OUT' : 'NOT CLOCKED IN'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 py-3 border-y border-white/[0.06] my-3">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Clock-in Time</p>
              <p className="text-lg font-mono font-black text-white mt-0.5">
                {supAtt.clock_in || '--:--'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Working Time</p>
              <p className="text-lg font-mono font-black text-cyan-400 mt-0.5">
                {supAtt.working_time || '00h 00m'}
              </p>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            {!supAtt.has_clocked_in_today ? (
              <button
                onClick={() => setClockInGateOpen(true)}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Clock In Today
              </button>
            ) : supAtt.is_clocked_in ? (
              <button
                onClick={handleSupervisorClockOut}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs tracking-wide transition-all flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Clock Out of Shift
              </button>
            ) : (
              <p className="text-xs text-slate-400 text-center w-full">
                Shift completed for today.
              </p>
            )}
          </div>
        </div>

        {/* WORKFORCE OVERVIEW (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/60 border border-white/[0.08] p-5 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">Maintenance Workforce Status</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Attendance Rate: </span>
              <span className="text-sm font-bold text-emerald-400 font-mono">
                {workforce.attendance_percentage || 0}%
              </span>
            </div>
          </div>

          {/* 6 Metric Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 my-2">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
              <p className="text-xl font-mono font-black text-white mt-1">{workforce.total_workers || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
              <p className="text-[10px] font-bold text-emerald-400 uppercase">Present</p>
              <p className="text-xl font-mono font-black text-emerald-300 mt-1">{workforce.present || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 text-center">
              <p className="text-[10px] font-bold text-rose-400 uppercase">Absent</p>
              <p className="text-xl font-mono font-black text-rose-300 mt-1">{workforce.absent || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
              <p className="text-[10px] font-bold text-amber-400 uppercase">Late</p>
              <p className="text-xl font-mono font-black text-amber-300 mt-1">{workforce.late || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-center">
              <p className="text-[10px] font-bold text-purple-400 uppercase">On Leave</p>
              <p className="text-xl font-mono font-black text-purple-300 mt-1">{workforce.on_leave || 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-500/5 border border-slate-500/20 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Not Marked</p>
              <p className="text-xl font-mono font-black text-slate-300 mt-1">{workforce.not_marked || 0}</p>
            </div>
          </div>

          {/* Quick nav links */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/[0.06] text-xs">
            <button
              onClick={() => navigate('/maintenance/workers')}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              View Workers ({workforce.total_workers || 0})
            </button>
            <button
              onClick={() => navigate('/maintenance/attendance/history')}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              Attendance History
            </button>
            <button
              onClick={() => navigate('/maintenance/reports')}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-400" />
              Daily Report & Monthly Summary
            </button>
          </div>
        </div>
      </div>

      {/* LUNCH BREAK CONTROLLER (Section: Supervisor Pause Button for Lunch Break) */}
      <LunchBreakControl onStatusChange={fetchData} />

      {/* TODAY'S WORKER ROSTER TABLE */}
      <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-cyan-400" />
              Today's Maintenance Workers Roster
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              1-click status assignment for active workers in Maintenance
            </p>
          </div>

          {/* Search box */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by worker name, ID..."
              className="w-full bg-slate-900/90 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {filteredWorkers.length === 0 ? (
          <EmptyState
            title="No Maintenance Workers Found"
            description="Add your first maintenance worker to start taking daily attendance."
            actionText="Add Worker"
            onAction={() => navigate('/maintenance/workers/add')}
          />
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-3">Worker ID</th>
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Designation</th>
                  <th className="py-3 px-3">Shift</th>
                  <th className="py-3 px-3">Today's Status</th>
                  <th className="py-3 px-3">Break</th>
                  <th className="py-3 px-3">Check-In</th>
                  <th className="py-3 px-3 text-right">Quick 1-Click Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredWorkers.map((worker) => {
                  const att = worker.today_attendance || {};
                  const currentStatus = att.status || 'NOT_MARKED';

                  return (
                    <tr key={worker.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                        {worker.employee_id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-100">{worker.full_name}</div>
                        <div className="text-[10px] text-slate-400">{worker.phone || 'No phone'}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {worker.designation_title || 'Technician'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {worker.shift || 'Morning'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <StatusBadge status={currentStatus} />
                      </td>
                      <td className="py-3 px-3">
                        {worker.is_on_break ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Coffee className="w-3 h-3 text-amber-400 animate-pulse" />
                              Lunch ({worker.break_info?.duration_minutes || 0}m)
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleWorkerBreak(worker.id, true)}
                              className="p-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 transition-all"
                              title="Resume Work"
                            >
                              <Play className="w-3 h-3 fill-current" />
                            </button>
                          </div>
                        ) : ['PRESENT', 'LATE', 'HALF_DAY'].includes(currentStatus) ? (
                          <button
                            type="button"
                            onClick={() => handleToggleWorkerBreak(worker.id, false)}
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
                      <td className="py-3 px-3 font-mono text-slate-300">
                        {att.check_in || '--:--'}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => handleQuickStatus(worker.id, 'PRESENT')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              currentStatus === 'PRESENT'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20'
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleQuickStatus(worker.id, 'LATE')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              currentStatus === 'LATE'
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20'
                            }`}
                          >
                            Late
                          </button>
                          <button
                            onClick={() => handleQuickStatus(worker.id, 'ABSENT')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                              currentStatus === 'ABSENT'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => {
                              setEditModal({
                                isOpen: true,
                                worker,
                                status: currentStatus === 'NOT_MARKED' ? 'PRESENT' : currentStatus,
                                check_in: att.check_in || '09:00',
                                check_out: '17:00',
                                submitting: false
                              });
                            }}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08]"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* QUICK ATTENDANCE EDIT MODAL */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
        title={`Edit Attendance: ${editModal.worker?.full_name || ''}`}
      >
        <form onSubmit={handleSaveModal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Attendance Status</label>
            <div className="grid grid-cols-3 gap-2">
              {['PRESENT', 'LATE', 'ABSENT', 'HALF_DAY', 'LEAVE'].map(st => (
                <button
                  type="button"
                  key={st}
                  onClick={() => setEditModal(prev => ({ ...prev, status: st }))}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                    editModal.status === st
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Check-In Time</label>
              <input
                type="time"
                value={editModal.check_in}
                onChange={e => setEditModal(prev => ({ ...prev, check_in: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Check-Out Time</label>
              <input
                type="time"
                value={editModal.check_out}
                onChange={e => setEditModal(prev => ({ ...prev, check_out: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editModal.submitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md"
            >
              {editModal.submitting ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaintenanceDashboard;
