import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
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
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Rejection modal
  const [rejectModal, setRejectModal] = useState({
    isOpen: false,
    id: null,
    reason: '',
    error: ''
  });

  const fetchLeaves = async () => {
    try {
      setError(null);
      const res = await api.get('/leaves/requests/');
      setLeaves(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load leave records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/leaves/requests/${id}/approve/`);
      addToast('Leave approved successfully', 'success');
      fetchLeaves();
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
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
      addToast('Leave rejected', 'success');
      setRejectModal({ isOpen: false, id: null, reason: '', error: '' });
      fetchLeaves();
    } catch (e) {
      addToast(e.response?.data?.error || 'Rejection failed', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const canApprove = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';

  if (loading) return <LoadingState type="full" text="Loading leaves..." />;
  if (error) return <ErrorState message={error} onRetry={fetchLeaves} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Leave Management</h1>
        <p className="text-xs text-slate-400 mt-1">Review leave applications, deduct balances, and synchronize attendance status</p>
      </div>

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
                {canApprove && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    <EmptyState title="No leaves found" description="No leave requests available." icon={FileText} />
                  </td>
                </tr>
              ) : (
                leaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">
                      <div>{l.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{l.employee_id_code}</div>
                    </td>
                    <td className="p-3 text-slate-300">{l.leave_type_name}</td>
                    <td className="p-3 text-slate-300">{l.start_date}</td>
                    <td className="p-3 text-slate-300">{l.end_date}</td>
                    <td className="p-3 font-bold text-amber-400">{l.number_of_days} d</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{l.reason}</td>
                    <td className="p-3"><StatusBadge status={l.status} /></td>
                    {canApprove && (
                      <td className="p-3 text-right space-x-2">
                        {l.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(l.id)}
                              disabled={actionLoadingId === l.id}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px] disabled:opacity-50"
                            >
                              {actionLoadingId === l.id ? 'Approving...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => openRejectModal(l.id)}
                              disabled={actionLoadingId === l.id}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REJECTION MODAL */}
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
              placeholder="e.g. Schedule clash or staffing requirements"
              className={`w-full bg-slate-900 border ${
                rejectModal.error ? 'border-rose-500' : 'border-slate-700'
              } rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none`}
            />
            <FormError message={rejectModal.error} id="leave-reject-error" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
    </div>
  );
};

export default LeavePage;
