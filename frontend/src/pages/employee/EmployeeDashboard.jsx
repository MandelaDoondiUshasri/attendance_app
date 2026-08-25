import React, { useState, useEffect, useRef } from 'react';
import {
  User, CalendarCheck, Home, FileText, Clock, Plus, Camera,
  MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck,
  Play, LogOut, CheckSquare, Trash2, CheckCircle2, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'APPLY_LEAVE', 'APPLY_WFH', 'CORRECTION'

  // Form states
  const [leaveForm, setLeaveForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
  const [wfhForm, setWfhForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });
  const [corrForm, setCorrForm] = useState({ date: '', requested_check_in: '', reason: '' });
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Shift clocking state
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [workMode, setWorkMode] = useState('OFFICE'); // 'OFFICE' | 'WFH'
  const [shiftDuration, setShiftDuration] = useState('00:00:00');

  // Task Tracker state
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    planned_tasks: '',
    completed_tasks: '',
    hours_spent: '1.0',
    blockers: '',
    status: 'TODO'
  });
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const [userRes, attRes, typeRes] = await Promise.all([
        api.get('/auth/me/'),
        api.get('/attendance/'),
        api.get('/leaves/types/')
      ]);
      setProfile(userRes.data);
      const attList = attRes.data.results || attRes.data || [];
      setAttendances(attList);
      setLeaveTypes(typeRes.data.results || typeRes.data || []);

      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = attList.find(a => a.date === todayStr);
      setTodayAttendance(todayRec);

      if (todayRec && !todayRec.check_out) {
        setIsClockedIn(true);
        setActiveAttendance(todayRec);
        setWorkMode(todayRec.work_mode || 'OFFICE');
      } else {
        setIsClockedIn(false);
        setActiveAttendance(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await api.get('/attendance/tasks/');
      setTasks(res.data.results || res.data || []);
    } catch (e) {
      console.error("Error loading tasks:", e);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchTasks();
  }, []);

  // Update timer dynamically every second
  useEffect(() => {
    let interval = null;
    if (isClockedIn && activeAttendance && activeAttendance.check_in) {
      const calculateDuration = () => {
        const start = new Date(activeAttendance.check_in).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setShiftDuration(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );
      };

      calculateDuration();
      interval = setInterval(calculateDuration, 1000);
    } else {
      setShiftDuration('00:00:00');
    }
    return () => clearInterval(interval);
  }, [isClockedIn, activeAttendance]);

  const handleClockIn = async (selectedMode) => {
    const mode = (typeof selectedMode === 'string' && selectedMode) ? selectedMode : workMode || 'OFFICE';
    try {
      const payload = {
        work_mode: mode,
        attendance_method: 'WEB_PORTAL'
      };

      const res = await api.post('/attendance/clock-in/', payload);
      const attData = res.data.attendance || res.data;
      setIsClockedIn(true);
      setActiveAttendance(attData);
      setTodayAttendance(attData);
      setWorkMode(attData.work_mode || mode);
      speakText(`Clock in successful. Welcome to your shift.`);
      fetchEmployeeData();
      fetchTasks();
    } catch (err) {
      console.error("Clock-in error:", err.response?.data);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || 'Clock-in failed. Please check your network connection.';
      alert(errMsg);
    }
  };

  const handleClockOut = async () => {
    if (!window.confirm("Are you sure you want to end your shift and clock out?")) return;
    try {
      const res = await api.post('/attendance/clock-out/');
      setIsClockedIn(false);
      setActiveAttendance(null);
      setTodayAttendance(res.data);
      speakText(`Clock out confirmed. You worked ${res.data.working_hours || 0} hours today. Have a great evening.`);
      fetchEmployeeData();
      fetchTasks();
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Clock-out failed');
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    try {
      const res = await api.post('/attendance/tasks/', {
        title: newTask.title.trim(),
        description: newTask.description?.trim() || null,
        planned_tasks: newTask.planned_tasks?.trim() || null,
        completed_tasks: newTask.completed_tasks?.trim() || null,
        hours_spent: parseFloat(newTask.hours_spent) || 0.0,
        blockers: newTask.blockers?.trim() || null,
        status: newTask.status
      });
      setTasks(prev => [res.data, ...prev]);
      setNewTask({
        title: '',
        description: '',
        planned_tasks: '',
        completed_tasks: '',
        hours_spent: '1.0',
        blockers: '',
        status: 'TODO'
      });
      setIsAddTaskOpen(false);
      alert('Shift task logged successfully!');
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to create task');
    }
  };

  const handleUpdateTaskStatus = async (taskId, newStatus) => {
    try {
      const res = await api.patch(`/attendance/tasks/${taskId}/`, { status: newStatus });
      setTasks(prev => prev.map(t => t.id === taskId ? res.data : t));
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.delete(`/attendance/tasks/${taskId}/`);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      alert(err.response?.data?.error || err.response?.data?.message || 'Failed to delete task');
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leaves/', {
        leave_type: parseInt(leaveForm.leave_type),
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason
      });
      alert('Leave application submitted for approval.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Leave submission failed.');
    }
  };

  const handleApplyWFH = async (e) => {
    e.preventDefault();
    try {
      await api.post('/wfh/', {
        date: wfhForm.date,
        reason: wfhForm.reason
      });
      alert('WFH request submitted for CEO/HR approval.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'WFH submission failed.');
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attendance/corrections/', {
        date: corrForm.date,
        requested_check_in: new Date(corrForm.date + 'T' + corrForm.requested_check_in).toISOString(),
        reason: corrForm.reason
      });
      alert('Attendance correction request submitted.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Correction submission failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* EMPLOYEE HEADER & QUICK ACTIONS */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4 w-full md:w-auto">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-xl sm:text-2xl font-black shadow-lg shadow-brand-500/25 shrink-0">
            {profile?.first_name ? profile.first_name[0] : 'E'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">{profile?.first_name} {profile?.last_name}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30 font-mono shrink-0">
                {profile?.employee_id || 'EMP-1001'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 truncate">
              {profile?.designation || 'Staff Member'} • {profile?.department || 'General'} • Work Mode: <span className="text-indigo-400 font-semibold">{profile?.work_mode || 'OFFICE'}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 md:flex md:flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button
            onClick={() => setActiveModal('APPLY_LEAVE')}
            className="px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4 text-purple-400 shrink-0" /> Apply Leave
          </button>
          <button
            onClick={() => setActiveModal('APPLY_WFH')}
            className="px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Plus className="w-4 h-4 text-indigo-400 shrink-0" /> Apply WFH
          </button>
          <button
            onClick={() => setActiveModal('CORRECTION')}
            className="px-3.5 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-colors active:scale-95"
          >
            <Clock className="w-4 h-4 text-amber-400 shrink-0" /> Correct Attendance
          </button>
        </div>
      </div>

      {/* SHIFT CLOCK IN/OUT WIDGET */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 relative overflow-hidden">
          {isClockedIn && (
            <div className="absolute inset-0 bg-emerald-500/5 animate-[pulse_3s_ease-in-out_infinite] pointer-events-none" />
          )}
          
          <div className="space-y-1.5 sm:space-y-2 z-10 text-center md:text-left w-full md:w-auto">
            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isClockedIn ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
              {isClockedIn ? 'Shift Active' : 'Off Duty'}
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-white font-sans">
              {isClockedIn ? `Clocked In (${workMode})` : 'Start Your Work Day'}
            </h2>
            <p className="text-xs text-slate-400">
              {isClockedIn 
                ? 'Your working hours are being tracked in real time.' 
                : 'Please select your work mode to check-in.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 z-10 w-full md:w-auto">
            {isClockedIn ? (
              <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 w-full sm:w-auto">
                <div className="text-center bg-slate-950 px-4 py-2 rounded-2xl border border-slate-800 w-full sm:w-auto">
                  <span className="text-[10px] text-slate-500 block font-bold uppercase tracking-wider">Elapsed Time</span>
                  <span className="font-mono text-xl font-black text-emerald-400 tracking-wider">{shiftDuration}</span>
                </div>
                
                <button
                  onClick={handleClockOut}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" /> Clock Out
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value)}
                  className="w-full sm:w-auto px-3.5 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="OFFICE">🏢 In-Office</option>
                  <option value="WFH">🏠 Remote (WFH)</option>
                </select>

                <button
                  onClick={handleClockIn}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-950/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <Play className="w-4 h-4" /> Clock In
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Shift Stats Card */}
        <div className="glass-panel p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-800 flex flex-col justify-center gap-1.5 bg-gradient-to-br from-slate-900 to-slate-900/60">
          <p className="text-xs font-semibold text-slate-400">Total Clocked Hours Today</p>
          <p className="text-2xl sm:text-3xl font-black text-white">{todayAttendance?.working_hours || '0.00'} <span className="text-sm font-semibold text-slate-400">hours</span></p>
          <div className="w-full bg-slate-955 h-1.5 rounded-full overflow-hidden mt-2">
            <div 
              className="h-full bg-brand-500 transition-all duration-500" 
              style={{ width: `${Math.min((parseFloat(todayAttendance?.working_hours || '0') / 8) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* TODAY'S ATTENDANCE STATUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Check-In</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {todayAttendance?.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Checked In'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Check-Out</p>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {todayAttendance?.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending Check-Out'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Working Hours</p>
          <p className="text-xl font-bold text-white mt-1">{todayAttendance?.working_hours || '0.00'} hrs</p>
        </div>
      </div>

      {/* TASK TRACKER SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-indigo-400" /> Shift Task Tracker
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage and log your tasks during active working hours</p>
          </div>
          
          <button
            onClick={() => {
              if (!isClockedIn) {
                alert("Please clock in to start tracking tasks for today!");
                return;
              }
              setIsAddTaskOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>

        {!isClockedIn ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-10 h-10 text-slate-600 animate-pulse" />
            <div>
              <p className="text-sm font-bold text-slate-400">Task Tracker Offline</p>
              <p className="text-xs text-slate-500 mt-1">Please clock in (start shift) to create or manage your tasks.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* To Do Column */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4 bg-slate-900/20">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-black text-slate-300 tracking-wide uppercase">To Do ({tasks.filter(t => t.status === 'TODO').length})</h3>
                <span className="w-2 h-2 rounded-full bg-slate-500" />
              </div>
              <div className="space-y-3 min-h-[150px]">
                {tasks.filter(t => t.status === 'TODO').map(task => (
                  <div key={task.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative group">
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center justify-between pr-4">
                        <h4 className="text-xs font-bold text-white">{task.title}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{task.hours_spent}h</span>
                      </div>
                      {task.planned_tasks && (
                        <div className="mt-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 text-[10px] whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-indigo-400 block mb-0.5">📋 Planned Objectives:</span>
                          {task.planned_tasks}
                        </div>
                      )}
                      {task.completed_tasks && (
                        <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[10px] whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-emerald-400 block mb-0.5">✅ Work Accomplished:</span>
                          {task.completed_tasks}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'IN_PROGRESS')}
                      className="w-full py-1.5 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-[10px] font-bold rounded-lg border border-indigo-500/20 transition-all flex items-center justify-center gap-1"
                    >
                      Start Work <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {tasks.filter(t => t.status === 'TODO').length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-6">No pending tasks</p>
                )}
              </div>
            </div>

            {/* In Progress Column */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4 bg-slate-900/20">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-black text-indigo-400 tracking-wide uppercase">In Progress ({tasks.filter(t => t.status === 'IN_PROGRESS').length})</h3>
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
              </div>
              <div className="space-y-3 min-h-[150px]">
                {tasks.filter(t => t.status === 'IN_PROGRESS').map(task => (
                  <div key={task.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative group">
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center justify-between pr-4">
                        <h4 className="text-xs font-bold text-white">{task.title}</h4>
                        <span className="text-[10px] font-mono text-indigo-400 font-bold">{task.hours_spent}h</span>
                      </div>
                      {task.planned_tasks && (
                        <div className="mt-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 text-[10px] whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-indigo-400 block mb-0.5">📋 Planned Objectives:</span>
                          {task.planned_tasks}
                        </div>
                      )}
                      {task.completed_tasks && (
                        <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[10px] whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-emerald-400 block mb-0.5">✅ Work Accomplished:</span>
                          {task.completed_tasks}
                        </div>
                      )}
                      {task.blockers && (
                        <div className="mt-1.5 p-1.5 rounded-md bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[10px]">
                          <span className="font-bold">Blocker: </span>{task.blockers}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleUpdateTaskStatus(task.id, 'DONE')}
                      className="w-full py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20 transition-all flex items-center justify-center gap-1"
                    >
                      Mark Done
                    </button>
                  </div>
                ))}
                {tasks.filter(t => t.status === 'IN_PROGRESS').length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-6">No tasks in progress</p>
                )}
              </div>
            </div>

            {/* Done Column */}
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4 bg-slate-900/20">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-xs font-black text-emerald-400 tracking-wide uppercase">Done ({tasks.filter(t => t.status === 'DONE').length})</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-3 min-h-[150px]">
                {tasks.filter(t => t.status === 'DONE').map(task => (
                  <div key={task.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 relative group">
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="absolute top-3 right-3 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div>
                      <div className="flex items-center justify-between pr-4">
                        <h4 className="text-xs font-bold text-slate-300 line-through">{task.title}</h4>
                        <span className="text-[10px] font-mono text-emerald-400 font-bold">{task.hours_spent}h</span>
                      </div>
                      {task.planned_tasks && (
                        <div className="mt-2 p-2 rounded-lg bg-indigo-950/20 border border-indigo-500/10 text-indigo-300/80 text-[10px] line-through">
                          {task.planned_tasks}
                        </div>
                      )}
                      {task.completed_tasks && (
                        <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[10px] whitespace-pre-wrap leading-relaxed">
                          <span className="font-bold text-emerald-400 block mb-0.5">✅ Work Accomplished:</span>
                          {task.completed_tasks}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 py-1.5 text-emerald-400 text-[10px] font-extrabold bg-emerald-500/5 rounded-lg border border-emerald-500/10">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                    </div>
                  </div>
                ))}
                {tasks.filter(t => t.status === 'DONE').length === 0 && (
                  <p className="text-[11px] text-slate-600 text-center py-6">No completed tasks yet</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ATTENDANCE HISTORY TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-brand-400" /> Recent Attendance Records
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Check-In</th>
                <th className="p-3">Check-Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Work Mode</th>
                <th className="p-3">Method</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {attendances.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-500">No attendance records found</td></tr>
              ) : (
                attendances.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{a.date}</td>
                    <td className="p-3 text-slate-300">{a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 text-slate-300">{a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 font-bold text-slate-200">{a.working_hours} h</td>
                    <td className="p-3 text-slate-300">{a.work_mode}</td>
                    <td className="p-3 text-slate-400">{a.attendance_method}</td>
                    <td className="p-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD TASK MODAL */}
      <Modal isOpen={isAddTaskOpen} onClose={() => setIsAddTaskOpen(false)} title="Add Task">
        <form onSubmit={handleAddTask} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title</label>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              required
              placeholder="e.g. Implement layout dashboard"
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={3}
              placeholder="Provide a brief summary of this task..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setIsAddTaskOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow-lg">Save Task</button>
          </div>
        </form>
      </Modal>

      {/* APPLY LEAVE MODAL */}
      <Modal isOpen={activeModal === 'APPLY_LEAVE'} onClose={() => setActiveModal(null)} title="Apply for Leave">
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Type</label>
            <select
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Select Leave Type --</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} (Max {t.days_allowed} days)</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason</label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              required
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow-lg">Submit Application</button>
          </div>
        </form>
      </Modal>

      {/* APPLY WFH MODAL */}
      <Modal isOpen={activeModal === 'APPLY_WFH'} onClose={() => setActiveModal(null)} title="Apply for Work From Home">
        <form onSubmit={handleApplyWFH} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target WFH Date</label>
            <input
              type="date"
              value={wfhForm.date}
              onChange={(e) => setWfhForm({ ...wfhForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Remote Work</label>
            <textarea
              value={wfhForm.reason}
              onChange={(e) => setWfhForm({ ...wfhForm, reason: e.target.value })}
              required
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-lg">Submit WFH Request</button>
          </div>
        </form>
      </Modal>

      {/* ATTENDANCE CORRECTION MODAL */}
      <Modal isOpen={activeModal === 'CORRECTION'} onClose={() => setActiveModal(null)} title="Request Attendance Correction">
        <form onSubmit={handleCorrectionSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Attendance Date</label>
            <input
              type="date"
              value={corrForm.date}
              onChange={(e) => setCorrForm({ ...corrForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Correct Requested Check-In Time</label>
            <input
              type="time"
              value={corrForm.requested_check_in}
              onChange={(e) => setCorrForm({ ...corrForm, requested_check_in: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Justification Reason</label>
            <textarea
              value={corrForm.reason}
              onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="Explain why check-in was missed..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl shadow-lg">Submit Correction Request</button>
          </div>
        </form>
      </Modal>

      {/* LOG / ADD SHIFT TASK MODAL */}
      <Modal isOpen={isAddTaskOpen} onClose={() => setIsAddTaskOpen(false)} title="Log Daily Shift Task & Deliverables">
        <form onSubmit={handleAddTask} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title / Shift Goal</label>
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g. Implement Client Dashboard Authentication"
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-indigo-300 mb-1">
              📋 Planned Deliverables (Daily Target Objectives)
            </label>
            <textarea
              value={newTask.planned_tasks}
              onChange={(e) => setNewTask({ ...newTask, planned_tasks: e.target.value })}
              rows={3}
              placeholder="1. Build registration endpoints&#10;2. Add JWT auth logic&#10;3. Run test cases"
              className="w-full p-2.5 bg-slate-900 border border-indigo-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300 mb-1">
              ✅ Work Accomplished (Actual Execution & Output)
            </label>
            <textarea
              value={newTask.completed_tasks}
              onChange={(e) => setNewTask({ ...newTask, completed_tasks: e.target.value })}
              rows={3}
              placeholder="Completed registration endpoints, verified test suite..."
              className="w-full p-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hours Logged on Task</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={newTask.hours_spent}
                onChange={(e) => setNewTask({ ...newTask, hours_spent: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={newTask.status}
                onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
              >
                <option value="TODO">To Do (Planned)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done / Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-rose-300 mb-1">Blockers / Challenges (Optional)</label>
            <input
              type="text"
              value={newTask.blockers}
              onChange={(e) => setNewTask({ ...newTask, blockers: e.target.value })}
              placeholder="e.g. Waiting on API credentials..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddTaskOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg"
            >
              Save Shift Task Log
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeeDashboard;

