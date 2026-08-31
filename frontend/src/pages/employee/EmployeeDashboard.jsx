import React, { useState, useEffect, useRef } from 'react';
import {
  User, CalendarCheck, Home, FileText, Clock, Plus, Camera,
  MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck,
  Play, LogOut, CheckSquare, Trash2, CheckCircle2, AlertCircle,
  Layers, Monitor, Lock, Unlock, Sparkles, Calendar as CalendarIcon, Hourglass
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import LoadingState from '../../components/common/states/LoadingState';
import FormError from '../../components/common/states/FormError';

export const EmployeeDashboard = () => {
  const { user, companyName } = useAuth();
  const { addToast } = useAppState();
  const [profile, setProfile] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [screenTimeStats, setScreenTimeStats] = useState({ today: '0h 00m', weekly: '0h 00m' });
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'APPLY_LEAVE', 'APPLY_WFH', 'CORRECTION'
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);

  // Form states
  const [leaveForm, setLeaveForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
  const [leaveFormErrors, setLeaveFormErrors] = useState({});
  const [wfhForm, setWfhForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });
  const [wfhFormErrors, setWfhFormErrors] = useState({});
  const [corrForm, setCorrForm] = useState({ date: '', requested_check_in: '', reason: '' });
  const [corrFormErrors, setCorrFormErrors] = useState({});
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState(null);

  // Shift & Timing states
  const [shiftStatus, setShiftStatus] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [workMode, setWorkMode] = useState('OFFICE'); // 'OFFICE' | 'WFH'
  const [shiftDuration, setShiftDuration] = useState('00:00:00');
  const [canClockOut, setCanClockOut] = useState(false);
  const [unlockTimeFormatted, setUnlockTimeFormatted] = useState('');
  const [timeRemainingFormatted, setTimeRemainingFormatted] = useState('');
  const [shiftProgressPercent, setShiftProgressPercent] = useState(0);

  const [shiftReport, setShiftReport] = useState(null);
  const [reportContent, setReportContent] = useState('');
  const [isReportSaving, setIsReportSaving] = useState(false);
  const [isEditingReport, setIsEditingReport] = useState(true);

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
      const [userRes, attRes, typeRes, sumRes, screenRes, shiftRes] = await Promise.all([
        api.get('/auth/me/'),
        api.get('/attendance/'),
        api.get('/leaves/types/'),
        api.get('/leaves/balances/summary/').catch(() => ({ data: {} })),
        api.get('/tracking/screen-time/summary/').catch(() => ({ data: {} })),
        api.get('/attendance/shift-status/').catch(() => ({ data: null }))
      ]);

      setProfile(userRes.data);
      const attList = attRes.data.results || attRes.data || [];
      setAttendances(attList);
      setLeaveTypes(typeRes.data.results || typeRes.data || []);
      if (sumRes.data?.my_summary) {
        setLeaveSummary(sumRes.data.my_summary);
      }

      if (screenRes.data?.results && screenRes.data.results.length > 0) {
        const myScreen = screenRes.data.results[0];
        setScreenTimeStats({
          today: myScreen.today_screen_time || '0h 00m',
          weekly: myScreen.weekly_screen_time || '0h 00m'
        });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = attList.find(a => a.date === todayStr);
      setTodayAttendance(todayRec);

      if (shiftRes.data) {
        setShiftStatus(shiftRes.data);
      }

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

  const fetchShiftReport = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await api.get('/attendance/shift-reports/', { params: { date: todayStr } });
      const reports = res.data.results || res.data || [];
      const todayReport = reports.find(r => r.date === todayStr);
      if (todayReport) {
        setShiftReport(todayReport);
        setReportContent(todayReport.report_content);
        setIsEditingReport(false);
      } else {
        setShiftReport(null);
        setReportContent('');
        setIsEditingReport(true);
      }
    } catch (e) {
      console.error("Error loading shift report:", e);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
    fetchShiftReport();
  }, []);

  // Update timer and exact shift clock-out unlock dynamically every second
  useEffect(() => {
    let interval = null;
    if (isClockedIn && activeAttendance && activeAttendance.check_in) {
      const calculateDurationAndUnlock = () => {
        const start = new Date(activeAttendance.check_in).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, now - start);

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setShiftDuration(
          `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        );

        // Required hours based on half-day or full-day
        const requiredHours = shiftStatus?.required_working_hours || (profile?.is_half_day ? 4.0 : 8.0);
        const requiredMillis = requiredHours * 60 * 60 * 1000;
        const unlockTime = start + requiredMillis;
        const remainingMillis = Math.max(0, unlockTime - now);

        const isUnlocked = now >= unlockTime;
        setCanClockOut(isUnlocked);

        // Format unlock time (e.g. "05:00 PM")
        const unlockDate = new Date(unlockTime);
        setUnlockTimeFormatted(unlockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        // Shift progress percentage (0 - 100)
        const progress = Math.min(100, Math.round((diff / requiredMillis) * 100));
        setShiftProgressPercent(progress);

        // Format remaining countdown (e.g. "02h 15m 30s")
        if (remainingMillis > 0) {
          const remH = Math.floor(remainingMillis / (1000 * 60 * 60));
          const remM = Math.floor((remainingMillis % (1000 * 60 * 60)) / (1000 * 60));
          const remS = Math.floor((remainingMillis % (1000 * 60)) / 1000);
          setTimeRemainingFormatted(`${remH}h ${String(remM).padStart(2, '0')}m ${String(remS).padStart(2, '0')}s`);
        } else {
          setTimeRemainingFormatted('0h 00m 00s');
        }
      };

      calculateDurationAndUnlock();
      interval = setInterval(calculateDurationAndUnlock, 1000);
    } else {
      setShiftDuration('00:00:00');
      setCanClockOut(false);
      setTimeRemainingFormatted('');
    }
    return () => clearInterval(interval);
  }, [isClockedIn, activeAttendance, shiftStatus, profile]);

  const handleClockIn = async () => {
    try {
      const payload = {
        attendance_method: 'WEB_PORTAL'
      };

      const res = await api.post('/attendance/clock-in/', payload);
      const attData = res.data.attendance || res.data;
      setIsClockedIn(true);
      setActiveAttendance(attData);
      setTodayAttendance(attData);
      setWorkMode(attData.work_mode || 'OFFICE');
      speakText(`Clock in successful. Welcome to your shift.`);
      addToast('Clock-in confirmed! Welcome to your shift.', 'success');
      fetchEmployeeData();
      fetchShiftReport();
    } catch (err) {
      console.error("Clock-in error:", err.response?.data);
      const errMsg = err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || 'Clock-in failed. Please check your network connection.';
      addToast(errMsg, 'error');
    }
  };

  const handleClockOut = async () => {
    try {
      const res = await api.post('/attendance/clock-out/');
      const updatedAttendance = res.data.attendance || res.data;
      setIsClockedIn(false);
      setActiveAttendance(null);
      setTodayAttendance(updatedAttendance);
      speakText(`Clock out confirmed. You worked ${updatedAttendance.working_hours || 0} hours today. Have a great evening.`);
      addToast(`Clock-out confirmed. Shift duration: ${updatedAttendance.working_hours || 0}h`, 'success');
      setClockOutConfirmOpen(false);
      fetchEmployeeData();
      fetchShiftReport();
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.message || 'Clock-out failed', 'error');
    }
  };

  const handleSaveReport = async () => {
    if (!reportContent.trim()) {
      addToast('Please enter your report content before saving.', 'error');
      return;
    }
    try {
      setIsReportSaving(true);
      const todayStr = new Date().toISOString().split('T')[0];
      if (shiftReport) {
        await api.patch(`/attendance/shift-reports/${shiftReport.id}/`, {
          report_content: reportContent
        });
        addToast('Shift report updated successfully.', 'success');
      } else {
        const res = await api.post('/attendance/shift-reports/', {
          date: todayStr,
          report_content: reportContent
        });
        setShiftReport(res.data);
        addToast('Shift report submitted successfully.', 'success');
      }
      setIsEditingReport(false);
    } catch (err) {
      console.error("Shift report save error:", err);
      addToast(err.response?.data?.error || 'Failed to save shift report.', 'error');
    } finally {
      setIsReportSaving(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLeaveFormErrors({});
    const errors = {};
    if (!leaveForm.leave_type) errors.leave_type = 'Please select a leave category';
    if (!leaveForm.start_date) errors.start_date = 'Start date is required';
    if (!leaveForm.end_date) errors.end_date = 'End date is required';
    if (!leaveForm.reason.trim()) errors.reason = 'Justification reason is required';

    if (Object.keys(errors).length > 0) {
      setLeaveFormErrors(errors);
      return;
    }

    try {
      await api.post('/leaves/requests/', leaveForm);
      addToast('Leave request submitted successfully.', 'success');
      setActiveModal(null);
      setLeaveForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setLeaveFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit leave request.', 'error');
    }
  };

  const handleApplyWFH = async (e) => {
    e.preventDefault();
    setWfhFormErrors({});
    const errors = {};
    if (!wfhForm.date) errors.date = 'Date is required';
    if (!wfhForm.reason.trim()) errors.reason = 'Reason is required';

    if (Object.keys(errors).length > 0) {
      setWfhFormErrors(errors);
      return;
    }

    try {
      await api.post('/wfh/requests/', wfhForm);
      addToast('WFH application submitted for manager approval.', 'success');
      setActiveModal(null);
      setWfhForm({ date: new Date().toISOString().split('T')[0], reason: '' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setWfhFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit WFH request.', 'error');
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    setCorrFormErrors({});
    const errors = {};
    if (!corrForm.date) errors.date = 'Date is required';
    if (!corrForm.requested_check_in) errors.requested_check_in = 'Check-in time is required';
    if (!corrForm.reason.trim()) errors.reason = 'Reason is required';

    if (Object.keys(errors).length > 0) {
      setCorrFormErrors(errors);
      return;
    }

    try {
      const payload = {
        date: corrForm.date,
        requested_check_in: `${corrForm.date}T${corrForm.requested_check_in}:00`,
        reason: corrForm.reason
      };
      await api.post('/attendance/corrections/', payload);
      addToast('Attendance correction request filed.', 'success');
      setActiveModal(null);
      setCorrForm({ date: '', requested_check_in: '', reason: '' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setCorrFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to file correction request.', 'error');
    }
  };

  if (loading) {
    return <LoadingState message="Loading your employee portal..." />;
  }

  const isMandatoryHoliday = Boolean(shiftStatus?.is_holiday);
  const isOnApprovedLeave = Boolean(shiftStatus?.is_on_leave);
  const requiredHoursDisplay = shiftStatus?.required_working_hours || (profile?.is_half_day ? 4.0 : 8.0);

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-r from-slate-900/90 via-brand-950/20 to-slate-900/90 backdrop-blur-2xl">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
              {companyName || 'FRG Workspace'} Portal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {profile?.is_half_day ? 'Half-Day Shift (4h)' : 'Full-Day Shift (8h)'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Welcome back, {user?.first_name || 'Team Member'}
          </h1>
          <p className="text-sm text-slate-400 max-w-xl">
            Real-time shift governance, leave administration, and daily accomplishment reporting.
          </p>
        </div>

        {/* QUICK ACTIONS BAR */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          <button
            onClick={() => setActiveModal('APPLY_LEAVE')}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-900/30 flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 shrink-0" /> Apply Leave
          </button>
          <button
            onClick={() => setActiveModal('APPLY_WFH')}
            className="px-4 py-2.5 bg-indigo-600/80 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-900/30 flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_20px_-5px_rgba(79,70,229,0.5)] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4 shrink-0" /> Apply WFH
          </button>
          <button
            onClick={() => setActiveModal('CORRECTION')}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl border border-white/10 flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_20px_-5px_rgba(251,191,36,0.2)] hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-amber-400 shrink-0" /> Correct Attendance
          </button>
        </div>
      </div>

      {/* SHIFT CLOCK IN / OUT WIDGET & HOLIDAY / LEAVE BANNER */}
      <div className="w-full relative group">
        {/* CASE 1: TODAY IS A MANDATORY HOLIDAY (SUNDAY / 2ND SATURDAY / DB HOLIDAY) */}
        {isMandatoryHoliday ? (
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-2xl opacity-25 bg-rose-500 transition-all duration-1000" />
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-rose-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-r from-slate-900/90 via-rose-950/20 to-slate-900/90 shadow-2xl">
              <div className="space-y-2 z-10 text-center md:text-left w-full md:w-auto">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                  <Sparkles className="w-4 h-4 text-rose-400" /> Mandatory Holiday • Office Closed
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">
                  {shiftStatus?.holiday_title || 'Mandatory Holiday'}
                </h2>
                <p className="text-sm text-slate-300 font-medium max-w-2xl">
                  Today is an official non-working holiday. Office attendance tracking and clock-in are disabled for the day. Enjoy your holiday!
                </p>
              </div>

              <div className="flex items-center gap-3 z-10 bg-slate-900/80 px-6 py-4 rounded-2xl border border-rose-500/20 shadow-inner">
                <CalendarIcon className="w-6 h-6 text-rose-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Office Status</span>
                  <span className="text-sm font-bold text-rose-400">Closed for Holiday</span>
                </div>
              </div>
            </div>
          </div>
        ) : isOnApprovedLeave ? (
          /* CASE 2: EMPLOYEE IS ON APPROVED LEAVE TODAY */
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-2xl opacity-25 bg-emerald-500 transition-all duration-1000" />
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-r from-slate-900/90 via-emerald-950/20 to-slate-900/90 shadow-2xl">
              <div className="space-y-2 z-10 text-center md:text-left w-full md:w-auto">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <CalendarCheck className="w-4 h-4 text-emerald-400" /> Approved Leave • Off Duty
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">
                  {shiftStatus?.leave_title || 'Approved Leave'}
                </h2>
                <p className="text-sm text-slate-300 font-medium max-w-2xl">
                  You have an approved leave record scheduled for today. Clock-in and clock-out buttons are disabled.
                </p>
              </div>

              <div className="flex items-center gap-3 z-10 bg-slate-900/80 px-6 py-4 rounded-2xl border border-emerald-500/20 shadow-inner">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Leave Status</span>
                  <span className="text-sm font-bold text-emerald-400">Approved & Active</span>
                </div>
              </div>
            </div>
          </div>
        ) : todayAttendance?.check_out ? (
          /* CASE 3: SHIFT COMPLETED FOR TODAY */
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-2xl opacity-20 bg-indigo-500 transition-all duration-1000" />
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-indigo-500/20 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden backdrop-blur-2xl bg-gradient-to-r from-slate-900/90 via-indigo-950/20 to-slate-900/90">
              <div className="space-y-2 z-10 text-center md:text-left w-full md:w-auto">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" /> Shift Completed for Today
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">
                  Work Day Completed
                </h2>
                <p className="text-sm text-slate-400 font-medium">
                  You have completed your shift and checked out for today. Attendance is locked until tomorrow.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 z-10 w-full md:w-auto">
                <div className="flex items-center gap-3 bg-black/40 px-5 py-3 rounded-2xl border border-white/5 shadow-inner">
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">In</span>
                    <span className="font-mono text-sm font-bold text-emerald-400">
                      {todayAttendance.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-700" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Out</span>
                    <span className="font-mono text-sm font-bold text-indigo-400">
                      {new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-700" />
                  <div className="text-center">
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Total</span>
                    <span className="font-mono text-sm font-bold text-amber-400">
                      {todayAttendance.working_hours || 0}h
                    </span>
                  </div>
                </div>

                <div className="px-5 py-3.5 bg-slate-800/80 border border-slate-700/70 text-slate-300 font-bold text-xs rounded-2xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Day Completed
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* CASE 4: REGULAR WORKING DAY (ACTIVE SHIFT OR OFF DUTY) */
          <div className="relative">
            <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-20 transition-all duration-1000 ${isClockedIn ? 'bg-emerald-500 opacity-30 group-hover:opacity-50' : 'bg-brand-500 opacity-20 group-hover:opacity-40'}`} />
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 flex flex-col lg:flex-row items-center justify-between gap-6 relative overflow-hidden backdrop-blur-2xl">
              {isClockedIn && (
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
              )}
              
              <div className="space-y-2 z-10 text-center lg:text-left w-full lg:w-auto">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${isClockedIn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-slate-800/80 text-slate-400 border border-slate-700'}`}>
                  {isClockedIn && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  {isClockedIn ? `Shift Active (${workMode})` : 'Off Duty'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white font-sans tracking-tight">
                  {isClockedIn ? `Work Shift in Progress` : 'Start Your Work Day'}
                </h2>
                <p className="text-sm text-slate-400 font-medium max-w-xl">
                  {isClockedIn 
                    ? `Shift duration is set to ${requiredHoursDisplay} hours. Clock-out unlocks precisely once the required working hours are completed.`
                    : `Check-in is permitted once per working day for ${requiredHoursDisplay}h shift duration.`}
                </p>

                {/* Progress bar towards shift unlock when clocked in */}
                {isClockedIn && (
                  <div className="pt-2 max-w-md">
                    <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
                      <span>Shift Progress ({requiredHoursDisplay}h)</span>
                      <span className="text-emerald-400 font-mono">{shiftProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/5">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{ width: `${shiftProgressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 z-10 w-full lg:w-auto">
                {isClockedIn ? (
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    {/* Elapsed Time Counter */}
                    <div className="text-center bg-black/40 px-5 py-3.5 rounded-2xl border border-white/5 w-full sm:w-auto shadow-inner">
                      <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-widest mb-0.5">Elapsed Time</span>
                      <span className="font-mono text-2xl font-black text-emerald-400 tracking-wider [text-shadow:0_0_10px_rgba(16,185,129,0.5)]">
                        {shiftDuration}
                      </span>
                    </div>

                    {/* Clock-Out Action: Unlocked vs Locked */}
                    {canClockOut ? (
                      <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-pulse">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Shift Met ({requiredHoursDisplay}h)</span>
                        </div>
                        <button
                          onClick={() => setClockOutConfirmOpen(true)}
                          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm rounded-2xl shadow-[0_0_30px_-5px_rgba(225,29,72,0.5)] flex items-center justify-center gap-2 transition-all active:scale-95 hover:-translate-y-1 cursor-pointer"
                        >
                          <LogOut className="w-5 h-5" /> Clock Out
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold">
                          <Hourglass className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                          <span>Unlocks at <strong>{unlockTimeFormatted}</strong></span>
                          <span className="font-mono text-amber-400 font-bold">({timeRemainingFormatted})</span>
                        </div>
                        <button
                          disabled={true}
                          onClick={() => addToast(`Clock-out will unlock at ${unlockTimeFormatted} after completing your ${requiredHoursDisplay}h shift.`, 'warning')}
                          className="w-full sm:w-auto px-8 py-3.5 bg-slate-800/80 border border-slate-700/80 text-slate-400 font-bold text-sm rounded-2xl flex items-center justify-center gap-2 cursor-not-allowed opacity-75 shadow-inner"
                          title={`Clock-out unlocks at ${unlockTimeFormatted} (${timeRemainingFormatted} remaining)`}
                        >
                          <Lock className="w-4 h-4 text-amber-400" /> Clock Out (Locked)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleClockIn()}
                      className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-black text-sm rounded-2xl shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 transition-all active:scale-95 hover:-translate-y-1 cursor-pointer"
                    >
                      <Play className="w-5 h-5 fill-white" /> Clock In
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* TODAY'S ATTENDANCE & SCREEN TIME STATUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-900/60 shadow-xl group hover:border-emerald-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Check-In</p>
          <p className="text-2xl font-black text-emerald-400 mt-2 font-mono">
            {todayAttendance?.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Checked In'}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-900/60 shadow-xl group hover:border-indigo-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all" />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Check-Out</p>
          <p className="text-2xl font-black text-indigo-400 mt-2 font-mono">
            {todayAttendance?.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (isClockedIn ? `Unlocks ~ ${unlockTimeFormatted || 'End of Shift'}` : 'Pending Check-Out')}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-900/60 shadow-xl group hover:border-cyan-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Today's Screen Time</p>
            <Monitor className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-cyan-400 mt-2 font-mono">
            {screenTimeStats.today}
          </p>
        </div>

        <div className="relative overflow-hidden p-6 rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-900/60 shadow-xl group hover:border-purple-500/30 transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all" />
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Weekly Screen Time</p>
            <Monitor className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400 mt-2 font-mono">
            {screenTimeStats.weekly}
          </p>
        </div>
      </div>

      {/* SHIFT REPORT & LEAVE BALANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* SHIFT WORK REPORT */}
        <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-slate-900/40 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Daily Accomplishment Report</h3>
                <p className="text-xs text-slate-400">Document your completed deliverables and ongoing milestones</p>
              </div>
            </div>

            {shiftReport && !isEditingReport && (
              <button
                onClick={() => setIsEditingReport(true)}
                className="text-xs font-bold text-brand-400 hover:text-brand-300 underline"
              >
                Edit Report
              </button>
            )}
          </div>

          {isEditingReport ? (
            <div className="space-y-4">
              <textarea
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                placeholder="Detail today's achievements, completed tickets, meetings attended, and blockers..."
                rows={5}
                className="w-full p-4 rounded-2xl bg-slate-950/60 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/40 transition-all placeholder:text-slate-600 resize-none font-sans"
              />
              <div className="flex justify-end">
                <button
                  onClick={handleSaveReport}
                  disabled={isReportSaving}
                  className="px-6 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-900/30 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4" />
                  {isReportSaving ? 'Saving...' : 'Save Shift Report'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-5 rounded-2xl bg-slate-950/40 border border-white/5 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
              {shiftReport?.report_content}
            </div>
          )}
        </div>

        {/* LEAVE BALANCE SUMMARY */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Leave Balances</h3>
                <p className="text-xs text-slate-400">Annual accrued entitlement</p>
              </div>
            </div>

            <div className="space-y-3">
              {leaveSummary && leaveSummary.balances && leaveSummary.balances.length > 0 ? (
                leaveSummary.balances.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">{b.leave_type_name}</p>
                      <p className="text-[10px] text-slate-400">{b.leave_type_code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-400 font-mono">{b.remaining_days} left</p>
                      <p className="text-[10px] text-slate-500">of {b.allocated_days} days</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">No active leave quota found.</p>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 mt-4">
            <button
              onClick={() => setActiveModal('APPLY_LEAVE')}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Request Leave
            </button>
          </div>
        </div>
      </div>

      {/* RECENT ATTENDANCE HISTORY LOG */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Recent Attendance Logs</h3>
              <p className="text-xs text-slate-400">Your logged working days and shift statuses</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Check In</th>
                <th className="py-3 px-4">Check Out</th>
                <th className="py-3 px-4">Hours</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {attendances.slice(0, 10).map((att) => (
                <tr key={att.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-slate-300 font-bold">{att.date}</td>
                  <td className="py-3 px-4 font-mono text-xs text-emerald-400">
                    {att.check_in ? new Date(att.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-indigo-400">
                    {att.check_out ? new Date(att.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-amber-400 font-bold">{att.working_hours || 0}h</td>
                  <td className="py-3 px-4">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                      {att.work_mode || 'OFFICE'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={att.status} />
                  </td>
                </tr>
              ))}
              {attendances.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs font-medium">
                    No attendance records logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* APPLY LEAVE MODAL */}
      <Modal isOpen={activeModal === 'APPLY_LEAVE'} onClose={() => setActiveModal(null)} title="Apply for Leave">
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Category</label>
            <select
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
              ))}
            </select>
            <FormError message={leaveFormErrors.leave_type} id="leave-type-err" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <FormError message={leaveFormErrors.start_date} id="leave-start-err" />
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
              <FormError message={leaveFormErrors.end_date} id="leave-end-err" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Notes</label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="State reason for leave request..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
            <FormError message={leaveFormErrors.reason} id="leave-reason-err" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Submit Application
            </button>
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
            <FormError message={wfhFormErrors.date} id="wfh-date-err" />
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
            <FormError message={wfhFormErrors.reason} id="wfh-reason-err" />
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
            <FormError message={corrFormErrors.date} id="corr-date-err" />
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
            <FormError message={corrFormErrors.reason} id="corr-reason-err" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl shadow-lg">Submit Correction Request</button>
          </div>
        </form>
      </Modal>

      {/* CLOCK-OUT CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={clockOutConfirmOpen}
        onClose={() => setClockOutConfirmOpen(false)}
        onConfirm={handleClockOut}
        title="Confirm Check Out"
        message="Are you sure you want to check out? Once you check out, you cannot check out again today."
        confirmText="Yes, Check Out"
        variant="danger"
      />

    </div>
  );
};

export default EmployeeDashboard;
