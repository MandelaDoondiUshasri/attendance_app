import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  User, CalendarCheck, Home, FileText, Clock, Plus, Camera,
  MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck,
  Play, LogOut, CheckSquare, Trash2, CheckCircle2, AlertCircle,
  Layers, Monitor, Sparkles, Calendar as CalendarIcon, BarChart3,
  TrendingUp, TrendingDown, Minus, Loader2, DollarSign, Download, X
} from 'lucide-react';
import api from '../../services/api';
import { useAuth, hasProfilePhoto } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import LoadingState from '../../components/common/states/LoadingState';
import FormError from '../../components/common/states/FormError';
import ProfilePhotoGate from '../../components/common/ProfilePhotoGate';

export const EmployeeDashboard = () => {
  const { user, companyName } = useAuth();
  const { addToast } = useAppState();
  const isManagement = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';
  const [profile, setProfile] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [screenTimeStats, setScreenTimeStats] = useState({ today: '0h 00m', weekly: '0h 00m' });
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'APPLY_LEAVE', 'APPLY_WFH', 'CORRECTION'
  const [clockOutConfirmOpen, setClockOutConfirmOpen] = useState(false);

  // Form states
  const [leaveForm, setLeaveForm] = useState({ type: 'FULL_DAY', leave_type: '', start_date: '', end_date: '', reason: '', is_half_day: false, half_day_period: 'FIRST_HALF' });
  const [leaveFormErrors, setLeaveFormErrors] = useState({});
  const [wfhForm, setWfhForm] = useState({ type: 'FULL_DAY', start_date: new Date().toISOString().split('T')[0], end_date: '', is_half_day: false, half_day_period: 'FIRST_HALF', reason: '' });
  const [wfhFormErrors, setWfhFormErrors] = useState({});
  const [corrForm, setCorrForm] = useState({ date: '', requested_check_in: '', requested_check_out: '', reason: '' });
  const [corrFormErrors, setCorrFormErrors] = useState({});
  const [earlyPasses, setEarlyPasses] = useState([]);
  const [todayEarlyPass, setTodayEarlyPass] = useState(null);
  const [earlyPassForm, setEarlyPassForm] = useState({
    request_date: new Date().toISOString().split('T')[0],
    check_in_time: '09:00',
    requested_exit_time: '15:30',
    reason: '',
    remarks: '',
    attachment: null
  });
  const [earlyPassErrors, setEarlyPassErrors] = useState({});
  const [cancelEarlyPassModal, setCancelEarlyPassModal] = useState({ isOpen: false, request: null, submitting: false });
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [clAllowance, setClAllowance] = useState(null);
  const [loadingAllowance, setLoadingAllowance] = useState(false);
  const [historyTab, setHistoryTab] = useState('attendance'); // 'attendance' | 'early_pass'
  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return localStorage.getItem('whats_new_banner_dismissed_v12') === 'true';
  });

  const handleDismissBanner = () => {
    localStorage.setItem('whats_new_banner_dismissed_v12', 'true');
    setBannerDismissed(true);
  };

  // Helper to format leave names cleanly and fix database typos
  const formatLeaveName = (name) => {
    if (!name) return '';
    const cleaned = name.replace(/caus[a-z]*l/gi, 'Casual');
    return cleaned
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  };

  const fetchClAllowance = async (targetDate) => {
    try {
      setLoadingAllowance(true);
      const d = targetDate ? new Date(targetDate) : new Date();
      const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
      const month = isNaN(d.getMonth()) ? new Date().getMonth() + 1 : d.getMonth() + 1;
      const res = await api.get('/leaves/balances/allowance/', {
        params: { year, month }
      });
      setClAllowance(res.data);
    } catch (err) {
      console.error('Failed to load CL allowance:', err);
    } finally {
      setLoadingAllowance(false);
    }
  };

  const openLeaveModal = () => {
    setActiveModal('APPLY_LEAVE');
    fetchClAllowance(leaveForm.start_date || new Date().toISOString().split('T')[0]);
  };

  // Shift & Timing states
  const [shiftStatus, setShiftStatus] = useState(null);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [activeAttendance, setActiveAttendance] = useState(null);
  const [workMode, setWorkMode] = useState('OFFICE'); // 'OFFICE' | 'WFH'
  const [shiftDuration, setShiftDuration] = useState('00:00:00');
  const [shiftProgressPercent, setShiftProgressPercent] = useState(0);

  // Monthly summary
  const [monthlySummary, setMonthlySummary] = useState(null);

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
      const [userRes, attRes, typeRes, sumRes, screenRes, shiftRes, payslipRes, epRes] = await Promise.all([
        api.get('/auth/me/'),
        api.get('/attendance/'),
        api.get('/leaves/types/'),
        api.get('/leaves/balances/summary/').catch(() => ({ data: {} })),
        api.get('/tracking/screen-time/summary/').catch(() => ({ data: {} })),
        api.get('/attendance/shift-status/').catch(() => ({ data: null })),
        api.get('/salaries/my-payslips/?limit=1').catch(() => ({ data: [] })),
        api.get('/attendance/early-pass/my_requests/').catch(() => ({ data: [] }))
      ]);

      setProfile(userRes.data);
      const attList = attRes.data.results || attRes.data || [];
      setAttendances(attList);
      setLeaveTypes(typeRes.data.results || typeRes.data || []);
      if (sumRes.data?.my_summary) {
        setLeaveSummary(sumRes.data.my_summary);
      }

      const pList = payslipRes.data?.results || (Array.isArray(payslipRes.data) ? payslipRes.data : []);
      if (pList.length > 0) {
        setLatestPayslip(pList[0]);
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

      const epList = epRes.data?.results || (Array.isArray(epRes.data) ? epRes.data : []);
      setEarlyPasses(epList);
      const todayEp = epList.find(e => e.request_date === todayStr);
      setTodayEarlyPass(todayEp);

      if (shiftRes.data) {
        setShiftStatus(shiftRes.data);
      }

      // Check if an active session exists (from shift-status or today's unclosed attendance)
      const activeFromShift = (shiftRes.data?.is_clocked_in && shiftRes.data?.attendance) ? shiftRes.data.attendance : null;
      const activeRecord = (todayRec && !todayRec.check_out) ? todayRec : activeFromShift;

      if (activeRecord) {
        setIsClockedIn(true);
        setActiveAttendance(activeRecord);
        setWorkMode(activeRecord.work_mode || 'OFFICE');
        if (!todayRec) {
          setTodayAttendance(activeRecord);
        }
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
    if (user?.role === 'EMPLOYEE' && !hasProfilePhoto(user)) {
      setLoading(false);
      return;
    }
    fetchEmployeeData();
    fetchShiftReport();
  }, [user]);

  // Update elapsed time counter every second
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

        // Shift progress percentage (informational, based on standard 8h day)
        const requiredHours = shiftStatus?.required_working_hours || (profile?.is_half_day ? 4.0 : 8.0);
        const requiredMillis = requiredHours * 60 * 60 * 1000;
        const progress = Math.min(100, Math.round((diff / requiredMillis) * 100));
        setShiftProgressPercent(progress);
      };

      calculateDuration();
      interval = setInterval(calculateDuration, 1000);
    } else {
      setShiftDuration('00:00:00');
      setShiftProgressPercent(0);
    }
    return () => clearInterval(interval);
  }, [isClockedIn, activeAttendance, shiftStatus, profile]);

  // Fetch monthly working hours summary
  const fetchMonthlySummary = async () => {
    try {
      const now = new Date();
      const res = await api.get('/attendance/monthly-summary/', {
        params: { year: now.getFullYear(), month: now.getMonth() + 1 }
      });
      setMonthlySummary(res.data);
    } catch (e) {
      console.error('Failed to load monthly summary:', e);
    }
  };

  useEffect(() => {
    fetchMonthlySummary();
  }, []);

  const [isClockingIn, setIsClockingIn] = useState(false);

  const handleClockIn = async () => {
    try {
      setIsClockingIn(true);
      const payload = {
        attendance_method: 'WEB_PORTAL'
      };

      // Best-effort geolocation capture (falls back seamlessly if denied/unavailable)
      if (typeof window !== 'undefined' && navigator.geolocation) {
        try {
          const coords = await new Promise((resolve) => {
            navigator.geolocation.getCurrentPosition(
              (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
              () => resolve(null),
              { timeout: 2500, enableHighAccuracy: false, maximumAge: 60000 }
            );
          });
          if (coords) {
            payload.latitude = coords.latitude;
            payload.longitude = coords.longitude;
          }
        } catch (_) {
          // Gracefully continue without GPS
        }
      }

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
    } finally {
      setIsClockingIn(false);
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



  const getRequestedDays = () => {
    if (leaveForm.is_half_day) return 0.5;
    if (leaveForm.start_date && leaveForm.end_date) {
      const s = new Date(leaveForm.start_date);
      const e = new Date(leaveForm.end_date);
      if (e >= s) {
        const diffTime = Math.abs(e - s);
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      }
    }
    return 0;
  };

  const calculateLeaveDuration = () => {
    if (!leaveForm.leave_type) return null;
    const days = getRequestedDays();
    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''}`;
    }
    return null;
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    setLeaveFormErrors({});
    const errors = {};
    if (!leaveForm.leave_type) errors.leave_type = 'Please select a leave category';
    if (!leaveForm.start_date) errors.start_date = leaveForm.is_half_day ? 'Date is required' : 'Start date is required';
    if (!leaveForm.is_half_day && !leaveForm.end_date) errors.end_date = 'End date is required';
    if (!leaveForm.is_half_day && leaveForm.start_date && leaveForm.end_date && new Date(leaveForm.end_date) < new Date(leaveForm.start_date)) {
      errors.end_date = 'End date cannot be before start date';
    }
    if (leaveForm.is_half_day && !leaveForm.half_day_period) errors.half_day_period = 'Session is required';
    if (!leaveForm.reason.trim()) errors.reason = 'Justification reason is required';

    const selectedType = leaveTypes.find(t => String(t.id) === String(leaveForm.leave_type));
    const isCL = selectedType && (selectedType.code?.toUpperCase() === 'CL' || selectedType.name?.toLowerCase().includes('casual'));

    if (isCL && clAllowance?.is_cl_disabled) {
      errors.leave_type = `Casual Leave for ${clAllowance?.month_name || 'this month'} has already been utilized. Please apply under Loss of Pay (LOP).`;
    }

    if (Object.keys(errors).length > 0) {
      setLeaveFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...leaveForm,
        end_date: leaveForm.is_half_day ? leaveForm.start_date : leaveForm.end_date
      };
      await api.post('/leaves/requests/', payload);
      addToast('Leave application submitted for approval.', 'success');
      setActiveModal(null);
      setLeaveForm({ type: 'FULL_DAY', leave_type: '', start_date: '', end_date: '', reason: '', is_half_day: false, half_day_period: 'FIRST_HALF' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setLeaveFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit leave request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateWFHDuration = () => {
    if (wfhForm.is_half_day) {
      return wfhForm.start_date ? '0.5 day' : null;
    }
    if (wfhForm.start_date && wfhForm.end_date) {
      const s = new Date(wfhForm.start_date);
      const e = new Date(wfhForm.end_date);
      if (e >= s) {
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
      }
    }
    return null;
  };

  const handleApplyWFH = async (e) => {
    e.preventDefault();
    setWfhFormErrors({});
    const errors = {};
    if (!wfhForm.start_date) errors.start_date = wfhForm.is_half_day ? 'Date is required' : 'Start date is required';
    if (!wfhForm.is_half_day && !wfhForm.end_date) errors.end_date = 'End date is required';
    if (!wfhForm.is_half_day && wfhForm.start_date && wfhForm.end_date && new Date(wfhForm.end_date) < new Date(wfhForm.start_date)) {
      errors.end_date = 'End date cannot be before start date';
    }
    if (wfhForm.is_half_day && !wfhForm.half_day_period) errors.half_day_period = 'Session is required';
    if (!wfhForm.reason.trim()) errors.reason = 'Reason is required';

    if (Object.keys(errors).length > 0) {
      setWfhFormErrors(errors);
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...wfhForm,
        end_date: wfhForm.is_half_day ? wfhForm.start_date : wfhForm.end_date
      };
      await api.post('/wfh/requests/', payload);
      addToast('WFH application submitted for manager approval.', 'success');
      setActiveModal(null);
      setWfhForm({ type: 'FULL_DAY', start_date: new Date().toISOString().split('T')[0], end_date: '', is_half_day: false, half_day_period: 'FIRST_HALF', reason: '' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setWfhFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit WFH request.', 'error');
    } finally {
      setIsSubmitting(false);
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
      setIsSubmitting(true);
      const payload = {
        date: corrForm.date,
        reason: corrForm.reason
      };
      
      if (corrForm.requested_check_in) {
        payload.requested_check_in = `${corrForm.date}T${corrForm.requested_check_in}:00`;
      }
      
      if (corrForm.requested_check_out) {
        payload.requested_check_out = `${corrForm.date}T${corrForm.requested_check_out}:00`;
      }
      
      await api.post('/attendance/corrections/', payload);
      addToast('Attendance correction request filed.', 'success');
      setActiveModal(null);
      setCorrForm({ date: '', requested_check_in: '', requested_check_out: '', reason: '' });
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setCorrFormErrors(respData);
      }
      addToast(respData?.error || 'Failed to file correction request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPayslip = async (payslip) => {
    try {
      const res = await api.get(`/salaries/my-payslips/${payslip.id}/download/`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${payslip.payslip_reference || 'Payslip'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      addToast('Payslip downloaded successfully.', 'success');
    } catch (err) {
      addToast('Failed to download payslip.', 'error');
    }
  };

  const openEarlyPassModal = () => {
    let defaultCheckIn = '09:00';
    if (todayAttendance?.check_in) {
      const d = new Date(todayAttendance.check_in);
      defaultCheckIn = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    setEarlyPassForm({
      request_date: new Date().toISOString().split('T')[0],
      check_in_time: defaultCheckIn,
      requested_exit_time: '15:30',
      reason: '',
      remarks: '',
      attachment: null
    });
    setEarlyPassErrors({});
    setActiveModal('APPLY_EARLY_PASS');
  };

  const handleEarlyPassSubmit = async (e) => {
    e.preventDefault();
    setEarlyPassErrors({});
    try {
      setIsSubmitting(true);
      const formData = new FormData();
      formData.append('request_date', earlyPassForm.request_date);
      formData.append('check_in_time', earlyPassForm.check_in_time);
      formData.append('requested_exit_time', earlyPassForm.requested_exit_time);
      formData.append('reason', earlyPassForm.reason);
      if (earlyPassForm.remarks) formData.append('remarks', earlyPassForm.remarks);
      if (earlyPassForm.attachment) formData.append('attachment', earlyPassForm.attachment);

      await api.post('/attendance/early-pass/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      addToast('EarlyPass request submitted successfully. Awaiting CEO/HR approval.', 'success');
      setActiveModal(null);
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchEmployeeData();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setEarlyPassErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit EarlyPass request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEarlyPass = async () => {
    if (!cancelEarlyPassModal.request) return;
    try {
      setCancelEarlyPassModal(prev => ({ ...prev, submitting: true }));
      await api.post(`/attendance/early-pass/${cancelEarlyPassModal.request.id}/cancel/`);
      addToast('EarlyPass request cancelled.', 'success');
      setCancelEarlyPassModal({ isOpen: false, request: null, submitting: false });
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchEmployeeData();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to cancel EarlyPass request.', 'error');
      setCancelEarlyPassModal(prev => ({ ...prev, submitting: false }));
    }
  };

  const calculateEarlyPassDuration = () => {
    if (!earlyPassForm.check_in_time || !earlyPassForm.requested_exit_time) return null;
    const [inH, inM] = earlyPassForm.check_in_time.split(':').map(Number);
    const [outH, outM] = earlyPassForm.requested_exit_time.split(':').map(Number);
    if (isNaN(inH) || isNaN(outH)) return null;
    const inMin = inH * 60 + (inM || 0);
    const outMin = outH * 60 + (outM || 0);
    if (outMin <= inMin) return { invalid: true, msg: 'Requested exit time must be after check-in time.' };

    const diffMin = outMin - inMin;
    const diffHours = Math.round((diffMin / 60) * 100) / 100;
    const reqHours = profile?.is_half_day ? 4.0 : 8.0;
    const missingHours = Math.max(0, Math.round((reqHours - diffHours) * 100) / 100);

    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    const misH = Math.floor(missingHours);
    const misM = Math.round((missingHours - misH) * 60);

    return {
      invalid: false,
      workingHoursStr: `${h}h ${m > 0 ? `${m}m` : ''}`,
      missingHoursStr: `${misH}h ${misM > 0 ? `${misM}m` : ''}`,
      reqHours,
      diffHours,
      missingHours
    };
  };

  if (user?.role === 'EMPLOYEE' && !hasProfilePhoto(user)) {
    return <ProfilePhotoGate onSuccess={() => { fetchEmployeeData(); fetchShiftReport(); }} />;
  }

  if (loading) {
    return <LoadingState message="Loading your employee portal..." />;
  }

  const isMandatoryHoliday = Boolean(shiftStatus?.is_holiday);
  const isOnApprovedLeave = Boolean(shiftStatus?.is_on_leave);
  const requiredHoursDisplay = shiftStatus?.required_working_hours || (profile?.is_half_day ? 4.0 : 8.0);

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-indigo-950/20 to-slate-900/95 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-500/15 text-brand-300 border border-brand-500/30">
              {companyName || 'FRG'} Workspace
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-400">
              {profile?.is_half_day ? 'Half-Day Shift (4h)' : 'Full-Day Shift (8h)'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            Welcome back, {user?.first_name || 'Team Member'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl font-normal leading-relaxed">
            Real-time shift governance, leave administration, and daily accomplishment reporting.
          </p>
        </div>

        {/* QUICK ACTIONS BAR */}
        <div className="flex flex-wrap items-center gap-2.5 z-10 shrink-0">
          <button
            onClick={openEarlyPassModal}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 hover:text-white font-bold text-xs rounded-xl border border-amber-500/30 hover:border-amber-400/50 shadow-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-amber-400" />
            <span>Request EarlyPass</span>
          </button>
          <button
            onClick={openLeaveModal}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 border border-indigo-400/30 cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4 text-indigo-200" />
            <span>Apply Leave</span>
          </button>
          <button
            onClick={() => setActiveModal('APPLY_WFH')}
            className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-white/10 hover:border-sky-500/40 shadow-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Home className="w-4 h-4 text-sky-400" />
            <span>Apply WFH</span>
          </button>
          <button
            onClick={() => setActiveModal('CORRECTION')}
            className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-white/10 hover:border-slate-500 shadow-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
          >
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Correct Attendance</span>
          </button>
        </div>
      </div>

      {/* WHAT'S NEW ANNOUNCEMENT BAR (SLIM & ELEGANT) */}
      {!bannerDismissed && (
        <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-indigo-950/60 border border-indigo-500/25 backdrop-blur-xl flex items-center justify-between gap-3 shadow-md relative overflow-hidden animate-fadeIn">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" /> Updates
            </span>
            <p className="text-xs text-slate-300 truncate">
              EarlyPass early exit exception, digital PDF payslips & dynamic leave carry-forward are live!
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/whats-new"
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
            >
              <span>Explore Guide</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <button
              onClick={handleDismissBanner}
              title="Dismiss announcement"
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* EXECUTIVE SHIFT COMMAND CENTER (2-COLUMN GRID) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* PRIMARY SHIFT CONSOLE (LG:COL-SPAN-8) */}
        <div className="lg:col-span-8 flex flex-col justify-between glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-950/90 backdrop-blur-2xl shadow-xl relative overflow-hidden group">
          <div className={`absolute inset-0 rounded-3xl blur-2xl opacity-15 transition-all duration-1000 pointer-events-none ${
            isClockedIn ? 'bg-emerald-500 opacity-20' : 'bg-brand-500 opacity-10'
          }`} />

          {/* CASE 1: MANDATORY HOLIDAY */}
          {isMandatoryHoliday ? (
            <div className="space-y-4 relative z-10 my-auto">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  <Sparkles className="w-3.5 h-3.5 text-rose-400" /> Mandatory Holiday • Office Closed
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {shiftStatus?.holiday_title || 'Sunday (Weekly Off)'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-xl font-normal leading-relaxed">
                Today is an official non-working holiday. Office attendance tracking and clock-in are disabled for the day. Enjoy your holiday!
              </p>
            </div>
          ) : isOnApprovedLeave ? (
            /* CASE 2: APPROVED LEAVE */
            <div className="space-y-4 relative z-10 my-auto">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <CalendarCheck className="w-4 h-4 text-emerald-400" /> Approved Leave • Off Duty
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {shiftStatus?.leave_title || 'Approved Leave'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium max-w-xl">
                You have an approved leave record scheduled for today. Clock-in and clock-out buttons are disabled.
              </p>
            </div>
          ) : todayAttendance?.check_out ? (
            /* CASE 3: SHIFT COMPLETED */
            <div className="space-y-5 relative z-10 my-auto">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-400" /> Shift Completed
                </span>
                {todayEarlyPass && todayEarlyPass.status === 'APPROVED' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Approved Early Exit (₹0 Cut)
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  Work Day Completed
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                  You have completed your shift and checked out for today. Attendance is locked until tomorrow.
                </p>
              </div>

              <div className="flex items-center gap-4 pt-2">
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
                <div className="px-4 py-2.5 bg-slate-800/80 border border-slate-700/70 text-slate-300 font-bold text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Locked
                </div>
              </div>
            </div>
          ) : (
            /* CASE 4: REGULAR WORKING DAY (CLOCKED IN OR OFF DUTY) */
            <div className="space-y-5 relative z-10 my-auto">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                  isClockedIn 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                }`}>
                  {isClockedIn && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
                  {isClockedIn ? `Shift Active (${workMode})` : 'Off Duty'}
                </span>

                {/* Inline EarlyPass notification if requested for today */}
                {todayEarlyPass && (
                  <div className="flex items-center gap-2">
                    {todayEarlyPass.status === 'APPROVED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> EarlyPass Approved: {todayEarlyPass.requested_exit_time?.substring(0, 5)} (₹0 Cut)
                      </span>
                    )}
                    {todayEarlyPass.status === 'PENDING' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5 text-amber-400" /> EarlyPass Pending Review: {todayEarlyPass.requested_exit_time?.substring(0, 5)}
                      </span>
                    )}
                    {todayEarlyPass.status === 'REJECTED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        EarlyPass Rejected
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {isClockedIn ? 'Work Shift in Progress' : 'Start Your Work Day'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
                  {isClockedIn 
                    ? `Standard shift duration is ${requiredHoursDisplay} hours. Clock out when your work day concludes.` 
                    : `Check-in is permitted once per working day. Standard shift: ${requiredHoursDisplay}h.`}
                </p>
              </div>

              {/* Shift Progress Bar when clocked in */}
              {isClockedIn && (
                <div className="space-y-1.5 max-w-md">
                  <div className="flex justify-between text-xs font-semibold text-slate-400">
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

              {/* Action row: Elapsed Clock + Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
                {isClockedIn ? (
                  <>
                    <div className="bg-black/40 px-5 py-3 rounded-2xl border border-white/5 shadow-inner flex items-center gap-3.5 w-fit">
                      <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                        <Clock className="w-4 h-4 animate-pulse" />
                      </span>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-widest">Elapsed Time</span>
                        <span className="font-mono text-xl sm:text-2xl font-black text-emerald-400 tracking-wider">
                          {shiftDuration}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setClockOutConfirmOpen(true)}
                      className="px-8 py-3.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" /> Clock Out
                    </button>
                  </>
                ) : (
                  <div>
                    <button
                      onClick={() => handleClockIn()}
                      disabled={isClockingIn}
                      className="px-8 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-60 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all active:scale-95 hover:-translate-y-0.5 cursor-pointer"
                    >
                      {isClockingIn ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Clocking In...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          <span>Clock In</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: TODAY'S TELEMETRY & PUNCH SUMMARY (LG:COL-SPAN-4) */}
        <div className="lg:col-span-4 glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-2xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Today's Punch Summary</h3>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                todayAttendance?.check_out 
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' 
                  : isClockedIn 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border border-white/5'
              }`}>
                {todayAttendance?.check_out ? 'Finished' : (isClockedIn ? 'Live' : 'Pending')}
              </span>
            </div>

            {/* 2x2 Telemetry Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* Check In */}
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Check-In</span>
                <p className="text-base font-black text-emerald-400 font-mono">
                  {todayAttendance?.check_in 
                    ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : '--:--'}
                </p>
                <span className="text-[9px] text-slate-500 mt-0.5 block">
                  {todayAttendance?.check_in ? 'Shift start punch' : 'Not recorded'}
                </span>
              </div>

              {/* Check Out */}
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Check-Out</span>
                <p className={`text-base font-black font-mono ${todayAttendance?.check_out ? 'text-indigo-400' : isClockedIn ? 'text-amber-400' : 'text-slate-400'}`}>
                  {todayAttendance?.check_out 
                    ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : isClockedIn 
                      ? 'In Progress' 
                      : '--:--'}
                </p>
                <span className="text-[9px] text-slate-500 mt-0.5 block">
                  {todayAttendance?.check_out ? 'Shift end punch' : (isClockedIn ? 'Pending punch out' : 'Not recorded')}
                </span>
              </div>

              {/* Total Hours */}
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Logged Time</span>
                <p className="text-base font-black text-amber-400 font-mono">
                  {todayAttendance?.working_hours ? `${todayAttendance.working_hours}h` : (isClockedIn ? shiftDuration.substring(0, 5) : '0h')}
                </p>
                <span className="text-[9px] text-slate-500 mt-0.5 block">
                  Target: {requiredHoursDisplay}h
                </span>
              </div>

              {/* Work Mode */}
              <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Work Mode</span>
                <p className="text-base font-black text-white font-sans">
                  {todayAttendance?.work_mode || workMode || 'OFFICE'}
                </p>
                <span className="text-[9px] text-slate-500 mt-0.5 block">
                  {todayAttendance?.work_mode === 'WFH' ? 'Remote location' : 'Office desk'}
                </span>
              </div>
            </div>
          </div>

          {/* EarlyPass Status or Quick Action inside Telemetry Card */}
          <div className="pt-3 border-t border-white/5">
            {todayEarlyPass ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-amber-300 font-mono">{todayEarlyPass.pass_reference}</span>
                    <StatusBadge status={todayEarlyPass.status} />
                  </div>
                  <p className="text-[11px] text-slate-300 mt-0.5 truncate">
                    Exit requested: <strong className="text-amber-200 font-mono">{todayEarlyPass.requested_exit_time?.substring(0, 5)}</strong>
                  </p>
                </div>
                <Link
                  to="/early-pass"
                  className="text-[10px] font-bold text-amber-400 hover:text-amber-300 shrink-0"
                >
                  View →
                </Link>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="text-[11px]">Need to leave early?</span>
                <button
                  onClick={openEarlyPassModal}
                  className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Request EarlyPass</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MONTHLY WORKING HOURS SUMMARY */}
      {isManagement && monthlySummary && (
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-brand-950/10 to-slate-900/90 shadow-xl backdrop-blur-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-500/5 rounded-full blur-3xl" />
          <div className="p-6 sm:p-8 relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white">Monthly Working Hours</h3>
                <p className="text-xs text-slate-400">{monthlySummary.month_name} {monthlySummary.year} — Dynamic Calculation</p>
              </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expected Hours</p>
                <p className="text-xl font-black text-white font-mono">{monthlySummary.expected_working_hours}h</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{monthlySummary.expected_working_days} working days</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Actual Hours</p>
                <p className="text-xl font-black text-emerald-400 font-mono">{monthlySummary.actual_working_hours}h</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Recorded so far</p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  {monthlySummary.extra_hours >= 0 ? 'Extra Hours' : 'Short Hours'}
                </p>
                <p className={`text-xl font-black font-mono flex items-center gap-1.5 ${monthlySummary.extra_hours > 0 ? 'text-emerald-400' : monthlySummary.extra_hours < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {monthlySummary.extra_hours > 0 ? <TrendingUp className="w-4 h-4" /> : monthlySummary.extra_hours < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {monthlySummary.extra_hours > 0 ? '+' : ''}{monthlySummary.extra_hours}h
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {monthlySummary.extra_hours > 0 ? 'Overtime' : monthlySummary.extra_hours < 0 ? 'Deficit' : 'On Track'}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-black/30 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Calendar Days</p>
                <p className="text-xl font-black text-slate-200 font-mono">{monthlySummary.total_calendar_days}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{monthlySummary.month_name}</p>
              </div>
            </div>

            {/* Breakdown Row */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <span className="w-2 h-2 rounded-full bg-brand-400" />
                <span className="text-slate-400">Working Days:</span>
                <span className="text-white font-bold font-mono">{monthlySummary.total_scheduled_working_days}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span className="text-slate-400">Sundays:</span>
                <span className="text-white font-bold font-mono">{monthlySummary.total_sundays}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">Weekend Holidays:</span>
                <span className="text-white font-bold font-mono">{monthlySummary.total_weekend_holidays}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                <span className="text-slate-400">Company Holidays:</span>
                <span className="text-white font-bold font-mono">{monthlySummary.total_company_holidays}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-slate-400">Leaves:</span>
                <span className="text-white font-bold font-mono">{monthlySummary.total_leave_days}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT REPORT & LEAVE BALANCE SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        {/* SHIFT WORK REPORT & LATEST PAYSLIP (LG:COL-SPAN-2) */}
        <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-slate-900/40 backdrop-blur-xl flex flex-col justify-between">
          {/* TOP SECTION: DAILY ACCOMPLISHMENT REPORT */}
          <div>
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
                  className="text-xs font-bold text-brand-400 hover:text-brand-300 underline cursor-pointer"
                >
                  Edit Report
                </button>
              )}
            </div>

            {isEditingReport ? (
              <div className="space-y-3">
                <textarea
                  value={reportContent}
                  onChange={(e) => setReportContent(e.target.value)}
                  placeholder="Detail today's achievements, completed tickets, meetings attended, and blockers..."
                  rows={4}
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
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/5 text-slate-300 text-sm whitespace-pre-wrap leading-relaxed font-sans">
                {shiftReport?.report_content}
              </div>
            )}
          </div>

          {/* BOTTOM SECTION: LATEST RELEASED PAYSLIP & COMPENSATION (FILLING THE GAP) */}
          <div className="pt-6 border-t border-white/10 mt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-sm">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-extrabold text-white tracking-tight">Monthly Compensation & Payslip</h4>
                    <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Digital Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Certified payroll statements and 1-click official PDF downloads</p>
                </div>
              </div>
              <a
                href="/employee/payslips"
                className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>All Payslips</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            {latestPayslip ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/40 border border-emerald-500/25 relative overflow-hidden shadow-inner">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left: Net Pay & Period */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white font-sans flex items-center gap-1.5">
                        <CalendarIcon className="w-3.5 h-3.5 text-emerald-400" />
                        {new Date(latestPayslip.year, latestPayslip.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300/80">
                        {latestPayslip.payslip_reference}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                        ₹{parseFloat(latestPayslip.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Net Disbursed
                      </span>
                    </div>
                  </div>

                  {/* Middle: Salary Breakdown Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Gross Pay</span>
                      <span className="text-xs font-bold font-mono text-slate-200">
                        ₹{parseFloat(latestPayslip.gross_salary || latestPayslip.monthly_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-left">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Deductions</span>
                      <span className="text-xs font-bold font-mono text-rose-300">
                        -₹{parseFloat(latestPayslip.total_deductions || latestPayslip.lop_deduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-left col-span-2 sm:col-span-1">
                      <span className="text-[9px] uppercase font-bold text-slate-400 block">Status</span>
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Disbursed
                      </span>
                    </div>
                  </div>

                  {/* Right: Download PDF action */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDownloadPayslip(latestPayslip)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download PDF</span>
                    </button>
                    <a
                      href="/employee/payslips"
                      className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer"
                      title="View all details"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-400 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-slate-400">
                    No released payslips yet. Your official digital compensation statement will appear here once finalized by HR/CEO.
                  </p>
                </div>
                <a
                  href="/employee/payslips"
                  className="text-xs font-bold text-slate-300 hover:text-white whitespace-nowrap"
                >
                  History →
                </a>
              </div>
            )}
          </div>
        </div>

        {/* LEAVE BALANCE SUMMARY (LG:COL-SPAN-1) */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/60 backdrop-blur-xl shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex items-center justify-center shadow-sm">
                <CalendarCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-white tracking-tight">Leave Balances</h3>
                <p className="text-xs text-slate-400">Annual accrued entitlement</p>
              </div>
            </div>

            <div className="space-y-3">
              {leaveSummary && leaveSummary.balances && leaveSummary.balances.length > 0 ? (
                leaveSummary.balances.map((b) => {
                  const leaveName = formatLeaveName(b.name);
                  const isPaid = b.is_paid !== false;
                  const percentRemaining = isPaid 
                    ? Math.min(100, Math.round(((b.remaining_days || 0) / (b.days_allowed || 1)) * 100)) 
                    : null;

                  return (
                    <div
                      key={b.leave_type_id}
                      className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/10 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-white">{leaveName}</p>
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">{b.code}</p>
                        </div>
                        <div className="text-right">
                          {isPaid ? (
                            <>
                              <p className="text-sm font-black text-emerald-400 font-sans tracking-tight">{b.remaining_days} left</p>
                              <p className="text-[10px] text-slate-400 font-medium">of {b.days_allowed} days</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-black text-rose-400 font-sans tracking-tight">{b.used_days || 0} taken</p>
                              <p className="text-[10px] text-rose-400/90 font-bold uppercase tracking-wider">Loss of Pay</p>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Mini Progress Bar for Paid Leaves */}
                      {isPaid && (
                        <div className="w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden border border-white/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                            style={{ width: `${percentRemaining}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 text-center py-6">No active leave quota found.</p>
              )}
            </div>
          </div>

          <div className="pt-5 border-t border-white/5 mt-5">
            <button
              onClick={openLeaveModal}
              className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] hover:border-indigo-500/40 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-400" /> Request Leave
            </button>
          </div>
        </div>
      </div>

      {/* ACTIVITY & RECORDS HUB (TABBED) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
          {/* Segmented Tab Control */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950/70 rounded-2xl border border-white/5 w-fit">
            <button
              onClick={() => setHistoryTab('attendance')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                historyTab === 'attendance'
                  ? 'bg-slate-800 text-white shadow-sm border border-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Attendance Logs</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-700/80 text-slate-300 font-mono">
                {attendances.length}
              </span>
            </button>
            <button
              onClick={() => setHistoryTab('early_pass')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                historyTab === 'early_pass'
                  ? 'bg-slate-800 text-white shadow-sm border border-white/10'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogOut className="w-3.5 h-3.5 text-amber-400" />
              <span>EarlyPass Requests</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                {earlyPasses.length}
              </span>
            </button>
          </div>

          {/* Contextual Actions on Right */}
          <div className="flex items-center gap-2.5">
            {historyTab === 'attendance' ? (
              <button
                onClick={() => setActiveModal('CORRECTION')}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5 cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Correct Attendance</span>
              </button>
            ) : (
              <>
                <button
                  onClick={openEarlyPassModal}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Request EarlyPass</span>
                </button>
                <Link
                  to="/early-pass"
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 flex items-center gap-1.5"
                >
                  <span>Full Portal</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Tab 1: Attendance Logs */}
        {historyTab === 'attendance' && (
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
        )}

        {/* Tab 2: EarlyPass History */}
        {historyTab === 'early_pass' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3.5">Date & Ref</th>
                  <th className="py-3 px-3.5">Req. Exit</th>
                  <th className="py-3 px-3.5">Actual Exit</th>
                  <th className="py-3 px-3.5">Working Hours</th>
                  <th className="py-3 px-3.5">Reason</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Approved By</th>
                  <th className="py-3 px-3.5">Salary Deduction</th>
                  <th className="py-3 px-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {earlyPasses.slice(0, 10).map((ep) => (
                  <tr key={ep.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-3.5">
                      <div className="font-mono font-bold text-amber-300">{ep.pass_reference}</div>
                      <div className="text-[10px] text-slate-400">{ep.request_date}</div>
                    </td>
                    <td className="py-3 px-3.5 font-mono text-amber-400 font-bold">
                      {ep.requested_exit_time ? ep.requested_exit_time.substring(0, 5) : '--:--'}
                    </td>
                    <td className="py-3 px-3.5 font-mono text-indigo-400">
                      {ep.actual_exit_time ? ep.actual_exit_time.substring(0, 5) : '--:--'}
                    </td>
                    <td className="py-3 px-3.5">
                      <span className="font-mono font-bold text-white">
                        {ep.actual_working_hours > 0 ? `${ep.actual_working_hours}h` : '--'}
                      </span>
                      {ep.missing_hours > 0 && (
                        <span className="text-[10px] text-rose-300 block font-mono">(-{ep.missing_hours}h)</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 max-w-[180px] truncate" title={ep.reason}>
                      {ep.reason}
                    </td>
                    <td className="py-3 px-3.5">
                      <StatusBadge status={ep.status} />
                    </td>
                    <td className="py-3 px-3.5 text-slate-300 text-[11px]">
                      {ep.approved_by_name || ep.rejected_by_name || '-'}
                    </td>
                    <td className="py-3 px-3.5">
                      {ep.status === 'APPROVED' ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                          ₹0 (Waived)
                        </span>
                      ) : ep.status === 'REJECTED' ? (
                        <span className="text-slate-400 text-[10px]">Standard Rules</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Pending Review</span>
                      )}
                    </td>
                    <td className="py-3 px-3.5 text-right">
                      {ep.status === 'PENDING' && ep.can_be_cancelled !== false ? (
                        <button
                          onClick={() => setCancelEarlyPassModal({ isOpen: true, request: ep, submitting: false })}
                          className="px-2 py-1 text-[10px] font-bold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 rounded-lg border border-rose-500/30 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      ) : (
                        <Link
                          to="/early-pass"
                          className="text-[10px] font-bold text-indigo-400 hover:underline"
                        >
                          Details
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
                {earlyPasses.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500 text-xs font-medium">
                      No EarlyPass requests filed yet. Click "Request EarlyPass" to submit an early-exit exception.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
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
              <option value="">Select leave category</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {formatLeaveName(t.name)} ({t.code})
                </option>
              ))}
            </select>
            <FormError message={leaveFormErrors.leave_type} id="leave-type-err" />
          </div>

          {/* DYNAMIC LEAVE POLICY NOTICE & PREVIEWS */}
          {(() => {
            const selectedType = leaveTypes.find(t => String(t.id) === String(leaveForm.leave_type));
            if (!selectedType) return null;

            const isCL = selectedType.code?.toUpperCase() === 'CL' || selectedType.name?.toLowerCase().includes('casual');
            const isLossOfPay = !selectedType.is_paid || selectedType.code?.toUpperCase() === 'LOP' || selectedType.name?.toLowerCase().includes('loss of pay');
            const requestedDays = getRequestedDays();

            // 1. Casual Leave when locked for current month
            if (isCL && clAllowance?.is_cl_disabled) {
              return (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-rose-200">Casual Leave Locked for {clAllowance.month_name} {clAllowance.year}</span>
                    <p className="text-[11px] text-rose-300/90 leading-relaxed">
                      {clAllowance.disable_reason || `Casual Leave for ${clAllowance.month_name} has already been utilized. You cannot submit another Casual Leave request for this month.`}
                    </p>
                    <p className="text-[11px] text-slate-300 pt-0.5">
                      💡 Please change category to <strong className="text-amber-300">Loss of Pay (LOP)</strong>.
                    </p>
                  </div>
                </div>
              );
            }

            // 2. Casual Leave when available: Display Allowance Breakdown + Split Preview
            if (isCL && !clAllowance?.is_cl_disabled) {
              const availableCl = clAllowance ? clAllowance.total_available_cl : 1.0;
              const exceedsAllowance = requestedDays > availableCl;
              const additionalDays = exceedsAllowance ? Math.round((requestedDays - availableCl) * 10) / 10 : 0;
              const estimatedDeduction = clAllowance?.daily_salary ? Math.round(additionalDays * clAllowance.daily_salary) : 0;

              return (
                <div className="space-y-2">
                  <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl text-xs text-brand-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-brand-400" />
                        {clAllowance?.month_name || 'Current Month'} Casual Leave Allowance
                      </span>
                      <span className="font-mono font-black text-emerald-400 text-sm">{availableCl} Days Available</span>
                    </div>
                    <div className="text-[11px] text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5 pt-0.5">
                      <span>Carry-Forward: <strong className="text-white font-mono">{clAllowance?.previous_unused_cl ?? 0}d</strong></span>
                      <span>This Month: <strong className="text-white font-mono">+{clAllowance?.current_month_cl ?? 1}d</strong></span>
                      <span>Divisor: <strong className="text-white font-mono">{clAllowance?.calendar_days ?? 30} days</strong></span>
                      <span>Daily Rate: <strong className="text-white font-mono">₹{clAllowance?.daily_salary ?? 0}/day</strong></span>
                    </div>
                  </div>

                  {requestedDays > 0 && exceedsAllowance && (
                    <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 shadow-sm space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-bold text-amber-200">Dynamic Split & Higher Authority Approval Notice</span>
                      </div>
                      <p className="text-[11px] text-amber-300/90 leading-relaxed">
                        Your request of <strong>{requestedDays} days</strong> exceeds your available Casual Leave allowance of <strong>{availableCl} days</strong>.
                      </p>
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-amber-500/20 space-y-1 text-[11px] text-slate-300 font-mono">
                        <div className="flex justify-between">
                          <span>• Casual Leave Portion (Paid):</span>
                          <strong className="text-emerald-400">{availableCl} days</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>• Additional Days (Awaiting Review):</span>
                          <strong className="text-amber-400">{additionalDays} days</strong>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400">
                          <span>• If Approved by CEO/HR:</span>
                          <span className="text-rose-300 font-bold">Converted to LOP (~₹{estimatedDeduction})</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>• If Rejected by CEO/HR:</span>
                          <span className="text-slate-300">Rejected (No deduction)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            // 3. Loss of Pay Selected
            if (isLossOfPay) {
              const estDeduction = clAllowance?.daily_salary ? Math.round(requestedDays * clAllowance.daily_salary) : 0;
              return (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-300 flex items-start gap-2.5 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <span className="font-bold text-rose-200">Loss of Pay (Unpaid Leave) Selected</span>
                    <p className="text-[11px] text-rose-300/80 leading-relaxed">
                      Upon approval, 1 day's salary ({leaveForm.is_half_day ? '0.5 day for half day' : '1 day per day'}) will be deducted from your monthly payroll. Your annual paid leave quota will NOT be deducted.
                    </p>
                    {requestedDays > 0 && clAllowance?.daily_salary > 0 && (
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-rose-500/20 text-[11px] text-slate-300 font-mono flex justify-between mt-1">
                        <span>Estimated Deduction ({requestedDays}d):</span>
                        <strong className="text-rose-400">₹{estDeduction} (@ ₹{clAllowance.daily_salary}/day)</strong>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            return null;
          })()}

          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4 mt-2">
            <button
              type="button"
              onClick={() => setLeaveForm({ ...leaveForm, type: 'FULL_DAY', is_half_day: false })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                !leaveForm.is_half_day ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full Day
            </button>
            <button
              type="button"
              onClick={() => setLeaveForm({ ...leaveForm, type: 'HALF_DAY', is_half_day: true })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                leaveForm.is_half_day ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Half Day
            </button>
          </div>

          {!leaveForm.is_half_day ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>Start Date</span>
                </label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => {
                    const newStart = e.target.value;
                    setLeaveForm({ ...leaveForm, start_date: newStart });
                    if (newStart) fetchClAllowance(newStart);
                  }}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <FormError message={leaveFormErrors.start_date} id="leave-start-err" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>End Date</span>
                </label>
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
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setLeaveForm({ ...leaveForm, start_date: newDate });
                    if (newDate) fetchClAllowance(newDate);
                  }}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <FormError message={leaveFormErrors.start_date} id="leave-start-err" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Session</label>
                <select
                  value={leaveForm.half_day_period}
                  onChange={(e) => setLeaveForm({ ...leaveForm, half_day_period: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="FIRST_HALF">Morning / First Half</option>
                  <option value="SECOND_HALF">Evening / Second Half</option>
                </select>
                <FormError message={leaveFormErrors.half_day_period} id="leave-session-err" />
              </div>
            </div>
          )}

          {calculateLeaveDuration() && (
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Duration Preview</span>
              <span className="text-sm font-black text-indigo-300">{calculateLeaveDuration()}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Notes</label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="Provide a reason for this leave request..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
            />
            <FormError message={leaveFormErrors.reason} id="leave-reason-err" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl disabled:opacity-50">Cancel</button>
            {(() => {
              const selectedType = leaveTypes.find(t => String(t.id) === String(leaveForm.leave_type));
              const isCL = selectedType && (selectedType.code?.toUpperCase() === 'CL' || selectedType.name?.toLowerCase().includes('casual'));
              const isCLDisabled = isCL && clAllowance?.is_cl_disabled;

              return (
                <button
                  type="submit"
                  disabled={isSubmitting || isCLDisabled}
                  className={`px-4 py-2.5 text-xs font-bold text-white rounded-xl shadow-lg flex items-center gap-2 transition-all disabled:opacity-50 ${
                    isCLDisabled ? 'bg-slate-700 cursor-not-allowed' : 'bg-brand-600 hover:bg-brand-500 cursor-pointer'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {isSubmitting ? 'Submitting...' : isCLDisabled ? 'Casual Leave Locked' : 'Submit Application'}
                </button>
              );
            })()}
          </div>
        </form>
      </Modal>

      {/* APPLY WFH MODAL */}
      <Modal isOpen={activeModal === 'APPLY_WFH'} onClose={() => setActiveModal(null)} title="Apply for Work From Home">
        <form onSubmit={handleApplyWFH} className="space-y-4">
          
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-4">
            <button
              type="button"
              onClick={() => setWfhForm({ ...wfhForm, type: 'FULL_DAY', is_half_day: false })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                !wfhForm.is_half_day ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Full Day
            </button>
            <button
              type="button"
              onClick={() => setWfhForm({ ...wfhForm, type: 'HALF_DAY', is_half_day: true })}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 ${
                wfhForm.is_half_day ? 'bg-brand-500/20 text-brand-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Half Day
            </button>
          </div>

          {!wfhForm.is_half_day ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>Start Date</span>
                </label>
                <input
                  type="date"
                  value={wfhForm.start_date}
                  onChange={(e) => setWfhForm({ ...wfhForm, start_date: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <FormError message={wfhFormErrors.start_date} id="wfh-start-err" />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>End Date</span>
                </label>
                <input
                  type="date"
                  value={wfhForm.end_date}
                  onChange={(e) => setWfhForm({ ...wfhForm, end_date: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <FormError message={wfhFormErrors.end_date} id="wfh-end-err" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                  <span className="icon-badge-calendar">
                    <CalendarIcon className="w-3.5 h-3.5" />
                  </span>
                  <span>Date</span>
                </label>
                <input
                  type="date"
                  value={wfhForm.start_date}
                  onChange={(e) => setWfhForm({ ...wfhForm, start_date: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                />
                <FormError message={wfhFormErrors.start_date} id="wfh-start-err" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Session</label>
                <select
                  value={wfhForm.half_day_period}
                  onChange={(e) => setWfhForm({ ...wfhForm, half_day_period: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="FIRST_HALF">Morning / First Half</option>
                  <option value="SECOND_HALF">Evening / Second Half</option>
                </select>
                <FormError message={wfhFormErrors.half_day_period} id="wfh-session-err" />
              </div>
            </div>
          )}

          {calculateWFHDuration() && (
            <div className="p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold text-brand-400 uppercase tracking-wider">Duration Preview</span>
              <span className="text-sm font-black text-brand-300">{calculateWFHDuration()}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Remote Work</label>
            <textarea
              value={wfhForm.reason}
              onChange={(e) => setWfhForm({ ...wfhForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="Provide a valid reason for working from home..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 resize-none"
            />
            <FormError message={wfhFormErrors.reason} id="wfh-reason-err" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50">
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ATTENDANCE CORRECTION MODAL */}
      <Modal isOpen={activeModal === 'CORRECTION'} onClose={() => setActiveModal(null)} title="Request Attendance Correction">
        <form onSubmit={handleCorrectionSubmit} className="space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
              <span className="icon-badge-calendar">
                <CalendarIcon className="w-3.5 h-3.5" />
              </span>
              <span>Target Attendance Date</span>
            </label>
            <input
              type="date"
              value={corrForm.date}
              onChange={(e) => {
                const selectedDate = e.target.value;
                const existingAtt = attendances.find(a => a.date === selectedDate);
                let defaultCheckIn = '';
                let defaultCheckOut = '';

                if (existingAtt) {
                  if (existingAtt.check_in) {
                    const d = new Date(existingAtt.check_in);
                    defaultCheckIn = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  }
                  if (existingAtt.check_out) {
                    const d = new Date(existingAtt.check_out);
                    defaultCheckOut = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
                  }
                }

                setCorrForm({ 
                  ...corrForm, 
                  date: selectedDate, 
                  requested_check_in: defaultCheckIn,
                  requested_check_out: defaultCheckOut
                });
              }}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
            <FormError message={corrFormErrors.date} id="corr-date-err" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                <span className="icon-badge-clock">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <span>Requested Check-In</span>
              </label>
              <input
                type="time"
                value={corrForm.requested_check_in}
                onChange={(e) => setCorrForm({ ...corrForm, requested_check_in: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <FormError message={corrFormErrors.requested_check_in} id="corr-checkin-err" />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                <span className="icon-badge-clock">
                  <Clock className="w-3.5 h-3.5" />
                </span>
                <span>Requested Check-Out</span>
              </label>
              <input
                type="time"
                value={corrForm.requested_check_out}
                onChange={(e) => setCorrForm({ ...corrForm, requested_check_out: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <FormError message={corrFormErrors.requested_check_out} id="corr-checkout-err" />
            </div>
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
            <button type="button" onClick={() => setActiveModal(null)} disabled={isSubmitting} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl shadow-lg disabled:opacity-50">
              {isSubmitting ? 'Submitting...' : 'Submit Correction Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* EARLYPASS REQUEST MODAL (SECTION 1) */}
      <Modal
        isOpen={activeModal === 'APPLY_EARLY_PASS'}
        onClose={() => setActiveModal(null)}
        title="EarlyPass – Early Exit Request"
      >
        <form onSubmit={handleEarlyPassSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-amber-400" />
                <span>Request Date</span>
              </label>
              <input
                type="date"
                value={earlyPassForm.request_date}
                onChange={(e) => setEarlyPassForm({ ...earlyPassForm, request_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <FormError message={earlyPassErrors.request_date} id="ep-form-date-err" />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Check-In Time</span>
              </label>
              <input
                type="time"
                value={earlyPassForm.check_in_time}
                onChange={(e) => setEarlyPassForm({ ...earlyPassForm, check_in_time: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <FormError message={earlyPassErrors.check_in_time} id="ep-form-checkin-err" />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-200 mb-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Requested Exit Time</span>
            </label>
            <input
              type="time"
              value={earlyPassForm.requested_exit_time}
              onChange={(e) => setEarlyPassForm({ ...earlyPassForm, requested_exit_time: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
            <FormError message={earlyPassErrors.requested_exit_time} id="ep-form-exit-err" />
          </div>

          {/* DURATION PREVIEW (SECTION 1) */}
          {(() => {
            const preview = calculateEarlyPassDuration();
            if (!preview) return null;
            if (preview.invalid) {
              return <p className="text-xs text-rose-400 font-medium">{preview.msg}</p>;
            }
            return (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-white/5 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>• Required Working Time:</span>
                  <span className="font-bold text-white">{preview.reqHours} hours</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>• Expected Working Time:</span>
                  <span className="font-bold text-amber-400">{preview.workingHoursStr}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>• Missing Hours (Waived):</span>
                  <span className="font-bold text-rose-300">{preview.missingHoursStr}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px] text-emerald-400">
                  <span>• Salary Deduction if Approved:</span>
                  <strong className="font-bold">₹0 (Full Day Salary Protected)</strong>
                </div>
              </div>
            );
          })()}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Leaving Early *</label>
            <textarea
              value={earlyPassForm.reason}
              onChange={(e) => setEarlyPassForm({ ...earlyPassForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="State genuine justification (e.g. Personal emergency, doctor consultation, exam)..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
            <FormError message={earlyPassErrors.reason} id="ep-form-reason-err" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Remarks</label>
            <input
              type="text"
              value={earlyPassForm.remarks}
              onChange={(e) => setEarlyPassForm({ ...earlyPassForm, remarks: e.target.value })}
              placeholder="Handover notes or additional details..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Attachment</label>
            <input
              type="file"
              onChange={(e) => setEarlyPassForm({ ...earlyPassForm, attachment: e.target.files?.[0] || null })}
              className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
            />
            <FormError message={earlyPassErrors.attachment} id="ep-form-attach-err" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit EarlyPass Request'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* CANCEL EARLYPASS CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={cancelEarlyPassModal.isOpen}
        onClose={() => setCancelEarlyPassModal({ isOpen: false, request: null, submitting: false })}
        onConfirm={handleCancelEarlyPass}
        title="Cancel EarlyPass Request"
        message={`Are you sure you want to cancel EarlyPass request ${cancelEarlyPassModal.request?.pass_reference}?`}
        confirmText="Yes, Cancel"
        variant="danger"
      />

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
