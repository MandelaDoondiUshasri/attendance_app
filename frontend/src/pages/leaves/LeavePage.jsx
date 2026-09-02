import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, CheckCircle, XCircle, Calendar as CalendarIcon, 
  Users, Clock, AlertCircle, Search, Filter, ChevronLeft, 
  ChevronRight, ArrowRight, Shield, Layers, UserCheck, Edit
} from 'lucide-react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  parseISO 
} from 'date-fns';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import EmptyState from '../../components/common/states/EmptyState';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import Modal from '../../components/common/Modal';
import FormError from '../../components/common/states/FormError';

export const LeavePage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const isManagement = ['CEO', 'HR', 'SYSTEM_ADMIN'].includes(user?.role);

  const [activeTab, setActiveTab] = useState('balances'); // 'balances' | 'requests' | 'calendar'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Leave Requests Data
  const [leaves, setLeaves] = useState([]);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Balances & Quota Summary Data
  const [summaryData, setSummaryData] = useState(null);
  const [searchEmployee, setSearchEmployee] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [calLoading, setCalLoading] = useState(false);
  const [calFilterEmp, setCalFilterEmp] = useState('');
  const [calFilterStatus, setCalFilterStatus] = useState('ALL'); // 'ALL' | 'APPROVED' | 'PENDING'
  const [selectedDayEvents, setSelectedDayEvents] = useState(null);

  // Rejection Modal State
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    id: null,
    reason: '',
    error: ''
  });

  // Management Edit Leave Modal State
  const [editModal, setEditModal] = useState({
    isOpen: false,
    leave: null,
    form: {
      leave_type: '',
      start_date: '',
      end_date: '',
      status: 'PENDING',
      reason: '',
      is_half_day: false,
      half_day_period: 'FIRST_HALF',
      work_mode: 'OFFICE'
    },
    error: '',
    loading: false
  });

  // Adjust Quota Modal State
  const [adjustModal, setAdjustModal] = useState({
    isOpen: false,
    employee: null,
    adjustments: [], // Array of { leave_type_id, allocated_days, remaining_days, name }
    error: '',
    loading: false
  });

  const openAdjustModal = (emp) => {
    setAdjustModal({
      isOpen: true,
      employee: emp,
      adjustments: emp.balances.map(b => ({
        leave_type_id: b.leave_type_id,
        name: b.name,
        allocated_days: b.days_allowed,
        remaining_days: b.remaining_days
      })),
      error: '',
      loading: false
    });
  };

  const handleAdjustChange = (idx, field, value) => {
    const newAdj = [...adjustModal.adjustments];
    newAdj[idx][field] = value;
    setAdjustModal(prev => ({ ...prev, adjustments: newAdj }));
  };

  const submitAdjustQuota = async (e) => {
    e.preventDefault();
    try {
      setAdjustModal(prev => ({ ...prev, loading: true, error: '' }));
      await api.post('/leaves/balances/adjust/', {
        employee_id: adjustModal.employee.employee_id,
        adjustments: adjustModal.adjustments
      });
      addToast('Leave balances adjusted successfully', 'success');
      setAdjustModal(prev => ({ ...prev, isOpen: false }));
      fetchData();
    } catch (err) {
      setAdjustModal(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.error || 'Failed to adjust balances'
      }));
    }
  };

  const openEditModal = (leave) => {
    setEditModal({
      isOpen: true,
      leave,
      form: {
        leave_type: leave.leave_type || '',
        start_date: leave.start_date || '',
        end_date: leave.end_date || '',
        status: leave.status || 'PENDING',
        reason: leave.reason || '',
        is_half_day: leave.is_half_day || false,
        half_day_period: leave.half_day_period || 'FIRST_HALF',
        work_mode: leave.work_mode || 'OFFICE'
      },
      error: '',
      loading: false
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModal.form.start_date || !editModal.form.end_date) {
      setEditModal(prev => ({ ...prev, error: 'Start date and end date are required.' }));
      return;
    }
    if (new Date(editModal.form.end_date) < new Date(editModal.form.start_date)) {
      setEditModal(prev => ({ ...prev, error: 'End date cannot be earlier than start date.' }));
      return;
    }

    try {
      setEditModal(prev => ({ ...prev, loading: true, error: '' }));
      await api.patch(`/leaves/requests/${editModal.leave.id}/`, {
        leave_type: editModal.form.leave_type ? parseInt(editModal.form.leave_type) : editModal.leave.leave_type,
        start_date: editModal.form.start_date,
        end_date: editModal.form.end_date,
        status: editModal.form.status,
        reason: editModal.form.reason,
        is_half_day: editModal.form.is_half_day,
        half_day_period: editModal.form.half_day_period,
        work_mode: editModal.form.work_mode
      });
      addToast('Employee leave record updated successfully!', 'success');
      setEditModal(prev => ({ ...prev, isOpen: false, leave: null, loading: false }));
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchData();
      if (activeTab === 'calendar') fetchCalendar(currentDate, calFilterEmp, calFilterStatus);
    } catch (err) {
      setEditModal(prev => ({
        ...prev,
        loading: false,
        error: err.response?.data?.error || err.response?.data?.detail || 'Failed to update leave record.'
      }));
    }
  };

  const fetchData = async () => {
    try {
      setError(null);
      const [reqRes, sumRes] = await Promise.all([
        api.get('/leaves/requests/'),
        api.get('/leaves/balances/summary/')
      ]);
      setLeaves(reqRes.data.results || reqRes.data || []);
      setSummaryData(sumRes.data);
    } catch (e) {
      console.error('Failed to load leave records:', e);
      setError('Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCalendar = async (date, empId = '', status = 'ALL') => {
    try {
      setCalLoading(true);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      let url = `/attendance/holidays/calendar-events/?year=${year}&month=${month}`;
      if (empId) url += `&employee_id=${empId}`;
      if (status !== 'ALL') url += `&status=${status}`;

      const res = await api.get(url);
      const parsed = (res.data.events || []).map(ev => ({
        ...ev,
        dateObj: parseISO(ev.date)
      }));
      setCalendarEvents(parsed);
    } catch (e) {
      console.error('Failed to load calendar events:', e);
    } finally {
      setCalLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'calendar') {
      fetchCalendar(currentDate, calFilterEmp, calFilterStatus);
    }
  }, [currentDate, activeTab, calFilterEmp, calFilterStatus]);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/leaves/requests/${id}/approve/`);
      addToast('Leave request approved successfully', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchData();
      if (activeTab === 'calendar') fetchCalendar(currentDate, calFilterEmp, calFilterStatus);
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteLeave = async (id) => {
    if (!window.confirm('Are you sure you want to cancel and delete this pending leave request?')) return;
    try {
      setActionLoadingId(id);
      await api.delete(`/leaves/requests/${id}/`);
      addToast('Leave request cancelled successfully', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchData();
      if (activeTab === 'calendar') fetchCalendar(currentDate, calFilterEmp, calFilterStatus);
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to cancel leave request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (id) => {
    setRejectModal({
      isOpen: true,
      id,
      reason: '',
      error: ''
    });
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.reason?.trim()) {
      setRejectModal({ ...rejectModal, error: 'Rejection reason is required.' });
      return;
    }

    try {
      setActionLoadingId(rejectModal.id);
      await api.post(`/leaves/requests/${rejectModal.id}/reject/`, { rejection_reason: rejectModal.reason.trim() });
      addToast('Leave request rejected', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      setRejectModal({ isOpen: false, id: null, reason: '', error: '' });
      fetchData();
      if (activeTab === 'calendar') fetchCalendar(currentDate, calFilterEmp, calFilterStatus);
    } catch (e) {
      addToast(e.response?.data?.error || 'Rejection failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Employees for Matrix Table
  const filteredEmployees = useMemo(() => {
    if (!summaryData?.employees) return [];
    return summaryData.employees.filter(emp => {
      const matchSearch = emp.full_name.toLowerCase().includes(searchEmployee.toLowerCase()) ||
                          emp.employee_code.toLowerCase().includes(searchEmployee.toLowerCase()) ||
                          emp.email.toLowerCase().includes(searchEmployee.toLowerCase());
      const matchDept = !selectedDept || String(emp.department_id) === String(selectedDept) || emp.department_name === selectedDept;
      return matchSearch && matchDept;
    });
  }, [summaryData, searchEmployee, selectedDept]);

  // Unique departments for filter dropdown
  const departments = useMemo(() => {
    if (!summaryData?.employees) return [];
    const map = new Map();
    summaryData.employees.forEach(e => {
      if (e.department_id && e.department_name) {
        map.set(e.department_id, e.department_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [summaryData]);

  if (loading) return <LoadingState type="full" text="Loading leave governance system..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  const kpis = summaryData?.kpis;
  const mySummary = summaryData?.my_summary;
  const leaveTypes = summaryData?.leave_types || [];

  return (
    <div className="space-y-6">
      {/* ─── Header & Mode Selector ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-400" />
            {isManagement ? 'Leave Governance & Quota Control' : 'My Leave Portfolio'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isManagement 
              ? 'Complete visibility of employee leave balances, planned leaves, and interactive calendar scheduling' 
              : 'Track your used vs remaining leave quota and view all scheduled leave dates on your calendar'}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setActiveTab('balances')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'balances'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            {isManagement ? 'Quota Matrix' : 'My Leave Balances'}
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'requests'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            Requests ({leaves.filter(l => l.status === 'PENDING').length})
          </button>
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            Live Calendar
          </button>
        </div>
      </div>

      {/* ─── Management KPI Summary Cards ─────────────────────────── */}
      {isManagement && kpis && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Org Pool</span>
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400"><Layers className="w-4 h-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-black text-white font-mono">{kpis.org_total_allowed} <span className="text-xs text-slate-400 font-sans font-normal">days</span></div>
            <div className="text-[10px] text-slate-500 mt-1">Total leave entitlement across {kpis.total_employees} staff</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Used / Availed</span>
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400"><CheckCircle className="w-4 h-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-black text-purple-300 font-mono">{kpis.org_total_used} <span className="text-xs text-slate-400 font-sans font-normal">days</span></div>
            <div className="text-[10px] text-slate-500 mt-1">{kpis.org_total_remaining} days remaining in pool</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pending / Planned</span>
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400"><Clock className="w-4 h-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-black text-amber-300 font-mono">{kpis.pending_requests_count} <span className="text-xs text-slate-400 font-sans font-normal">requests</span></div>
            <div className="text-[10px] text-amber-400/80 mt-1">{kpis.org_total_pending} days awaiting approval</div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">On Leave Today</span>
              <span className="p-2 rounded-xl bg-rose-500/10 text-rose-400"><CalendarIcon className="w-4 h-4" /></span>
            </div>
            <div className="mt-2 text-2xl font-black text-rose-300 font-mono">{kpis.today_on_leave} <span className="text-xs text-slate-400 font-sans font-normal">employees</span></div>
            <div className="text-[10px] text-slate-500 mt-1">Synchronized with live attendance</div>
          </div>
        </div>
      )}

      {/* ─── Employee Personal Quota Cards ────────────────────────── */}
      {!isManagement && mySummary && (
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Leave Quota Breakdown</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {mySummary.balances.map((b) => (
              <div key={b.leave_type_id} className="glass-panel p-5 rounded-2xl border border-slate-800 relative overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white">{b.name}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                    {b.code}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 my-2">
                  <span className="text-3xl font-black text-emerald-400 font-mono">{b.remaining_days}</span>
                  <span className="text-xs text-slate-400">/ {b.days_allowed} days available</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden mt-3">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: `${Math.min(100, (b.remaining_days / (b.days_allowed || 1)) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-2">
                  <span>Used: <strong className="text-purple-400 font-mono">{b.used_days}d</strong></span>
                  {b.pending_days > 0 && (
                    <span>Planned: <strong className="text-amber-400 font-mono">{b.pending_days}d pending</strong></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── TAB 1: BALANCES / QUOTA MATRIX (CEO / HR VIEW) ───────── */}
      {activeTab === 'balances' && isManagement && (
        <div className="space-y-4">
          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchEmployee}
                onChange={(e) => setSearchEmployee(e.target.value)}
                placeholder="Search employee by name, ID, or email..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            {departments.length > 0 && (
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full sm:w-56 px-3 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="">All Departments</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Matrix Table */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[750px]">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Department</th>
                    {leaveTypes.map(lt => (
                      <th key={lt.id} className="p-3 text-center">
                        <div>{lt.name}</div>
                        <div className="text-[9px] text-slate-500 font-mono font-normal">Max: {lt.days_allowed}d</div>
                      </th>
                    ))}
                    <th className="p-3 text-right">Total Available</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={3 + leaveTypes.length} className="p-0">
                        <EmptyState title="No employees found" description="Try adjusting your search criteria." icon={Users} />
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map(emp => (
                      <tr key={emp.employee_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {emp.avatar ? (
                              <img src={emp.avatar} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-700 shrink-0" onError={(e) => e.target.style.display='none'} />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-brand-400 font-bold text-xs shrink-0">
                                {emp.full_name?.[0] || '?'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-white">{emp.full_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{emp.employee_code} • {emp.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                            {emp.department_name}
                          </span>
                        </td>
                        {emp.balances.map(b => (
                          <td key={b.leave_type_id} className="p-3 text-center font-mono">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800">
                              <span className="text-emerald-400 font-bold" title="Remaining Days">{b.remaining_days} rem</span>
                              <span className="text-slate-600">/</span>
                              <span className="text-purple-400 text-[10px]" title="Used Days">{b.used_days} used</span>
                              {b.pending_days > 0 && (
                                <span className="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30" title="Pending Approval">
                                  +{b.pending_days}p
                                </span>
                              )}
                            </div>
                          </td>
                        ))}
                        <td className="p-3 text-right">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 rounded-xl font-bold font-mono text-xs">
                            {emp.total_remaining} Days
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openAdjustModal(emp)}
                            className="px-2.5 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-bold rounded-lg border border-brand-500/30 transition-all"
                            title="Adjust Quota"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: LEAVE REQUESTS & APPROVAL QUEUE ───────────────── */}
      {activeTab === 'requests' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Start Date</th>
                  <th className="p-3">End Date</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaves.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-0">
                      <EmptyState title="No leaves found" description="No leave requests available." icon={FileText} />
                    </td>
                  </tr>
                ) : (
                  leaves.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-900/40">
                      <td className="p-3 font-semibold text-white">
                        <div>{l.employee_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{l.employee_id_code}</div>
                      </td>
                      <td className="p-3 text-slate-300 font-medium">{l.leave_type_name}</td>
                      <td className="p-3 text-slate-300 font-mono">{l.start_date}</td>
                      <td className="p-3 text-slate-300 font-mono">{l.end_date}</td>
                      <td className="p-3 font-bold text-amber-400 font-mono">{l.number_of_days} d</td>
                      <td className="p-3 text-slate-400 max-w-xs truncate" title={l.reason}>{l.reason}</td>
                      <td className="p-3"><StatusBadge status={l.status} /></td>
                      <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                        {isManagement ? (
                          <>
                            <button
                              onClick={() => openEditModal(l)}
                              className="px-2.5 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 font-bold rounded-lg border border-brand-500/30 text-[11px] transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                              <Edit className="w-3 h-3" /> Edit
                            </button>
                            {l.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={() => handleApprove(l.id)}
                                  disabled={actionLoadingId === l.id}
                                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <CheckCircle className="w-3 h-3" /> {actionLoadingId === l.id ? '...' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => openRejectModal(l.id)}
                                  disabled={actionLoadingId === l.id}
                                  className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> {actionLoadingId === l.id ? '...' : 'Reject'}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          // Employee View
                          l.status === 'PENDING' ? (
                            <button
                              onClick={() => handleDeleteLeave(l.id)}
                              disabled={actionLoadingId === l.id}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              <XCircle className="w-3 h-3" /> {actionLoadingId === l.id ? '...' : 'Cancel Request'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-500 italic">No actions available</span>
                          )
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── TAB 3: INTERACTIVE MULTI-EMPLOYEE LEAVE CALENDAR ─────── */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          {/* Calendar Filter Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 glass-panel rounded-2xl border border-slate-800">
            {/* Month Navigation */}
            <div className="flex items-center bg-slate-900 rounded-xl p-1 border border-slate-800">
              <button 
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-4 font-bold text-white text-xs min-w-[130px] text-center">
                {format(currentDate, 'MMMM yyyy')}
              </span>
              <button 
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-300 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center gap-2.5">
              {isManagement && summaryData?.employees && (
                <select
                  value={calFilterEmp}
                  onChange={(e) => setCalFilterEmp(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">All Employees</option>
                  {summaryData.employees.map(e => (
                    <option key={e.employee_id} value={e.employee_id}>{e.full_name}</option>
                  ))}
                </select>
              )}

              <select
                value={calFilterStatus}
                onChange={(e) => setCalFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="ALL">All Leaves & Holidays</option>
                <option value="APPROVED">Approved Leaves Only</option>
                <option value="PENDING">Planned / Pending Only</option>
              </select>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
            {calLoading && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
              </div>
            )}

            {/* Day Headers */}
            <div className="grid grid-cols-7 bg-slate-900/80 border-b border-slate-800 text-center py-2.5 text-[11px] font-bold text-slate-400">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Month Cells */}
            {(() => {
              const monthStart = startOfMonth(currentDate);
              const monthEnd = endOfMonth(monthStart);
              const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
              const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

              const rows = [];
              let days = [];
              let day = startDate;

              while (day <= endDate) {
                for (let i = 0; i < 7; i++) {
                  const cloneDay = day;
                  const dayEvents = calendarEvents.filter(e => isSameDay(e.dateObj, cloneDay));
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());

                  days.push(
                    <div
                      key={day.toISOString()}
                      onClick={() => {
                        if (dayEvents.length > 0) setSelectedDayEvents({ date: cloneDay, events: dayEvents });
                      }}
                      className={`min-h-[90px] p-2 border-b border-r border-slate-800/80 transition-all ${
                        !isCurrentMonth ? 'bg-slate-950/40 text-slate-600' : 'bg-transparent text-slate-200 hover:bg-slate-900/50'
                      } ${dayEvents.length > 0 ? 'cursor-pointer hover:border-brand-500/40' : ''}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${
                          isToday ? 'bg-brand-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-md' : 'text-slate-300'
                        }`}>
                          {format(day, 'd')}
                        </span>
                        {dayEvents.length > 0 && (
                          <span className="text-[9px] font-bold text-slate-500 font-mono">
                            {dayEvents.length} {dayEvents.length === 1 ? 'event' : 'events'}
                          </span>
                        )}
                      </div>

                      {/* Event Badges */}
                      <div className="space-y-1 mt-1.5">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className="px-1.5 py-0.5 text-[10px] rounded font-medium truncate flex items-center gap-1 shadow-sm border"
                            style={{
                              backgroundColor: `${ev.color}15`,
                              borderColor: `${ev.color}40`,
                              color: ev.color
                            }}
                            title={ev.title}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-brand-400 font-bold pl-1">
                            +{dayEvents.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                  day = addDays(day, 1);
                }
                rows.push(<div className="grid grid-cols-7" key={day.toISOString()}>{days}</div>);
                days = [];
              }
              return <div className="border-l border-slate-800">{rows}</div>;
            })()}
          </div>

          {/* Color Legend */}
          <div className="flex flex-wrap gap-4 p-4 glass-panel rounded-2xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm"></div>
              <span className="text-slate-300 font-medium">Approved Leave (Used)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm"></div>
              <span className="text-slate-300 font-medium">Planned Leave (Pending Approval)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 shadow-sm"></div>
              <span className="text-slate-300 font-medium">General Holiday (All Staff Off)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 shadow-sm"></div>
              <span className="text-slate-300 font-medium">Optional Festival Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm"></div>
              <span className="text-slate-300 font-medium">Approved WFH</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Day Details Modal (Click to View Scheduled Leaves) ───── */}
      <Modal
        isOpen={!!selectedDayEvents}
        onClose={() => setSelectedDayEvents(null)}
        title={selectedDayEvents ? `Events Scheduled on ${format(selectedDayEvents.date, 'MMMM do, yyyy')}` : ''}
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {selectedDayEvents?.events.map((ev) => (
            <div
              key={ev.id}
              className="p-4 rounded-xl border glass-panel space-y-2"
              style={{ borderColor: `${ev.color}40`, backgroundColor: `${ev.color}08` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ev.color }} />
                  <span className="font-bold text-white text-xs">{ev.title}</span>
                </div>
                {ev.leave_status && (
                  <StatusBadge status={ev.leave_status} />
                )}
              </div>

              {ev.employee_name && (
                <div className="text-xs text-slate-300">
                  Employee: <strong className="text-white">{ev.employee_name}</strong> {ev.department_name && `(${ev.department_name})`}
                </div>
              )}

              {ev.reason && (
                <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                  <strong>Reason:</strong> {ev.reason}
                </div>
              )}

              {ev.start_date && ev.end_date && (
                <div className="text-[10px] text-slate-500 font-mono">
                  Full Duration: {ev.start_date} to {ev.end_date} ({ev.number_of_days} days)
                </div>
              )}

              {isManagement && ev.leave_status === 'PENDING' && ev.leave_id && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    onClick={() => {
                      handleApprove(ev.leave_id);
                      setSelectedDayEvents(null);
                    }}
                    className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold rounded-lg border border-emerald-500/40 text-xs transition-all"
                  >
                    Quick Approve
                  </button>
                  <button
                    onClick={() => {
                      openRejectModal(ev.leave_id);
                      setSelectedDayEvents(null);
                    }}
                    className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-bold rounded-lg border border-rose-500/40 text-xs transition-all"
                  >
                    Quick Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* ─── Adjust Quota Modal ────────────────────────────────────── */}
      <Modal
        isOpen={adjustModal.isOpen}
        onClose={() => setAdjustModal(prev => ({ ...prev, isOpen: false }))}
        title={adjustModal.employee ? `Adjust Quota for ${adjustModal.employee.full_name}` : 'Adjust Quota'}
      >
        {adjustModal.error && <FormError message={adjustModal.error} />}
        <form onSubmit={submitAdjustQuota} className="space-y-4">
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {adjustModal.adjustments.map((adj, idx) => (
              <div key={adj.leave_type_id} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                <h4 className="text-sm font-bold text-slate-300">{adj.name}</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Allocated (Total Allowed)</label>
                    <input
                      type="number" step="0.5" min="0" required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:border-brand-500 focus:outline-none"
                      value={adj.allocated_days}
                      onChange={e => handleAdjustChange(idx, 'allocated_days', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remaining Days</label>
                    <input
                      type="number" step="0.5" min="0" required
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-emerald-400 font-bold font-mono text-xs focus:border-emerald-500 focus:outline-none"
                      value={adj.remaining_days}
                      onChange={e => handleAdjustChange(idx, 'remaining_days', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setAdjustModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 text-slate-400 font-bold text-xs hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjustModal.loading}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl transition-colors disabled:opacity-50"
            >
              {adjustModal.loading ? 'Saving...' : 'Save Adjustments'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Rejection Reason Modal ───────────────────────────────── */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, id: null, reason: '', error: '' })}
        title="Reject Leave Request"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div>
            <label htmlFor="leave-reject-reason" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Rejection <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="leave-reject-reason"
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value, error: '' })}
              placeholder="e.g. Schedule clash or operational requirements..."
              className={`w-full bg-slate-900 border ${
                rejectModal.error ? 'border-rose-500' : 'border-slate-700'
              } rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none`}
            />
            <FormError message={rejectModal.error} id="leave-reject-error" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setRejectModal({ isOpen: false, id: null, reason: '', error: '' })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === rejectModal.id}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {actionLoadingId === rejectModal.id ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ─── Management Edit Leave Record Modal ─────────────────── */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal(prev => ({ ...prev, isOpen: false, leave: null, error: '' }))}
        title="Edit Employee Leave Record"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {editModal.error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{editModal.error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Employee</label>
            <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-white font-bold flex items-center justify-between">
              <span>{editModal.leave?.employee_name}</span>
              <span className="text-[10px] text-slate-400 font-mono font-normal">{editModal.leave?.employee_id_code}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Type</label>
            <select
              value={editModal.form.leave_type}
              onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, leave_type: e.target.value } }))}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              {leaveTypes.map(lt => (
                <option key={lt.id} value={lt.id}>{lt.name} (Max {lt.days_allowed} days)</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={editModal.form.start_date}
                onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, start_date: e.target.value } }))}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={editModal.form.end_date}
                onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, end_date: e.target.value } }))}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={editModal.form.is_half_day}
                  onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, is_half_day: e.target.checked } }))}
                  className="rounded border-slate-700 bg-slate-900 text-brand-500"
                />
                Half-Day Leave
              </label>
              {editModal.form.is_half_day && (
                <select
                  value={editModal.form.half_day_period}
                  onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, half_day_period: e.target.value } }))}
                  className="w-full mt-1 p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="FIRST_HALF">First Half (Morning)</option>
                  <option value="SECOND_HALF">Second Half (Afternoon)</option>
                </select>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Work Mode</label>
              <select
                value={editModal.form.work_mode}
                onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, work_mode: e.target.value } }))}
                className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
              >
                <option value="OFFICE">Work From Office (WFO)</option>
                <option value="WFH">Work From Home (WFH)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
            <select
              value={editModal.form.status}
              onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, status: e.target.value } }))}
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="PENDING">PENDING (Awaiting Review)</option>
              <option value="APPROVED">APPROVED (Deduct Quota & Mark Leave)</option>
              <option value="REJECTED">REJECTED (Decline Application)</option>
              <option value="CANCELLED">CANCELLED (Revoke Request)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason / Notes</label>
            <textarea
              rows={3}
              value={editModal.form.reason}
              onChange={(e) => setEditModal(prev => ({ ...prev, form: { ...prev.form, reason: e.target.value } }))}
              placeholder="Leave justification or management notes..."
              className="w-full p-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-all resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false, leave: null, error: '' }))}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editModal.loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-600/20 disabled:opacity-50"
            >
              {editModal.loading ? 'Saving Changes...' : 'Save Leave Record'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeavePage;
