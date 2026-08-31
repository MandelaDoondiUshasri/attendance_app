import React, { useState, useEffect } from 'react';
import { Users, FileText, Home, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import EmptyState from '../../components/common/states/EmptyState';
import FormError from '../../components/common/states/FormError';
import ScreenTimeTrackerCard from '../../components/screentime/ScreenTimeTrackerCard';
import { useAuth } from '../../context/AuthContext';
import CompanyLogo from '../../components/common/CompanyLogo';

export const HRDashboard = () => {
  const { companyName } = useAuth();
  const { addToast } = useAppState();
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingWFH, setPendingWFH] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [activeModal, setActiveModal] = useState(null); // 'EMPLOYEES_LIST'

  // Rejection modal
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    type: null, // 'LEAVE' | 'WFH'
    id: null,
    reason: '',
    error: ''
  });

  const fetchQueues = async () => {
    try {
      setLoading(true);
      const [leaveRes, wfhRes, corrRes, empRes] = await Promise.all([
        api.get('/leaves/requests/?status=PENDING'),
        api.get('/wfh/requests/?status=PENDING'),
        api.get('/attendance/corrections/?status=PENDING'),
        api.get('/employees/')
      ]);
      setPendingLeaves(leaveRes.data.results || leaveRes.data || []);
      setPendingWFH(wfhRes.data.results || wfhRes.data || []);
      setPendingCorrections((corrRes.data.results || corrRes.data || []).filter(c => c.status === 'PENDING'));
      setEmployeesList(empRes.data.results || empRes.data || []);
    } catch (e) {
      console.error(e);
      addToast('Failed to load HR review queues', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  const handleApproveLeave = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/leaves/requests/${id}/approve/`);
      addToast('Leave request approved successfully!', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchQueues();
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (type, id) => {
    setRejectModal({
      isOpen: true,
      type,
      id,
      reason: '',
      error: ''
    });
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModal.reason?.trim()) {
      setRejectModal({ ...rejectModal, error: 'Please enter a rejection reason.' });
      return;
    }

    try {
      setActionLoadingId(rejectModal.id);
      if (rejectModal.type === 'LEAVE') {
        await api.post(`/leaves/requests/${rejectModal.id}/reject/`, { rejection_reason: rejectModal.reason.trim() });
        addToast('Leave request rejected.', 'success');
      } else if (rejectModal.type === 'WFH') {
        await api.post(`/wfh/requests/${rejectModal.id}/reject/`, { rejection_reason: rejectModal.reason.trim() });
        addToast('WFH request rejected.', 'success');
      }
      window.dispatchEvent(new CustomEvent('badge-updated'));
      setRejectModal({ isOpen: false, type: null, id: null, reason: '', error: '' });
      fetchQueues();
    } catch (e) {
      addToast(e.response?.data?.error || 'Rejection failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveWFH = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/wfh/requests/${id}/approve/`);
      addToast('WFH request approved successfully!', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchQueues();
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproveCorr = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/attendance/corrections/${id}/approve/`);
      addToast('Attendance correction approved!', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchQueues();
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <LoadingState type="cards" count={3} />
        <LoadingState type="table" count={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3.5">
        <CompanyLogo size="md" showGlow={true} />
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">{companyName || 'Enterprise'} HR Operations & Review Hub</h1>
          <p className="text-xs text-slate-400 mt-1">Review pending leave applications, remote work approvals, and correction requests</p>
        </div>
      </div>

      {/* QUEUE COUNT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div 
          onClick={() => setActiveModal('EMPLOYEES_LIST')}
          className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between cursor-pointer hover:border-brand-500/50 transition-all hover:-translate-y-0.5 group"
        >
          <div>
            <p className="text-xs font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors">Total Employees</p>
            <p className="text-3xl font-black text-indigo-400 mt-1">{employeesList.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending Leave Queue</p>
            <p className="text-3xl font-black text-amber-400 mt-1">{pendingLeaves.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending WFH Queue</p>
            <p className="text-3xl font-black text-indigo-400 mt-1">{pendingWFH.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Home className="w-6 h-6" />
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400">Pending Correction Queue</p>
            <p className="text-3xl font-black text-purple-400 mt-1">{pendingCorrections.length}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* EMPLOYEE SCREEN TIME TRACKING */}
      <ScreenTimeTrackerCard />

      {/* PENDING LEAVES SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" /> Pending Leave Requests ({pendingLeaves.length})
        </h3>
        {pendingLeaves.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={FileText}
              title="No Pending Leave Requests"
              description="There are no pending employee leave applications awaiting your approval."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Leave Type</th>
                  <th className="p-3">Dates</th>
                  <th className="p-3">Days</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{l.employee_name} ({l.employee_id_code})</td>
                    <td className="p-3 text-slate-300">{l.leave_type_name}</td>
                    <td className="p-3 text-slate-300">{l.start_date} → {l.end_date}</td>
                    <td className="p-3 font-bold text-amber-400">{l.number_of_days} d</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{l.reason}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleApproveLeave(l.id)}
                        disabled={actionLoadingId === l.id}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {actionLoadingId === l.id ? 'Approving...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => openRejectModal('LEAVE', l.id)}
                        disabled={actionLoadingId === l.id}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PENDING WFH SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Home className="w-5 h-5 text-indigo-400" /> Pending WFH Requests ({pendingWFH.length})
        </h3>
        {pendingWFH.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Home}
              title="No Pending WFH Requests"
              description="There are no remote work requests awaiting your review."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Target Date</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingWFH.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{w.employee_name} ({w.employee_id_code})</td>
                    <td className="p-3 font-bold text-indigo-400">{w.date}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{w.reason}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleApproveWFH(w.id)}
                        disabled={actionLoadingId === w.id}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {actionLoadingId === w.id ? 'Approving...' : 'Approve WFH'}
                      </button>
                      <button
                        onClick={() => openRejectModal('WFH', w.id)}
                        disabled={actionLoadingId === w.id}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 transition-colors disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PENDING ATTENDANCE CORRECTIONS SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" /> Pending Attendance Corrections ({pendingCorrections.length})
        </h3>
        {pendingCorrections.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Clock}
              title="No Pending Corrections"
              description="No attendance correction tickets are currently pending."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Requested Check-In</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingCorrections.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{c.employee_name} ({c.employee_id_code})</td>
                    <td className="p-3 text-slate-300">{c.date}</td>
                    <td className="p-3 font-bold text-purple-400">{new Date(c.requested_check_in).toLocaleTimeString()}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{c.reason}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleApproveCorr(c.id)}
                        disabled={actionLoadingId === c.id}
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors disabled:opacity-50"
                      >
                        {actionLoadingId === c.id ? 'Approving...' : 'Approve Correction'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={rejectModal.isOpen}
        onClose={() => setRejectModal({ isOpen: false, type: null, id: null, reason: '', error: '' })}
        title={`Reject ${rejectModal.type === 'LEAVE' ? 'Leave' : 'WFH'} Request`}
      >
        <form onSubmit={handleConfirmReject} className="space-y-4">
          <div>
            <label htmlFor="hr-reject-reason" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Rejection <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="hr-reject-reason"
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value, error: '' })}
              placeholder="e.g. Insufficient coverage or operational schedule conflict"
              className={`w-full bg-slate-900 border ${
                rejectModal.error ? 'border-rose-500' : 'border-slate-700'
              } rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none`}
            />
            <FormError message={rejectModal.error} id="hr-reject-error" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRejectModal({ isOpen: false, type: null, id: null, reason: '', error: '' })}
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

      {/* EMPLOYEES LIST MODAL */}
      <Modal isOpen={activeModal === 'EMPLOYEES_LIST'} onClose={() => setActiveModal(null)} title="Total Employees List">
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
          {employeesList.length === 0 ? (
            <p className="text-slate-400 text-sm">No employees found.</p>
          ) : (
            employeesList.map(emp => (
              <div key={emp.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold text-white">{emp.full_name} <span className="text-xs text-slate-400 font-mono">({emp.employee_id})</span></p>
                  <p className="text-xs text-slate-400 mt-1">{emp.role} • {emp.work_mode}</p>
                </div>
                <div>
                  {emp.employment_status === 'ACTIVE' ? (
                    <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-bold">ACTIVE</span>
                  ) : (
                    <span className="px-2 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[10px] font-bold">INACTIVE</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};

export default HRDashboard;
