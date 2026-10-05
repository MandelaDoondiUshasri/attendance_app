import React, { useState, useEffect, useMemo } from 'react';
import {
  LogOut, Clock, Calendar, CheckCircle2, XCircle, AlertCircle,
  Search, Filter, ShieldCheck, User, Building, FileText, ArrowRight,
  Eye, RefreshCw, Plus, Paperclip, Check, X, Sliders, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import LoadingState from '../../components/common/states/LoadingState';
import EmptyState from '../../components/common/states/EmptyState';
import FormError from '../../components/common/states/FormError';

export const EarlyPassManagementPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();

  const isManagement = ['CEO', 'SYSTEM_ADMIN'].includes(user?.role) || user?.role === 'HR';
  const isSuperAdmin = ['CEO', 'SYSTEM_ADMIN'].includes(user?.role);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL'); // ALL, PENDING, APPROVED, REJECTED, CANCELLED
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  // Approval Modal
  const [approveModal, setApproveModal] = useState({ isOpen: false, request: null, remarks: '', submitting: false });

  // Rejection Modal
  const [rejectModal, setRejectModal] = useState({ isOpen: false, request: null, remarks: '', submitting: false });

  // Cancel Modal (Employee)
  const [cancelModal, setCancelModal] = useState({ isOpen: false, request: null, submitting: false });

  // New Request Modal (Employee / Self)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    request_date: new Date().toISOString().split('T')[0],
    check_in_time: '09:00',
    requested_exit_time: '15:30',
    reason: '',
    remarks: '',
    attachment: null
  });
  const [createErrors, setCreateErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Policy Settings Modal (CEO / Admin)
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyData, setPolicyData] = useState({
    early_pass_max_per_month: 3,
    early_pass_min_worked_hours: 4.0,
    early_pass_allow_same_day: true,
    early_pass_require_advance: false,
    early_pass_allow_cancellation: true,
    early_pass_attachment_mandatory: false,
    early_pass_approval_role: 'HR_OR_CEO'
  });
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policySaving, setPolicySaving] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const endpoint = isManagement ? '/attendance/early-pass/' : '/attendance/early-pass/my_requests/';
      const res = await api.get(endpoint);
      const data = res.data.results || (Array.isArray(res.data) ? res.data : []);
      setRequests(data);
    } catch (err) {
      console.error('Failed to load EarlyPass requests:', err);
      addToast('Failed to load EarlyPass requests.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchPolicy = async () => {
    try {
      setPolicyLoading(true);
      const res = await api.get('/attendance/early-pass/policy/');
      if (res.data?.policy) {
        setPolicyData(res.data.policy);
      }
    } catch (err) {
      console.error('Failed to load EarlyPass policy:', err);
    } finally {
      setPolicyLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    if (isManagement) {
      fetchPolicy();
    }
  }, [user?.role]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchesTab = activeTab === 'ALL' || r.status === activeTab;
      const matchesDate = !dateFilter || r.request_date === dateFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        r.pass_reference?.toLowerCase().includes(q) ||
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee_id_code?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q) ||
        r.reason?.toLowerCase().includes(q);

      return matchesTab && matchesDate && matchesQuery;
    });
  }, [requests, activeTab, dateFilter, searchQuery]);

  // Metric counts
  const metrics = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED').length;
    const rejected = requests.filter((r) => r.status === 'REJECTED').length;
    const cancelled = requests.filter((r) => r.status === 'CANCELLED').length;
    return { total, pending, approved, rejected, cancelled };
  }, [requests]);

  // Open Details Modal
  const handleOpenDetails = async (req) => {
    setSelectedRequest(req);
    setDetailsModalOpen(true);
    // Refresh detailed request to get latest audit logs
    try {
      const res = await api.get(`/attendance/early-pass/${req.id}/`);
      setSelectedRequest(res.data);
    } catch (e) {
      console.error('Failed to fetch full request details:', e);
    }
  };

  // Approve action
  const handleApprove = async () => {
    if (!approveModal.request) return;
    try {
      setApproveModal((prev) => ({ ...prev, submitting: true }));
      await api.post(`/attendance/early-pass/${approveModal.request.id}/approve/`, {
        approval_remarks: approveModal.remarks
      });
      addToast(`EarlyPass ${approveModal.request.pass_reference} approved successfully. ₹0 deduction applied.`, 'success');
      setApproveModal({ isOpen: false, request: null, remarks: '', submitting: false });
      if (detailsModalOpen && selectedRequest?.id === approveModal.request.id) {
        setDetailsModalOpen(false);
      }
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchRequests();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to approve EarlyPass request.', 'error');
      setApproveModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Reject action
  const handleReject = async () => {
    if (!rejectModal.request) return;
    try {
      setRejectModal((prev) => ({ ...prev, submitting: true }));
      await api.post(`/attendance/early-pass/${rejectModal.request.id}/reject/`, {
        approval_remarks: rejectModal.remarks
      });
      addToast(`EarlyPass ${rejectModal.request.pass_reference} rejected. Normal attendance rules will apply.`, 'info');
      setRejectModal({ isOpen: false, request: null, remarks: '', submitting: false });
      if (detailsModalOpen && selectedRequest?.id === rejectModal.request.id) {
        setDetailsModalOpen(false);
      }
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchRequests();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to reject EarlyPass request.', 'error');
      setRejectModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Cancel action (Employee)
  const handleCancel = async () => {
    if (!cancelModal.request) return;
    try {
      setCancelModal((prev) => ({ ...prev, submitting: true }));
      await api.post(`/attendance/early-pass/${cancelModal.request.id}/cancel/`);
      addToast('EarlyPass request cancelled.', 'success');
      setCancelModal({ isOpen: false, request: null, submitting: false });
      if (detailsModalOpen && selectedRequest?.id === cancelModal.request.id) {
        setDetailsModalOpen(false);
      }
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchRequests();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to cancel EarlyPass request.', 'error');
      setCancelModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // Create Request Submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});
    try {
      setCreateSubmitting(true);
      const formData = new FormData();
      formData.append('request_date', createForm.request_date);
      formData.append('check_in_time', createForm.check_in_time);
      formData.append('requested_exit_time', createForm.requested_exit_time);
      formData.append('reason', createForm.reason);
      if (createForm.remarks) formData.append('remarks', createForm.remarks);
      if (createForm.attachment) formData.append('attachment', createForm.attachment);

      await api.post('/attendance/early-pass/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      addToast('EarlyPass request submitted successfully. Awaiting CEO/HR approval.', 'success');
      setCreateModalOpen(false);
      setCreateForm({
        request_date: new Date().toISOString().split('T')[0],
        check_in_time: '09:00',
        requested_exit_time: '15:30',
        reason: '',
        remarks: '',
        attachment: null
      });
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchRequests();
    } catch (err) {
      const respData = err.response?.data;
      if (respData && typeof respData === 'object') {
        setCreateErrors(respData);
      }
      addToast(respData?.error || 'Failed to submit EarlyPass request.', 'error');
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Save Policy Settings
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      setPolicySaving(true);
      await api.patch('/core/settings/', policyData);
      addToast('EarlyPass company policy updated successfully.', 'success');
      setPolicyModalOpen(false);
      fetchPolicy();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save policy settings.', 'error');
    } finally {
      setPolicySaving(false);
    }
  };

  // Helper: Live calculation of expected working & missing hours in creation modal
  const creationDurationPreview = useMemo(() => {
    if (!createForm.check_in_time || !createForm.requested_exit_time) return null;
    const [inH, inM] = createForm.check_in_time.split(':').map(Number);
    const [outH, outM] = createForm.requested_exit_time.split(':').map(Number);
    if (isNaN(inH) || isNaN(outH)) return null;

    let inMin = inH * 60 + (inM || 0);
    let outMin = outH * 60 + (outM || 0);
    if (outMin <= inMin) {
      return { invalid: true, msg: 'Requested exit time must be after check-in time.' };
    }

    const diffMin = outMin - inMin;
    const diffHours = Math.round((diffMin / 60) * 100) / 100;
    const reqHours = 8.0;
    const missingHours = Math.max(0, Math.round((reqHours - diffHours) * 100) / 100);

    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;

    const misH = Math.floor(missingHours);
    const misM = Math.round((missingHours - misH) * 60);

    return {
      invalid: false,
      workingHoursStr: `${h}h ${m > 0 ? `${m}m` : ''}`,
      missingHoursStr: `${misH}h ${misM > 0 ? `${misM}m` : ''}`,
      diffHours,
      missingHours
    };
  }, [createForm.check_in_time, createForm.requested_exit_time]);

  if (loading && requests.length === 0) {
    return <LoadingState message="Loading EarlyPass portal..." />;
  }

  return (
    <div className="space-y-8 animate-fadeIn max-w-7xl mx-auto pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-amber-950/20 to-slate-900/95 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {isManagement ? 'CEO / HR Governance' : 'Employee Portal'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-400">
              {isManagement ? 'Approved Attendance Exception • ₹0 Salary Deduction' : 'Official Early Exit Requests'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            EarlyPass – Early Exit Requests
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl font-normal leading-relaxed">
            {isManagement
              ? 'Authorize early departure exceptions before 8 hours. Approved requests waive short-working-hours salary deduction while preserving accurate attendance timestamps.'
              : 'Submit an early departure request for authorized early exit from your workday upon CEO/HR approval.'}
          </p>
        </div>

        {/* TOP ACTIONS */}
        <div className="flex flex-wrap items-center gap-3 z-10 shrink-0">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-[0_4px_16px_-2px_rgba(245,158,11,0.5)] flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 border border-amber-400/30 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-200" />
            <span>Request EarlyPass</span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setPolicyModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800/90 hover:bg-slate-800 text-slate-200 hover:text-white font-bold text-xs rounded-xl border border-white/10 hover:border-amber-500/40 shadow-sm flex items-center gap-2 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Policy Rules</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-800/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-white/10 transition-all cursor-pointer"
            title="Refresh requests"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* METRIC CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('PENDING')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            activeTab === 'PENDING'
              ? 'bg-amber-500/15 border-amber-500/40 shadow-lg'
              : 'bg-slate-900/80 border-white/10 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5 animate-pulse" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Awaiting Review
            </span>
          </div>
          <h2 className="text-2xl font-black text-amber-300 font-mono mt-3">{metrics.pending}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Pending Approvals</p>
        </div>

        <div
          onClick={() => setActiveTab('APPROVED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            activeTab === 'APPROVED'
              ? 'bg-emerald-500/15 border-emerald-500/40 shadow-lg'
              : 'bg-slate-900/80 border-white/10 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              ₹0 Deduction
            </span>
          </div>
          <h2 className="text-2xl font-black text-emerald-400 font-mono mt-3">{metrics.approved}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Approved Exceptions</p>
        </div>

        <div
          onClick={() => setActiveTab('REJECTED')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            activeTab === 'REJECTED'
              ? 'bg-rose-500/15 border-rose-500/40 shadow-lg'
              : 'bg-slate-900/80 border-white/10 hover:border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20">
              Standard Rules
            </span>
          </div>
          <h2 className="text-2xl font-black text-rose-400 font-mono mt-3">{metrics.rejected}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Rejected Requests</p>
        </div>

        <div
          onClick={() => setActiveTab('ALL')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer backdrop-blur-md ${
            activeTab === 'ALL'
              ? 'bg-indigo-500/15 border-indigo-500/40 shadow-lg'
              : 'bg-slate-900/80 border-white/10 hover:border-indigo-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="w-5 h-5" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              All Requests
            </span>
          </div>
          <h2 className="text-2xl font-black text-white font-mono mt-3">{metrics.total}</h2>
          <p className="text-xs text-slate-400 mt-0.5">Total Records</p>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* TAB BUTTONS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Requests' },
            { id: 'PENDING', label: `Pending (${metrics.pending})` },
            { id: 'APPROVED', label: `Approved (${metrics.approved})` },
            { id: 'REJECTED', label: `Rejected (${metrics.rejected})` },
            { id: 'CANCELLED', label: `Cancelled (${metrics.cancelled})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* SEARCH & DATE FILTERS */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reference, employee, reason..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-xl">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-mono"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-[10px] text-slate-400 hover:text-white font-bold ml-1"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* REQUESTS TABLE */}
      <div className="glass-panel p-4 sm:p-6 rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead className="bg-slate-950/70 text-slate-400 font-bold uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="p-3.5">Ref & Date</th>
                {isManagement && <th className="p-3.5">Employee</th>}
                <th className="p-3.5">Check-In</th>
                <th className="p-3.5">Req. Exit</th>
                <th className="p-3.5">Working Hours</th>
                {isManagement && <th className="p-3.5">Missing Hours</th>}
                <th className="p-3.5">Reason</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={isManagement ? 9 : 7} className="p-12 text-center">
                    <EmptyState
                      title="No EarlyPass Requests Found"
                      message="There are no early exit requests matching your active filter criteria."
                    />
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isSelf = req.employee_user_id === user?.id;
                  const canApprove = isManagement && !isSelf && req.status === 'PENDING';
                  const canCancel = (isSelf || !isManagement) && req.status === 'PENDING' && req.can_be_cancelled !== false;

                  return (
                    <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-3.5">
                        <div className="font-mono font-bold text-amber-400">{req.pass_reference}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{req.request_date}</span>
                        </div>
                      </td>

                      {isManagement && (
                        <td className="p-3.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{req.employee_name}</span>
                            {isSelf && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {req.employee_id_code} • {req.department || 'General'}
                          </div>
                        </td>
                      )}

                      <td className="p-3.5 font-mono text-emerald-400 font-bold">
                        {req.check_in_time ? req.check_in_time.substring(0, 5) : '--:--'}
                      </td>

                      <td className="p-3.5 font-mono text-amber-300 font-bold">
                        {req.requested_exit_time ? req.requested_exit_time.substring(0, 5) : '--:--'}
                      </td>

                      <td className="p-3.5">
                        <span className="font-mono font-bold text-white">
                          {req.actual_working_hours > 0 ? `${req.actual_working_hours}h` : '--'}
                        </span>
                        {isManagement && <span className="text-[10px] text-slate-500 block">req: {req.required_hours || 8.0}h</span>}
                      </td>

                      {isManagement && (
                        <td className="p-3.5 font-mono text-rose-300 font-bold">
                          {req.missing_hours > 0 ? `${req.missing_hours}h` : '0h'}
                        </td>
                      )}

                      <td className="p-3.5 max-w-[200px]">
                        <p className="truncate text-slate-200" title={req.reason}>
                          {req.reason}
                        </p>
                        {req.attachment && (
                          <a
                            href={req.attachment}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 mt-0.5"
                          >
                            <Paperclip className="w-2.5 h-2.5" /> Attachment
                          </a>
                        )}
                      </td>

                      <td className="p-3.5">
                        <StatusBadge status={req.status} />
                        {isManagement && req.status === 'APPROVED' && (
                          <span className="text-[10px] text-emerald-400 block font-mono mt-0.5">₹0 Deduction</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetails(req)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="View Details & Audit Trail"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Details</span>
                          </button>

                          {canApprove && (
                            <>
                              <button
                                onClick={() => setApproveModal({ isOpen: true, request: req, remarks: '', submitting: false })}
                                className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg border border-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Approve EarlyPass (No Deduction)"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => setRejectModal({ isOpen: true, request: req, remarks: '', submitting: false })}
                                className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg border border-rose-500/30 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Reject EarlyPass"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}

                          {canCancel && (
                            <button
                              onClick={() => setCancelModal({ isOpen: true, request: req, submitting: false })}
                              className="px-2.5 py-1 bg-slate-800/80 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-lg border border-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                              title="Cancel Request"
                            >
                              Cancel
                            </button>
                          )}
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

      {/* VIEW DETAILS & AUDIT TRAIL MODAL (SECTION 8) */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedRequest ? `EarlyPass Details • ${selectedRequest.pass_reference}` : 'Request Details'}
      >
        {selectedRequest && (
          <div className="space-y-5">
            {/* Header Status Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Pass Reference</span>
                <span className="text-lg font-black text-amber-400 font-mono">{selectedRequest.pass_reference}</span>
                <span className="text-xs text-slate-400 block mt-0.5">Date: {selectedRequest.request_date}</span>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedRequest.status} />
                {isManagement && (
                  <span className="text-[11px] text-emerald-400 block font-bold mt-1">
                    {selectedRequest.status === 'APPROVED' ? 'Salary Deduction: ₹0 (Waived)' : 'Standard Rules'}
                  </span>
                )}
              </div>
            </div>

            {/* Timings & Working Hours Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Check-In</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {selectedRequest.check_in_time ? selectedRequest.check_in_time.substring(0, 5) : '--:--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Requested Exit</span>
                <span className="text-sm font-black text-amber-400 font-mono">
                  {selectedRequest.requested_exit_time ? selectedRequest.requested_exit_time.substring(0, 5) : '--:--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Actual Exit</span>
                <span className="text-sm font-black text-indigo-400 font-mono">
                  {selectedRequest.actual_exit_time ? selectedRequest.actual_exit_time.substring(0, 5) : '--:--'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  {isManagement ? 'Missing Hours' : 'Working Hours'}
                </span>
                <span className={`text-sm font-black font-mono ${isManagement ? 'text-rose-400' : 'text-white'}`}>
                  {isManagement
                    ? (selectedRequest.missing_hours > 0 ? `${selectedRequest.missing_hours}h` : '0h')
                    : (selectedRequest.actual_working_hours > 0 ? `${selectedRequest.actual_working_hours}h` : '--')}
                </span>
              </div>
            </div>

            {/* Reason & Remarks */}
            <div className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-white/5">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Reason for Leaving Early
                </span>
                <p className="text-xs text-white bg-slate-900 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                  {selectedRequest.reason}
                </p>
              </div>

              {selectedRequest.remarks && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Employee Remarks
                  </span>
                  <p className="text-xs text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                    {selectedRequest.remarks}
                  </p>
                </div>
              )}

              {selectedRequest.approval_remarks && (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                    Management Remarks ({selectedRequest.approved_by_name || selectedRequest.rejected_by_name || 'Authority'})
                  </span>
                  <p className="text-xs text-emerald-200 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/30">
                    {selectedRequest.approval_remarks}
                  </p>
                </div>
              )}

              {selectedRequest.attachment && (
                <div className="pt-2">
                  <a
                    href={selectedRequest.attachment}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold transition-all"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>View Submitted Attachment</span>
                  </a>
                </div>
              )}
            </div>

            {/* AUDIT TRAIL LOG (SECTION 8) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>Section 8 • CEO/HR Audit Trail</span>
              </span>

              <div className="bg-slate-950/80 rounded-xl border border-slate-800 p-3 max-h-48 overflow-y-auto divide-y divide-slate-800/60">
                {selectedRequest.audit_logs && selectedRequest.audit_logs.length > 0 ? (
                  selectedRequest.audit_logs.map((log) => (
                    <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-200">
                          {log.actor_name} ({log.actor_role})
                        </span>
                        <span className="text-slate-500 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {log.previous_status || 'INIT'} → {log.new_status}
                        </span>
                        {log.remarks && (
                          <span className="text-slate-300 italic truncate" title={log.remarks}>
                            "{log.remarks}"
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-slate-500 py-3 text-center">
                    Audit log entries will appear here as actions are recorded.
                  </p>
                )}
              </div>
            </div>

            {/* Bottom Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* APPROVE MODAL */}
      <Modal
        isOpen={approveModal.isOpen}
        onClose={() => setApproveModal({ isOpen: false, request: null, remarks: '', submitting: false })}
        title={`Approve EarlyPass • ${approveModal.request?.pass_reference}`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-200 space-y-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <strong className="text-emerald-300">Approval Outcome: ₹0 Salary Deduction</strong>
            </div>
            <p className="text-[11px] text-emerald-300/90 leading-relaxed">
              Approving this EarlyPass will mark <strong>{approveModal.request?.employee_name}</strong>'s attendance as{' '}
              <strong className="text-white">Present – Approved Early Exit</strong>. Missing hours will NOT result in
              unpaid absence deductions.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Approval Remarks / Notes (Optional)
            </label>
            <textarea
              value={approveModal.remarks}
              onChange={(e) => setApproveModal((prev) => ({ ...prev, remarks: e.target.value }))}
              placeholder="e.g. Approved due to verified medical appointment."
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setApproveModal({ isOpen: false, request: null, remarks: '', submitting: false })}
              disabled={approveModal.submitting}
              className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApprove}
              disabled={approveModal.submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{approveModal.submitting ? 'Approving...' : 'Confirm Approval (₹0 Cut)'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* REJECT MODAL */}
      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, request: null, remarks: '', submitting: false })}
        title={`Reject EarlyPass • ${rejectModal.request?.pass_reference}`}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-200 space-y-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <strong className="text-rose-300">Standard Attendance & Payroll Rules Will Apply</strong>
            </div>
            <p className="text-[11px] text-rose-300/90 leading-relaxed">
              If rejected, standard shift completion policies apply. Short hours (&lt;8h) may be subject to half-day
              shortfall or deduction according to company attendance settings.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Rejection Reason / Remarks (Recommended)
            </label>
            <textarea
              value={rejectModal.remarks}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, remarks: e.target.value }))}
              placeholder="e.g. Critical deployment underway; early exit cannot be accommodated."
              rows={3}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setRejectModal({ isOpen: false, request: null, remarks: '', submitting: false })}
              disabled={rejectModal.submitting}
              className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={rejectModal.submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              <span>{rejectModal.submitting ? 'Rejecting...' : 'Confirm Rejection'}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* CANCEL CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={cancelModal.isOpen}
        onClose={() => setCancelModal({ isOpen: false, request: null, submitting: false })}
        onConfirm={handleCancel}
        title="Cancel EarlyPass Request"
        message={`Are you sure you want to cancel EarlyPass request ${cancelModal.request?.pass_reference}? This action cannot be undone.`}
        confirmText="Yes, Cancel Request"
        variant="danger"
      />

      {/* CREATE EARLYPASS REQUEST MODAL (SECTION 1) */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="EarlyPass – Early Exit Request"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200">
            <p className="font-semibold text-white">Attendance Exception Policy</p>
            <p className="text-[11px] text-amber-300/80 mt-0.5">
              Approved requests waive salary deductions for short working hours. Actual punch times and working duration
              will remain accurately recorded in your attendance history.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Request Date</label>
              <input
                type="date"
                value={createForm.request_date}
                onChange={(e) => setCreateForm({ ...createForm, request_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <FormError message={createErrors.request_date} id="ep-date-err" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Check-In Time</label>
              <input
                type="time"
                value={createForm.check_in_time}
                onChange={(e) => setCreateForm({ ...createForm, check_in_time: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
              <FormError message={createErrors.check_in_time} id="ep-checkin-err" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Requested Exit Time</label>
            <input
              type="time"
              value={createForm.requested_exit_time}
              onChange={(e) => setCreateForm({ ...createForm, requested_exit_time: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
            />
            <FormError message={createErrors.requested_exit_time} id="ep-exit-err" />
          </div>

          {creationDurationPreview?.invalid && (
            <p className="text-xs text-rose-400 font-medium">{creationDurationPreview.msg}</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Leaving Early *</label>
            <textarea
              value={createForm.reason}
              onChange={(e) => setCreateForm({ ...createForm, reason: e.target.value })}
              required
              rows={2}
              placeholder="e.g. Doctor's appointment, personal emergency, family necessity..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
            />
            <FormError message={createErrors.reason} id="ep-reason-err" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Optional Remarks</label>
            <input
              type="text"
              value={createForm.remarks}
              onChange={(e) => setCreateForm({ ...createForm, remarks: e.target.value })}
              placeholder="Additional context or handover notes..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optional Attachment (e.g. Medical slip, document)
            </label>
            <input
              type="file"
              onChange={(e) => setCreateForm({ ...createForm, attachment: e.target.files?.[0] || null })}
              className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-500 cursor-pointer"
            />
            <FormError message={createErrors.attachment} id="ep-attach-err" />
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              disabled={createSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createSubmitting || creationDurationPreview?.invalid}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              <span>{createSubmitting ? 'Submitting...' : 'Submit Request'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* POLICY CONFIGURATION MODAL (SECTION 11 - ABUSE PREVENTION) */}
      <Modal
        isOpen={policyModalOpen}
        onClose={() => setPolicyModalOpen(false)}
        title="EarlyPass Company Policy Configuration"
      >
        <form onSubmit={handleSavePolicy} className="space-y-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200">
            <p className="font-semibold text-white">Abuse Prevention Rules</p>
            <p className="text-[11px] text-indigo-300/80 mt-0.5">
              These organization-wide thresholds govern eligibility and validation for all employee EarlyPass requests.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Max Requests / Month
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={policyData.early_pass_max_per_month}
                onChange={(e) =>
                  setPolicyData({ ...policyData, early_pass_max_per_month: parseInt(e.target.value) || 1 })
                }
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Min. Worked Hours Before Exit
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="8"
                value={policyData.early_pass_min_worked_hours}
                onChange={(e) =>
                  setPolicyData({ ...policyData, early_pass_min_worked_hours: parseFloat(e.target.value) || 0 })
                }
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Authorized Approver Role
            </label>
            <select
              value={policyData.early_pass_approval_role}
              onChange={(e) => setPolicyData({ ...policyData, early_pass_approval_role: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold"
            >
              <option value="HR_OR_CEO">Either HR or CEO (Default)</option>
              <option value="HR_ONLY">HR Approval Only</option>
              <option value="CEO_ONLY">CEO Approval Only</option>
            </select>
          </div>

          <div className="space-y-2.5 pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={policyData.early_pass_allow_same_day}
                onChange={(e) => setPolicyData({ ...policyData, early_pass_allow_same_day: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-300 font-medium">Allow same-day EarlyPass requests</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={policyData.early_pass_allow_cancellation}
                onChange={(e) => setPolicyData({ ...policyData, early_pass_allow_cancellation: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-300 font-medium">Allow employees to cancel pending requests</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={policyData.early_pass_attachment_mandatory}
                onChange={(e) =>
                  setPolicyData({ ...policyData, early_pass_attachment_mandatory: e.target.checked })
                }
                className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-500"
              />
              <span className="text-xs text-slate-300 font-medium">Require mandatory supporting attachment</span>
            </label>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setPolicyModalOpen(false)}
              disabled={policySaving}
              className="px-4 py-2 text-xs font-bold text-slate-400 bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={policySaving}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{policySaving ? 'Saving...' : 'Save Policy Settings'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EarlyPassManagementPage;
