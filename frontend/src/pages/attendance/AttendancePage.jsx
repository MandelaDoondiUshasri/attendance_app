import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck, Search, Filter, Download, CheckCircle2,
  XCircle, Clock, AlertCircle, FileText, Check, X, ShieldAlert,
  ArrowRight, BarChart3, TrendingUp, TrendingDown, Minus,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/common/states/EmptyState';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import NoSearchResults from '../../components/common/states/NoSearchResults';
import FormError from '../../components/common/states/FormError';
import { useAppState } from '../../context/AppStateContext';

import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';

export const AttendancePage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'logs';

  const [activeTab, setActiveTab] = useState(initialTab); // 'logs', 'corrections', 'history'
  const [attendances, setAttendances] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [dateFilter, setDateFilter] = useState(searchParams.get('date') || '');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirmation / Rejection modal state
  const [approveConfirm, setApproveConfirm] = useState({ isOpen: false, id: null, name: '' });
  const [rejectingCorrection, setRejectingCorrection] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Monthly Summary state
  const [monthlySummary, setMonthlySummary] = useState(null);
  const [monthlySummaryLoading, setMonthlySummaryLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [employeeList, setEmployeeList] = useState([]);

  const isManagement = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (dateFilter) params.date = dateFilter;

      const [attRes, corrRes] = await Promise.all([
        api.get('/attendance/', { params }),
        isManagement ? api.get('/attendance/corrections/') : Promise.resolve({ data: [] })
      ]);
      setAttendances(attRes.data.results || attRes.data || []);
      setCorrections(corrRes.data.results || corrRes.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load attendance logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, dateFilter]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
    if (tab === 'monthly' && !monthlySummary) {
      fetchMonthlySummary();
    }
  };

  // Fetch monthly summary
  const fetchMonthlySummary = async (year, month, empId) => {
    setMonthlySummaryLoading(true);
    try {
      const params = {
        year: year || selectedYear,
        month: month || selectedMonth
      };
      if (empId || selectedEmployeeId) {
        params.employee_id = empId || selectedEmployeeId;
      }
      const res = await api.get('/attendance/monthly-summary/', { params });
      setMonthlySummary(res.data);
    } catch (e) {
      console.error('Monthly summary error:', e);
      addToast(e.response?.data?.error || 'Failed to load monthly summary.', 'error');
    } finally {
      setMonthlySummaryLoading(false);
    }
  };

  // Fetch employees list for HR/CEO
  useEffect(() => {
    if (isManagement) {
      api.get('/employees/').then(res => {
        const emps = res.data.results || res.data || [];
        setEmployeeList(emps);
      }).catch(() => {});
    }
  }, []);

  const handleMonthNav = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
    fetchMonthlySummary(newYear, newMonth, selectedEmployeeId);
  };

  const handleOpenApprove = (correctionId, employeeName) => {
    setApproveConfirm({
      isOpen: true,
      id: correctionId,
      name: employeeName
    });
  };

  const handleConfirmApprove = async () => {
    if (!approveConfirm.id) return;
    setActionLoading(true);
    try {
      await api.post(`/attendance/corrections/${approveConfirm.id}/approve/`);
      addToast(`Attendance correction for ${approveConfirm.name} APPROVED successfully.`, 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchData();
    } catch (err) {
      console.error('Approve error:', err);
      addToast(err.response?.data?.error || 'Failed to approve attendance correction.', 'error');
    } finally {
      setActionLoading(false);
      setApproveConfirm({ isOpen: false, id: null, name: '' });
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingCorrection) return;
    setActionLoading(true);
    try {
      await api.post(`/attendance/corrections/${rejectingCorrection.id}/reject/`, {
        rejection_reason: rejectionReason || 'Request rejected by management.'
      });
      addToast(`Attendance correction for ${rejectingCorrection.employee_name} REJECTED.`, 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      setRejectingCorrection(null);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      console.error('Reject error:', err);
      addToast(err.response?.data?.error || 'Failed to reject attendance correction.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCorrections = corrections.filter(c => c.status === 'PENDING');
  const resolvedCorrections = corrections.filter(c => c.status !== 'PENDING');

  const filteredAttendances = attendances.filter(a => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.employee_name?.toLowerCase().includes(q) ||
      a.employee_id_code?.toLowerCase().includes(q) ||
      a.date?.toLowerCase().includes(q)
    );
  });


  if (loading) return <LoadingState type="full" text="Loading attendance data..." />;
  if (error) return <ErrorState message={error} onRetry={fetchData} />;

  return (
    <div className="space-y-6">
      {/* HEADER & TAB NAVIGATION */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CalendarCheck className="w-6 h-6 text-brand-400" />
            Attendance & Correction Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {isManagement
              ? 'Audit daily check-ins and review attendance correction requests.'
              : 'Review your personal check-in records and track submitted correction requests.'}
          </p>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 rounded-2xl border border-slate-800 self-stretch sm:self-auto overflow-x-auto">
          <button
            onClick={() => handleTabChange('logs')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'logs'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" /> Attendance Logs
          </button>

          <button
            onClick={() => handleTabChange('corrections')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'corrections'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Pending Corrections</span>
            {pendingCorrections.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full animate-pulse">
                {pendingCorrections.length}
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabChange('history')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" /> Correction History
          </button>

          <button
            onClick={() => handleTabChange('monthly')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
              activeTab === 'monthly'
                ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 text-emerald-400" /> Monthly Summary
          </button>
        </div>
      </div>

      {/* TAB 1: ATTENDANCE LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* FILTERS */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Employee Name, ID, or Date..."
                className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
              >
                <option value="">All Statuses</option>
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="HALF_DAY">HALF DAY</option>
                <option value="ABSENT">ABSENT</option>
                <option value="LEAVE">LEAVE</option>
                <option value="WFH">WFH</option>
              </select>

              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-xl">
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none font-mono"
                />
                {dateFilter && (
                  <button onClick={() => setDateFilter('')} className="text-[10px] text-slate-500 hover:text-slate-300 font-bold ml-1">
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ATTENDANCE TABLE */}
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Check-In</th>
                    <th className="p-3">Check-Out</th>
                    <th className="p-3">Hours</th>
                    <th className="p-3">Work Mode</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAttendances.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        {searchQuery ? (
                          <NoSearchResults searchTerm={searchQuery} onClear={() => setSearchQuery('')} />
                        ) : (
                          <EmptyState title="No Attendance Records" description="No records found for the applied filters." icon={CalendarCheck} />
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendances.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-semibold text-white font-mono">{a.date}</td>
                        <td className="p-3">
                          <div className="font-semibold text-white">{a.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{a.employee_id_code}</div>
                        </td>
                        <td className="p-3 text-emerald-400 font-mono font-bold">
                          {a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="p-3 text-indigo-400 font-mono font-bold">
                          {a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="p-3 font-mono font-extrabold text-white">{a.working_hours || '0.00'} hrs</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {a.work_mode}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">{a.attendance_method}</td>
                        <td className="p-3"><StatusBadge status={a.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING CORRECTION REQUESTS */}
      {activeTab === 'corrections' && (
        <div className="space-y-4">
          <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Pending Attendance Corrections ({pendingCorrections.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isManagement
                    ? 'Review and approve employee check-in time adjustments with one click.'
                    : 'Your submitted correction requests awaiting CEO/HR authorization.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Target Date</th>
                    <th className="p-3">Original Time</th>
                    <th className="p-3">Requested Correction</th>
                    <th className="p-3">Justification Reason</th>
                    <th className="p-3">Submitted At</th>
                    <th className="p-3">Status</th>
                    {isManagement && <th className="p-3 text-right">Review Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {pendingCorrections.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-0">
                        <EmptyState title="No Pending Corrections" description="All employee correction submissions are up to date." icon={CheckCircle2} />
                      </td>
                    </tr>
                  ) : (
                    pendingCorrections.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-white">{c.employee_name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.employee_id_code}</div>
                        </td>
                        <td className="p-3 font-semibold text-white font-mono">{c.date}</td>
                        <td className="p-3 text-slate-400 font-mono">
                          {c.original_check_in ? new Date(c.original_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No check-in'}
                        </td>
                        <td className="p-3 font-mono">
                          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                            <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                            {c.requested_check_in ? new Date(c.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </div>
                        </td>
                        <td className="p-3 text-slate-300 max-w-xs">
                          <p className="text-xs line-clamp-2" title={c.reason}>{c.reason}</p>
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] font-mono">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            PENDING
                          </span>
                        </td>
                        {isManagement && (
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleOpenApprove(c.id, c.employee_name)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                title="Approve and update attendance record"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingCorrection(c);
                                  setRejectionReason('');
                                }}
                                disabled={actionLoading}
                                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 font-bold text-xs rounded-xl border border-rose-500/30 flex items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
                                title="Reject correction request"
                              >
                                <X className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CORRECTION HISTORY */}
      {activeTab === 'history' && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
          <div className="pb-4 border-b border-slate-800 mb-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              Attendance Correction Audit History ({resolvedCorrections.length})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Archive of all approved and rejected attendance corrections</p>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[850px]">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Requested Time</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Reviewed By</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Notes / Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {resolvedCorrections.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-0">
                      <EmptyState title="No History Found" description="No historical correction records found." icon={FileText} />
                    </td>
                  </tr>
                ) : (
                  resolvedCorrections.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-white">{c.employee_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{c.employee_id_code}</div>
                      </td>
                      <td className="p-3 font-semibold text-white font-mono">{c.date}</td>
                      <td className="p-3 text-emerald-400 font-mono font-bold">
                        {c.requested_check_in ? new Date(c.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="p-3 text-slate-300 max-w-xs">{c.reason}</td>
                      <td className="p-3 text-slate-400 font-mono text-[11px]">{c.reviewed_by_name || 'Management'}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'APPROVED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-400 text-xs italic">
                        {c.rejection_reason || (c.status === 'APPROVED' ? 'Approved & Attendance Synchronized' : 'N/A')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REJECTION REASON MODAL */}
      <Modal
        isOpen={Boolean(rejectingCorrection)}
        onClose={() => setRejectingCorrection(null)}
        title="Reject Attendance Correction Request"
      >
        {rejectingCorrection && (
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300">
              <p className="font-bold">Rejecting request for {rejectingCorrection.employee_name} ({rejectingCorrection.date})</p>
              <p className="text-slate-300 mt-1">Requested check-in: <span className="font-mono text-white">{new Date(rejectingCorrection.requested_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rejection Justification <span className="text-rose-400">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain the reason for rejection (e.g. Unverified punch, timing discrepancy)..."
                required
                rows={3}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRejectingCorrection(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* APPROVE CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={approveConfirm.isOpen}
        onClose={() => setApproveConfirm({ isOpen: false, id: null, name: '' })}
        onConfirm={handleConfirmApprove}
        title="Approve Attendance Correction"
        message={`Approve attendance correction request for ${approveConfirm.name}? This will automatically synchronize the attendance punch record and working hours.`}
        confirmText="Approve Correction"
        variant="brand"
      />

      {/* TAB 4: MONTHLY SUMMARY */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          {/* Month/Year Selector & Employee Picker */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleMonthNav(-1)}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm font-bold text-white min-w-[160px] text-center">
                <CalendarIcon className="w-3.5 h-3.5 inline-block mr-1.5 text-brand-400" />
                {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
              </div>
              <button
                onClick={() => handleMonthNav(1)}
                className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isManagement && (
              <select
                value={selectedEmployeeId}
                onChange={(e) => {
                  setSelectedEmployeeId(e.target.value);
                  fetchMonthlySummary(selectedYear, selectedMonth, e.target.value);
                }}
                className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none min-w-[220px]"
              >
                <option value="">My Summary</option>
                {employeeList.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_id})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={() => fetchMonthlySummary()}
              className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Load Summary
            </button>
          </div>

          {monthlySummaryLoading && (
            <div className="text-center py-12 text-slate-400">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Calculating monthly working hours...
            </div>
          )}

          {!monthlySummaryLoading && monthlySummary && (
            <div className="space-y-6">
              {/* Employee Info */}
              <div className="flex items-center gap-3 text-sm">
                <span className="font-bold text-white">{monthlySummary.employee_name}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400 font-mono">{monthlySummary.employee_code}</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">{monthlySummary.department}</span>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Calendar Days</p>
                  <p className="text-xl font-black text-white font-mono">{monthlySummary.total_calendar_days}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Working Days</p>
                  <p className="text-xl font-black text-brand-400 font-mono">{monthlySummary.total_scheduled_working_days}</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Expected Hours</p>
                  <p className="text-xl font-black text-white font-mono">{monthlySummary.expected_working_hours}h</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Actual Hours</p>
                  <p className="text-xl font-black text-emerald-400 font-mono">{monthlySummary.actual_working_hours}h</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    {monthlySummary.extra_hours >= 0 ? 'Extra Hours' : 'Short Hours'}
                  </p>
                  <p className={`text-xl font-black font-mono flex items-center gap-1 ${monthlySummary.extra_hours > 0 ? 'text-emerald-400' : monthlySummary.extra_hours < 0 ? 'text-rose-400' : 'text-slate-300'}`}>
                    {monthlySummary.extra_hours > 0 ? <TrendingUp className="w-4 h-4" /> : monthlySummary.extra_hours < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                    {monthlySummary.extra_hours > 0 ? '+' : ''}{monthlySummary.extra_hours}h
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Leave Days</p>
                  <p className="text-xl font-black text-amber-400 font-mono">{monthlySummary.total_leave_days}</p>
                </div>
              </div>

              {/* Breakdown Chips */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <span className="text-slate-400">Sundays: <span className="text-white font-bold">{monthlySummary.total_sundays}</span></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-slate-400">Weekend Holidays: <span className="text-white font-bold">{monthlySummary.total_weekend_holidays}</span></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-orange-400" />
                  <span className="text-slate-400">Company Holidays: <span className="text-white font-bold">{monthlySummary.total_company_holidays}</span></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  <span className="text-slate-400">Full-Day Leaves: <span className="text-white font-bold">{monthlySummary.total_full_day_leaves}</span></span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <span className="text-slate-400">Half-Day Leaves: <span className="text-white font-bold">{monthlySummary.total_half_day_leaves}</span></span>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-brand-400" />
                    Daily Breakdown — {monthlySummary.month_name} {monthlySummary.year}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-400">Date</th>
                        <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-slate-400">Day</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Type</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Expected</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Actual</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Extra/Short</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Check-In</th>
                        <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-slate-400">Check-Out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySummary.daily_breakdown?.map((day, idx) => {
                        const isToday = day.date === new Date().toISOString().split('T')[0];
                        const dayTypeColors = {
                          WORKING: 'text-white',
                          SUNDAY: 'text-rose-400',
                          WEEKEND_HOLIDAY: 'text-amber-400',
                          COMPANY_HOLIDAY: 'text-orange-400',
                          FULL_DAY_LEAVE: 'text-sky-400',
                          HALF_DAY_LEAVE: 'text-violet-400',
                        };
                        const dayTypeBadges = {
                          WORKING: 'bg-slate-800 text-slate-300',
                          SUNDAY: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                          WEEKEND_HOLIDAY: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                          COMPANY_HOLIDAY: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                          FULL_DAY_LEAVE: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
                          HALF_DAY_LEAVE: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
                        };
                        const dayTypeLabels = {
                          WORKING: 'Working',
                          SUNDAY: 'Sunday',
                          WEEKEND_HOLIDAY: '2nd Sat',
                          COMPANY_HOLIDAY: 'Holiday',
                          FULL_DAY_LEAVE: 'Leave',
                          HALF_DAY_LEAVE: 'Half Leave',
                        };

                        return (
                          <tr key={day.date} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${isToday ? 'bg-brand-500/5 border-l-2 border-l-brand-400' : ''}`}>
                            <td className={`px-4 py-2.5 font-mono font-bold ${dayTypeColors[day.day_type] || 'text-white'}`}>
                              {day.date}
                              {isToday && <span className="ml-1.5 text-[9px] font-bold text-brand-400">← TODAY</span>}
                            </td>
                            <td className="px-4 py-2.5 text-slate-400 font-semibold">{day.day_name}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase border ${dayTypeBadges[day.day_type] || 'bg-slate-800 text-slate-400'}`}>
                                {dayTypeLabels[day.day_type] || day.day_type}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-300">{day.expected_hours}h</td>
                            <td className={`px-4 py-2.5 text-center font-mono font-bold ${day.actual_hours > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                              {day.actual_hours > 0 ? `${day.actual_hours}h` : '—'}
                            </td>
                            <td className={`px-4 py-2.5 text-center font-mono font-bold ${day.daily_extra > 0 ? 'text-emerald-400' : day.daily_extra < 0 ? 'text-rose-400' : 'text-slate-600'}`}>
                              {day.expected_hours === 0 && day.actual_hours === 0 ? '—' : `${day.daily_extra > 0 ? '+' : ''}${day.daily_extra}h`}
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-400">
                              {day.check_in ? new Date(day.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center font-mono text-slate-400">
                              {day.check_out ? new Date(day.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!monthlySummaryLoading && !monthlySummary && (
            <div className="text-center py-16">
              <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">Select a month and click "Load Summary"</p>
              <p className="text-xs text-slate-500 mt-1">Monthly working hours will be calculated dynamically</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
