import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench, Users, CalendarCheck, Clock, Plus, Search,
  ArrowRight, ShieldCheck, AlertCircle, RefreshCw,
  CheckCircle2, XCircle, UserCheck, Calendar, BarChart3,
  Sparkles, CheckSquare, ShieldAlert, Coffee, Play, Pause,
  Shield, MapPin, DollarSign, Download, Printer, Trash2,
  Eye, Edit2, ChevronRight, Sliders, Info, Phone, Mail,
  FileText, ArrowUpRight, TrendingUp, AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';
import MaintenanceGeofenceModal from './MaintenanceGeofenceModal';

export const MaintenanceCEODashboard = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Active Tab: 'WORKERS' | 'REPORTS' | 'PAYSLIPS' | 'CONFIG'
  const [activeTab, setActiveTab] = useState('WORKERS');

  // Core Data
  const [dashboardData, setDashboardData] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [payrollData, setPayrollData] = useState(null);

  // Month/Year pickers for Reports & Payslips
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  // Filters
  const [staffRoleFilter, setStaffRoleFilter] = useState('ALL'); // 'ALL' | 'SUPERVISOR' | 'WORKER'
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [reportsRoleFilter, setReportsRoleFilter] = useState('ALL');
  const [payrollRoleFilter, setPayrollRoleFilter] = useState('ALL');

  // Modals
  const [geofenceModalOpen, setGeofenceModalOpen] = useState(false);
  const [addWorkerModalOpen, setAddWorkerModalOpen] = useState(false);
  const [removeWorkerModal, setRemoveWorkerModal] = useState({ isOpen: false, worker: null, reason: '', submitting: false });
  const [selectedPaySlip, setSelectedPaySlip] = useState(null);
  const [viewStaffModal, setViewStaffModal] = useState(null);

  // Add Worker Form State
  const [newWorker, setNewWorker] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    phone: '',
    shift: 'Morning',
    designation: '',
    salary: '30000',
    gender: 'Male',
    employment_status: 'ACTIVE',
    joining_date: new Date().toISOString().split('T')[0]
  });
  const [addingWorker, setAddingWorker] = useState(false);

  const months = [
    { num: 1, name: 'January' }, { num: 2, name: 'February' },
    { num: 3, name: 'March' }, { num: 4, name: 'April' },
    { num: 5, name: 'May' }, { num: 6, name: 'June' },
    { num: 7, name: 'July' }, { num: 8, name: 'August' },
    { num: 9, name: 'September' }, { num: 10, name: 'October' },
    { num: 11, name: 'November' }, { num: 12, name: 'December' }
  ];

  // 1. Fetch Dashboard & Staff
  const fetchDashboardAndStaff = async () => {
    try {
      setError(null);
      const [dashRes, staffRes] = await Promise.all([
        api.get('/maintenance/dashboard/'),
        api.get(`/maintenance/workers/?role=${staffRoleFilter}&shift=${shiftFilter}&status=${statusFilter}&search=${encodeURIComponent(searchQuery)}`)
      ]);
      setDashboardData(dashRes.data);
      const rawStaff = staffRes.data.results || staffRes.data || [];
      setStaffList(rawStaff);
    } catch (err) {
      console.error('Failed to load Maintenance CEO Dashboard data:', err);
      setError('Unable to load Maintenance executive overview. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 2. Fetch Attendance Reports
  const fetchReports = async () => {
    try {
      const res = await api.get(`/maintenance/attendance/monthly-summary/?year=${selectedYear}&month=${selectedMonth}&role=${reportsRoleFilter}`);
      setReportsData(res.data);
    } catch (err) {
      console.error('Failed to load monthly attendance reports:', err);
    }
  };

  // 3. Fetch Pay Slips
  const fetchPayroll = async () => {
    try {
      const res = await api.get(`/maintenance/payslips/?year=${selectedYear}&month=${selectedMonth}&role=${payrollRoleFilter}`);
      setPayrollData(res.data);
    } catch (err) {
      console.error('Failed to load payslips:', err);
    }
  };

  useEffect(() => {
    fetchDashboardAndStaff();
  }, [staffRoleFilter, shiftFilter, statusFilter]);

  useEffect(() => {
    if (activeTab === 'REPORTS') {
      fetchReports();
    } else if (activeTab === 'PAYSLIPS') {
      fetchPayroll();
    }
  }, [activeTab, selectedYear, selectedMonth, reportsRoleFilter, payrollRoleFilter]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardAndStaff();
    if (activeTab === 'REPORTS') fetchReports();
    if (activeTab === 'PAYSLIPS') fetchPayroll();
  };

  // Handle Add Worker Submission
  const handleAddWorkerSubmit = async (e) => {
    e.preventDefault();
    if (!newWorker.employee_id || !newWorker.full_name) {
      addToast('Worker ID and Full Name are required.', 'error');
      return;
    }
    setAddingWorker(true);
    try {
      const payload = {
        employee_id: newWorker.employee_id.trim(),
        full_name: newWorker.full_name.trim(),
        phone: newWorker.phone.trim(),
        email: newWorker.email.trim() || `${newWorker.employee_id.toLowerCase().trim()}.maint@frg.com`,
        password: 'Password123!',
        shift: newWorker.shift,
        salary: newWorker.salary || '30000',
        gender: newWorker.gender,
        joining_date: newWorker.joining_date,
        employment_status: newWorker.employment_status,
        work_mode: 'OFFICE'
      };

      await api.post('/maintenance/workers/', payload);
      addToast(`Maintenance worker ${newWorker.full_name} added successfully!`, 'success');
      setAddWorkerModalOpen(false);
      setNewWorker({
        employee_id: '',
        full_name: '',
        email: '',
        phone: '',
        shift: 'Morning',
        designation: '',
        salary: '30000',
        gender: 'Male',
        employment_status: 'ACTIVE',
        joining_date: new Date().toISOString().split('T')[0]
      });
      fetchDashboardAndStaff();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to add worker.';
      addToast(msg, 'error');
    } finally {
      setAddingWorker(false);
    }
  };

  // Handle Remove Worker
  const handleConfirmRemoveWorker = async () => {
    if (!removeWorkerModal.worker) return;
    setRemoveWorkerModal(prev => ({ ...prev, submitting: true }));
    try {
      await api.delete(`/maintenance/workers/${removeWorkerModal.worker.id}/`);
      addToast(`Worker ${removeWorkerModal.worker.full_name} removed from Maintenance.`, 'success');
      setRemoveWorkerModal({ isOpen: false, worker: null, reason: '', submitting: false });
      fetchDashboardAndStaff();
      if (activeTab === 'REPORTS') fetchReports();
      if (activeTab === 'PAYSLIPS') fetchPayroll();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to remove worker.';
      addToast(msg, 'error');
      setRemoveWorkerModal(prev => ({ ...prev, submitting: false }));
    }
  };

  // Toggle Worker Status
  const handleToggleStatus = async (worker) => {
    const nextStatus = worker.employment_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/maintenance/workers/${worker.id}/`, {
        employment_status: nextStatus
      });
      addToast(`Worker status updated to ${nextStatus}`, 'success');
      fetchDashboardAndStaff();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  // Export CSV for Attendance Reports
  const handleExportAttendanceCSV = () => {
    if (!reportsData?.results || reportsData.results.length === 0) {
      addToast('No data available to export.', 'info');
      return;
    }
    const headers = ['Staff ID', 'Name', 'Role', 'Designation', 'Shift', 'Present', 'Absent', 'Late', 'Leave', 'Half Day', 'Total Hours', 'Attendance %'];
    const rows = reportsData.results.map(r => [
      r.employee_id,
      `"${r.worker_name}"`,
      r.role,
      `"${r.designation}"`,
      r.shift,
      r.present,
      r.absent,
      r.late,
      r.leave,
      r.half_day,
      `"${r.total_hours || '0h'}"`,
      `${r.attendance_rate}%`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Maintenance_Attendance_${reportsData.month_name.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Attendance CSV downloaded.', 'success');
  };

  // Export CSV for Payroll
  const handleExportPayrollCSV = () => {
    if (!payrollData?.records || payrollData.records.length === 0) {
      addToast('No payroll data available to export.', 'info');
      return;
    }
    const headers = ['Staff ID', 'Name', 'Role', 'Designation', 'Base Salary (INR)', 'Days Worked', 'Days Present', 'Days Absent', 'Deductions (INR)', 'Net Payable (INR)', 'Status'];
    const rows = payrollData.records.map(r => [
      r.employee_code,
      `"${r.full_name}"`,
      r.role,
      `"${r.designation}"`,
      r.base_salary,
      r.days_worked,
      r.days_present,
      r.days_absent,
      r.deductions?.total_deductions || '0',
      r.net_payable,
      r.payment_status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Maintenance_Payroll_${payrollData.month_name.replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Payroll CSV downloaded.', 'success');
  };

  if (loading) return <LoadingState type="full" text="Loading Maintenance Executive Dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboardAndStaff} />;

  const workforce = dashboardData?.workforce || {};
  const supervisorsMetrics = dashboardData?.supervisors_metrics || {};
  const geofence = dashboardData?.geofence || {};
  const payrollOverview = dashboardData?.payroll_overview || {};
  const supervisorsList = dashboardData?.supervisors || [];

  const filteredStaff = staffList.filter(s => {
    if (staffRoleFilter === 'SUPERVISOR' && s.role !== 'SUPERVISOR') return false;
    if (staffRoleFilter === 'WORKER' && s.role === 'SUPERVISOR') return false;
    if (shiftFilter !== 'ALL' && s.shift !== shiftFilter) return false;
    if (statusFilter !== 'ALL' && s.employment_status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.employee_id?.toLowerCase().includes(q) ||
      s.designation_title?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* CEO Worksite Geofence Configuration Modal */}
      <MaintenanceGeofenceModal
        isOpen={geofenceModalOpen}
        onClose={() => setGeofenceModalOpen(false)}
        onSaved={fetchDashboardAndStaff}
      />

      {/* EXECUTIVE HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Shield className="w-3.5 h-3.5 text-cyan-400" />
              CEO EXECUTIVE GOVERNANCE
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
              <Wrench className="w-3 h-3" />
              Maintenance Department
            </span>
            {geofence?.is_active && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                <CheckCircle2 className="w-3 h-3" />
                Worksite Geofence Active ({geofence.radius_meters}m)
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Maintenance Department Oversight & Configuration
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Complete executive control over worksite geofences, field technicians, supervisor attendance audits, and departmental compensation.
          </p>
        </div>

        {/* Executive Action Cluster */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setGeofenceModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs tracking-wide border border-cyan-500/30 transition-all shadow-lg shadow-cyan-500/10 hover:scale-[1.02]"
          >
            <MapPin className="w-4 h-4 text-cyan-400" />
            Configure Geofence
          </button>

          <button
            onClick={() => setAddWorkerModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Add Worker
          </button>
        </div>
      </div>

      {/* 4 EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Workforce Breakdown */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/20 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Headcount</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-white">
              {payrollOverview.total_staff || (workforce.total_workers + (supervisorsMetrics.total_supervisors || 0))}
            </span>
            <span className="text-xs text-slate-400">total staff</span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span>{supervisorsMetrics.total_supervisors || 0} Supervisors</span>
            <span className="text-cyan-400 font-semibold">{workforce.total_workers || 0} Field Workers</span>
          </div>
        </div>

        {/* KPI 2: Today's Compliance */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/20 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Attendance</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-mono font-black text-emerald-400">
              {workforce.attendance_percentage || 0}%
            </span>
            <span className="text-xs text-emerald-400/80 font-medium">compliance</span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400">
            <span>{supervisorsMetrics.clocked_in_today || 0} Sup. Clocked In</span>
            <span className="text-emerald-400 font-semibold">{workforce.present || 0} Workers Present</span>
          </div>
        </div>

        {/* KPI 3: Geofence Power */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40 border border-cyan-500/20 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Worksite Geofence</span>
            <button
              onClick={() => setGeofenceModalOpen(true)}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline"
            >
              Modify
            </button>
          </div>
          <div className="mt-3">
            <p className="text-base font-bold text-white truncate" title={geofence?.site_name}>
              {geofence?.site_name || 'Central Worksite'}
            </p>
            <p className="text-xs text-cyan-300/80 font-mono mt-0.5">
              Radius: {geofence?.radius_meters || 100}m ({geofence?.is_active ? 'Active' : 'Disabled'})
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] text-xs text-slate-400 truncate">
            GPS: {geofence?.latitude?.toFixed(4)}, {geofence?.longitude?.toFixed(4)}
          </div>
        </div>

        {/* KPI 4: Monthly Payroll */}
        <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/20 p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Est. Monthly Payroll</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-mono font-black text-amber-300">
              ₹{(payrollOverview.estimated_monthly_payroll || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
            <span className="text-slate-400">{today.toLocaleString('default', { month: 'short' })} {today.getFullYear()}</span>
            <button
              onClick={() => setActiveTab('PAYSLIPS')}
              className="font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              View Slips <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* SUPERVISOR LIVE AUDIT CARD */}
      <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Maintenance Supervisors On-Site Audit
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live clock-in timestamps, working durations, and attendance state of field supervisors.
            </p>
          </div>
          <span className="text-xs text-indigo-400 font-mono">
            {supervisorsList.length} registered supervisor(s)
          </span>
        </div>

        {supervisorsList.length === 0 ? (
          <p className="text-xs text-slate-400 py-3">No maintenance supervisors found.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {supervisorsList.map((sup) => (
              <div
                key={sup.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-white/[0.06] flex flex-col justify-between"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-indigo-400">{sup.employee_id}</span>
                    <h4 className="text-sm font-bold text-white">{sup.full_name}</h4>
                    <p className="text-[11px] text-slate-400">{sup.email}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">Phone: {sup.phone}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                    sup.is_clocked_in
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                      : sup.status === 'CLOCKED_OUT'
                      ? 'bg-slate-500/10 text-slate-400 border-slate-500/25'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/25'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${sup.is_clocked_in ? 'bg-emerald-400 animate-pulse' : 'bg-current'}`} />
                    {sup.is_clocked_in ? 'ON SITE' : sup.status === 'CLOCKED_OUT' ? 'CLOCKED OUT' : 'NOT CLOCKED IN'}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Clock-In</span>
                    <span className="font-mono font-semibold text-white">{sup.clock_in || '--:--'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Working Time</span>
                    <span className="font-mono font-bold text-cyan-400">{sup.working_time || '00h 00m'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4-TAB EXECUTIVE PANEL NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('WORKERS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'WORKERS'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Users className="w-4 h-4" />
          Worker & Staff Management
          <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
            {filteredStaff.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('REPORTS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'REPORTS'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Attendance Reports (Supervisors & Workers)
        </button>

        <button
          onClick={() => setActiveTab('PAYSLIPS')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'PAYSLIPS'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Pay Slips & Compensation
        </button>

        <button
          onClick={() => setActiveTab('CONFIG')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'CONFIG'
              ? 'bg-gradient-to-r from-brand-600 to-cyan-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          <Sliders className="w-4 h-4" />
          Department Configuration & Geofence
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: WORKER & STAFF MANAGEMENT (ADD / REMOVE WORKERS) */}
      {/* ============================================================ */}
      {activeTab === 'WORKERS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, ID, phone..."
                className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              {/* Role filter */}
              <select
                value={staffRoleFilter}
                onChange={e => setStaffRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Roles (Supervisors & Workers)</option>
                <option value="WORKER">Field Workers Only</option>
                <option value="SUPERVISOR">Supervisors Only</option>
              </select>

              {/* Shift Filter */}
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

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <button
                onClick={() => setAddWorkerModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Worker
              </button>
            </div>
          </div>

          {/* Workers Table */}
          <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-xl overflow-hidden">
            {filteredStaff.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="No Staff Matching Criteria"
                  description="Try adjusting your role or search filters, or click Add Worker to onboard new staff."
                  actionText="Add Worker"
                  onAction={() => setAddWorkerModalOpen(true)}
                />
              </div>
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Staff ID</th>
                      <th className="py-3.5 px-4">Name & Email</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Designation</th>
                      <th className="py-3.5 px-4">Shift</th>
                      <th className="py-3.5 px-4">Phone</th>
                      <th className="py-3.5 px-4">Compensation</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Today's Attendance</th>
                      <th className="py-3.5 px-4 text-right">CEO Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filteredStaff.map(w => {
                      const todayAtt = w.today_attendance || {};
                      const isSupervisor = w.role === 'SUPERVISOR';
                      const isAct = w.employment_status === 'ACTIVE';

                      return (
                        <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                            {w.employee_id}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-100">{w.full_name}</div>
                            <div className="text-[10px] text-slate-500">{w.email}</div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isSupervisor
                                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                            }`}>
                              {isSupervisor ? 'SUPERVISOR' : 'FIELD WORKER'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300">
                            {w.designation_title || (isSupervisor ? 'Supervisor' : 'Worker')}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {w.shift || 'Morning'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono">
                            {w.phone || '-'}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-300">
                            ₹{Number(w.salary || (isSupervisor ? 75000 : 30000)).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={w.employment_status || 'ACTIVE'} />
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={todayAtt.status || 'NOT_MARKED'} />
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => setViewStaffModal(w)}
                                className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {!isSupervisor && (
                                <button
                                  onClick={() => handleToggleStatus(w)}
                                  className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-colors ${
                                    isAct
                                      ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/20'
                                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                                  }`}
                                  title={isAct ? 'Deactivate Worker' : 'Activate Worker'}
                                >
                                  {isAct ? 'Deactivate' : 'Activate'}
                                </button>
                              )}

                              {!isSupervisor && (
                                <button
                                  onClick={() => setRemoveWorkerModal({ isOpen: true, worker: w, reason: '', submitting: false })}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 transition-colors"
                                  title="Remove Worker (CEO Delete)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: ATTENDANCE REPORTS (SUPERVISORS & WORKERS) */}
      {/* ============================================================ */}
      {activeTab === 'REPORTS' && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300">Period:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {months.map(m => (
                  <option key={m.num} value={m.num}>{m.name}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Role filter */}
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span>View:</span>
                <select
                  value={reportsRoleFilter}
                  onChange={e => setReportsRoleFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ALL">All Staff (Supervisors & Workers)</option>
                  <option value="SUPERVISOR">Supervisors Only</option>
                  <option value="WORKER">Field Workers Only</option>
                </select>
              </div>

              <button
                onClick={handleExportAttendanceCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/[0.1] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Reports Table */}
          <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-xl overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Maintenance Attendance Audit — {reportsData?.month_name || `${selectedMonth}/${selectedYear}`}
              </h3>
              <div className="text-xs text-slate-400">
                {reportsData?.supervisors_count || 0} Supervisors • {reportsData?.workers_count || 0} Workers
              </div>
            </div>

            {(!reportsData?.results || reportsData.results.length === 0) ? (
              <EmptyState
                title="No Attendance Records for this Month"
                description="No maintenance personnel have recorded attendance for this calendar period."
              />
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-3">Staff ID</th>
                      <th className="py-3 px-3">Name</th>
                      <th className="py-3 px-3">Role</th>
                      <th className="py-3 px-3">Designation</th>
                      <th className="py-3 px-3">Shift</th>
                      <th className="py-3 px-3 text-center text-emerald-400">Present</th>
                      <th className="py-3 px-3 text-center text-rose-400">Absent</th>
                      <th className="py-3 px-3 text-center text-amber-400">Late</th>
                      <th className="py-3 px-3 text-center text-purple-400">Leave</th>
                      <th className="py-3 px-3 text-center text-orange-400">Half Day</th>
                      <th className="py-3 px-3 text-center text-cyan-300">Total Hours</th>
                      <th className="py-3 px-3 text-right">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {reportsData.results.map(r => (
                      <tr key={r.worker_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-cyan-300">
                          {r.employee_id}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-100">
                          {r.worker_name}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.role === 'SUPERVISOR'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {r.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          {r.designation}
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
                        <td className="py-3 px-3 text-center font-mono font-bold text-cyan-300">
                          {r.total_hours || '0h 00m'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-emerald-400">
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
      )}

      {/* ============================================================ */}
      {/* TAB 3: PAY SLIPS & COMPENSATION (SUPERVISORS & WORKERS) */}
      {/* ============================================================ */}
      {activeTab === 'PAYSLIPS' && (
        <div className="space-y-4">
          {/* Controls & Financial Banner */}
          <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-300">Pay Period:</span>
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {months.map(m => (
                  <option key={m.num} value={m.num}>{m.name}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={payrollRoleFilter}
                onChange={e => setPayrollRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700/60 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Staff (Supervisors & Workers)</option>
                <option value="SUPERVISOR">Supervisors Only</option>
                <option value="WORKER">Field Workers Only</option>
              </select>

              <button
                onClick={handleExportPayrollCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-white/[0.1] transition-all"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Export Payroll CSV
              </button>
            </div>
          </div>

          {/* Financial Summary Strip */}
          {payrollData?.summary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.08]">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Gross Salary Sum</span>
                <p className="text-xl font-mono font-black text-white mt-1">
                  ₹{Number(payrollData.summary.total_gross || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20">
                <span className="text-[11px] font-bold text-rose-400 uppercase">Total Absent/Penalty Cuts</span>
                <p className="text-xl font-mono font-black text-rose-300 mt-1">
                  - ₹{Number(payrollData.summary.total_deductions || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <span className="text-[11px] font-bold text-emerald-400 uppercase">Net Department Payout</span>
                <p className="text-xl font-mono font-black text-emerald-300 mt-1">
                  ₹{Number(payrollData.summary.total_net_payroll || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          )}

          {/* Payslips Table */}
          <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-xl overflow-hidden p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-400" />
                Staff Compensation & Pay Slips — {payrollData?.month_name || `${selectedMonth}/${selectedYear}`}
              </h3>
              <span className="text-xs text-slate-400">
                {payrollData?.records?.length || 0} employees calculated
              </span>
            </div>

            {(!payrollData?.records || payrollData.records.length === 0) ? (
              <EmptyState
                title="No Payroll Data Available"
                description="Unable to compute payroll records for the selected month."
              />
            ) : (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                      <th className="py-3.5 px-4">Staff ID</th>
                      <th className="py-3.5 px-4">Name</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Designation</th>
                      <th className="py-3.5 px-4">Base Salary</th>
                      <th className="py-3.5 px-4 text-center">Days Worked</th>
                      <th className="py-3.5 px-4 text-center">Absents</th>
                      <th className="py-3.5 px-4 text-rose-300">Deductions</th>
                      <th className="py-3.5 px-4 text-emerald-400">Net Payable</th>
                      <th className="py-3.5 px-4 text-right">Pay Slip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {payrollData.records.map(rec => (
                      <tr key={rec.employee_id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-cyan-300">
                          {rec.employee_code}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-100">
                          {rec.full_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.role === 'SUPERVISOR'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                              : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {rec.role}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {rec.designation}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          ₹{Number(rec.base_salary).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-white">
                          {rec.days_worked} / {rec.days_in_month}
                        </td>
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-rose-400">
                          {rec.days_absent}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-rose-400">
                          - ₹{Number(rec.deductions?.total_deductions || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 font-mono font-black text-emerald-400 text-sm">
                          ₹{Number(rec.net_payable).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setSelectedPaySlip(rec)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 font-bold text-xs transition-all hover:scale-[1.02]"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 4: DEPARTMENT CONFIGURATION & GEOFENCE POWERS */}
      {/* ============================================================ */}
      {activeTab === 'CONFIG' && (
        <div className="space-y-6">
          {/* Worksite Geofence Configuration Card */}
          <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  Worksite Geofence & Location Enforcement
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  GPS coordinates and radius boundary inside which maintenance supervisors and workers must operate.
                </p>
              </div>

              <button
                onClick={() => setGeofenceModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition-all"
              >
                <MapPin className="w-4 h-4" />
                Launch Interactive Map Configurator
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
              <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.06]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Site Name</span>
                <p className="text-base font-bold text-white mt-1">{geofence?.site_name || 'Maintenance Central Works'}</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.06]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Allowed Radius</span>
                <p className="text-base font-mono font-bold text-cyan-400 mt-1">{geofence?.radius_meters || 100} meters</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.06]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">GPS Center Coordinates</span>
                <p className="text-xs font-mono font-bold text-slate-300 mt-1">
                  Lat: {geofence?.latitude?.toFixed(6) || 17.385044}
                  <br />
                  Lng: {geofence?.longitude?.toFixed(6) || 78.486671}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.06]">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Status & Last Updated</span>
                <p className="text-xs font-semibold text-emerald-400 mt-1">
                  {geofence?.is_active ? 'Active & Enforced' : 'Disabled'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Updated: {geofence?.updated_at ? new Date(geofence.updated_at).toLocaleDateString() : 'System default'}
                </p>
              </div>
            </div>
          </div>

          {/* Department Operating Parameters */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-400" />
                Maintenance Shift Schedule Configuration
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Morning Shift</span>
                    <span className="text-slate-400 text-[11px]">Primary operational window</span>
                  </div>
                  <span className="font-mono font-bold text-cyan-400">08:00 AM – 04:00 PM</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Evening Shift</span>
                    <span className="text-slate-400 text-[11px]">Facility secondary coverage</span>
                  </div>
                  <span className="font-mono font-bold text-indigo-400">02:00 PM – 10:00 PM</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Night Shift</span>
                    <span className="text-slate-400 text-[11px]">Emergency maintenance crew</span>
                  </div>
                  <span className="font-mono font-bold text-purple-400">10:00 PM – 06:00 AM</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Coffee className="w-4 h-4 text-amber-400" />
                Lunch Break & Geofence Policy
              </h3>
              <div className="space-y-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <span className="font-bold text-white block">Geofence Gated Breaks</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Supervisors and workers must have their live GPS verified inside the {geofence?.radius_meters || 100}m worksite radius before resuming from lunch breaks.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <span className="font-bold text-white block">Supervisor Clock-In Rule</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Field supervisors must record their own clock-in before worker attendance rosters or break actions can be submitted.
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06]">
                  <span className="font-bold text-white block">Department Isolation Protocol</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Maintenance workforce records are isolated from other departments (Architecture, Trainees, Engineering) to guarantee independent roster and salary compliance.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 1: ADD MAINTENANCE WORKER (CEO POWERS) */}
      {/* ============================================================ */}
      <Modal
        isOpen={addWorkerModalOpen}
        onClose={() => setAddWorkerModalOpen(false)}
        title="Add New Maintenance Worker"
      >
        <form onSubmit={handleAddWorkerSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Worker ID *</label>
              <input
                type="text"
                required
                value={newWorker.employee_id}
                onChange={e => setNewWorker({ ...newWorker, employee_id: e.target.value })}
                placeholder="e.g. MNT-W-010"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={newWorker.full_name}
                onChange={e => setNewWorker({ ...newWorker, full_name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
              <input
                type="tel"
                value={newWorker.phone}
                onChange={e => setNewWorker({ ...newWorker, phone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Shift</label>
              <select
                value={newWorker.shift}
                onChange={e => setNewWorker({ ...newWorker, shift: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Morning">Morning Shift (08:00 - 16:00)</option>
                <option value="Evening">Evening Shift (14:00 - 22:00)</option>
                <option value="Night">Night Shift (22:00 - 06:00)</option>
                <option value="General">General Shift</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly Base Salary (INR)</label>
              <input
                type="number"
                value={newWorker.salary}
                onChange={e => setNewWorker({ ...newWorker, salary: e.target.value })}
                placeholder="30000"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Gender</label>
              <select
                value={newWorker.gender}
                onChange={e => setNewWorker({ ...newWorker, gender: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAddWorkerModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addingWorker}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md flex items-center gap-2"
            >
              {addingWorker ? 'Adding Worker...' : 'Create Worker Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 2: REMOVE WORKER CONFIRMATION (CEO POWERS) */}
      {/* ============================================================ */}
      <Modal
        isOpen={removeWorkerModal.isOpen}
        onClose={() => setRemoveWorkerModal({ isOpen: false, worker: null, reason: '', submitting: false })}
        title="Remove Maintenance Worker"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-200">
              <p className="font-bold text-sm text-white mb-1">
                Confirm Worker Removal
              </p>
              Are you sure you want to remove <span className="font-bold text-white">{removeWorkerModal.worker?.full_name}</span> (ID: <span className="font-mono font-bold text-cyan-300">{removeWorkerModal.worker?.employee_id}</span>) from the Maintenance Department?
              This will remove the worker's roster record and revoke mobile credentials.
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Reason for Removal (Audit Log)
            </label>
            <input
              type="text"
              value={removeWorkerModal.reason}
              onChange={e => setRemoveWorkerModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Contract completed, Resigned, Department transfer"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setRemoveWorkerModal({ isOpen: false, worker: null, reason: '', submitting: false })}
              className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={removeWorkerModal.submitting}
              onClick={handleConfirmRemoveWorker}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md flex items-center gap-2"
            >
              {removeWorkerModal.submitting ? 'Removing...' : 'Confirm Delete Worker'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 3: EXECUTIVE PRINTABLE PAY SLIP */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(selectedPaySlip)}
        onClose={() => setSelectedPaySlip(null)}
        title={`Pay Slip — ${selectedPaySlip?.full_name || ''}`}
      >
        {selectedPaySlip && (
          <div className="space-y-5 text-xs text-slate-200" id="printable-payslip">
            {/* Payslip Header */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest block">FRG GROUP OF ENTERPRISES</span>
                <h3 className="text-base font-black text-white">Maintenance Department Pay Slip</h3>
                <p className="text-[11px] text-slate-400">Pay Period: {selectedPaySlip.pay_period}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  {selectedPaySlip.payment_status}
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-1">{selectedPaySlip.payslip_number}</p>
              </div>
            </div>

            {/* Staff Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] text-[11px]">
              <div>
                <span className="text-slate-500 uppercase text-[9px] block">Staff ID</span>
                <span className="font-mono font-bold text-white">{selectedPaySlip.employee_code}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[9px] block">Role</span>
                <span className="font-semibold text-cyan-300">{selectedPaySlip.role}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[9px] block">Designation</span>
                <span className="font-semibold text-white">{selectedPaySlip.designation}</span>
              </div>
              <div>
                <span className="text-slate-500 uppercase text-[9px] block">Days Worked</span>
                <span className="font-mono font-bold text-white">{selectedPaySlip.days_worked} / {selectedPaySlip.days_in_month}</span>
              </div>
            </div>

            {/* Earnings & Deductions Tables */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earnings */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] space-y-2">
                <span className="font-bold text-emerald-400 text-xs uppercase block border-b border-white/[0.06] pb-1">Earnings</span>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>Basic Salary</span>
                  <span className="font-mono">₹{Number(selectedPaySlip.earnings?.basic || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>House Rent Allowance (HRA)</span>
                  <span className="font-mono">₹{Number(selectedPaySlip.earnings?.hra || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>Conveyance Allowance</span>
                  <span className="font-mono">₹{Number(selectedPaySlip.earnings?.conveyance || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>Special Allowance</span>
                  <span className="font-mono">₹{Number(selectedPaySlip.earnings?.allowances || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-white">
                  <span>Gross Total Earnings</span>
                  <span className="font-mono text-emerald-300">₹{Number(selectedPaySlip.base_salary).toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Deductions */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/[0.06] space-y-2">
                <span className="font-bold text-rose-400 text-xs uppercase block border-b border-white/[0.06] pb-1">Deductions</span>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>Absent Days Cut ({selectedPaySlip.days_absent} days)</span>
                  <span className="font-mono text-rose-300">- ₹{Number(selectedPaySlip.deductions?.absent_deduction || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04]">
                  <span>Half-Day Penalties ({selectedPaySlip.days_half_day || 0})</span>
                  <span className="font-mono text-rose-300">- ₹{Number(selectedPaySlip.deductions?.half_day_deduction || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04] text-slate-500">
                  <span>Provident Fund (PF)</span>
                  <span className="font-mono">₹0.00</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/[0.04] text-slate-500">
                  <span>Professional Tax</span>
                  <span className="font-mono">₹0.00</span>
                </div>
                <div className="flex justify-between pt-2 font-bold text-white">
                  <span>Total Deductions</span>
                  <span className="font-mono text-rose-400">- ₹{Number(selectedPaySlip.deductions?.total_deductions || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Net Amount Card */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Net Payable Compensation</span>
                <span className="text-2xl font-mono font-black text-white">
                  ₹{Number(selectedPaySlip.net_payable).toLocaleString('en-IN')}
                </span>
              </div>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] text-white font-bold text-xs border border-white/[0.1] transition-all"
              >
                <Printer className="w-4 h-4" />
                Print Pay Slip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* MODAL 4: VIEW STAFF PROFILE */}
      {/* ============================================================ */}
      <Modal
        isOpen={Boolean(viewStaffModal)}
        onClose={() => setViewStaffModal(null)}
        title={`Staff Details: ${viewStaffModal?.full_name || ''}`}
      >
        {viewStaffModal && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-white/[0.08] flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white">{viewStaffModal.full_name}</h4>
                <p className="text-slate-400">{viewStaffModal.email}</p>
                <p className="text-cyan-400 font-mono mt-0.5">ID: {viewStaffModal.employee_id}</p>
              </div>
              <StatusBadge status={viewStaffModal.employment_status || 'ACTIVE'} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-300">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 text-[10px] block uppercase">Designation</span>
                <span className="font-semibold text-white">{viewStaffModal.designation_title || 'Worker'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 text-[10px] block uppercase">Shift</span>
                <span className="font-semibold text-white">{viewStaffModal.shift || 'Morning'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 text-[10px] block uppercase">Phone</span>
                <span className="font-semibold text-white font-mono">{viewStaffModal.phone || 'Not recorded'}</span>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-slate-500 text-[10px] block uppercase">Monthly Base Salary</span>
                <span className="font-semibold text-amber-400 font-mono">
                  ₹{Number(viewStaffModal.salary || 30000).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MaintenanceCEODashboard;
