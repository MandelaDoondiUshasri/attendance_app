import React, { useState, useEffect } from 'react';
import { Home, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import EmptyState from '../../components/common/states/EmptyState';
import ErrorState from '../../components/common/states/ErrorState';
import FormError from '../../components/common/states/FormError';

export const WFHPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Rejection Modal State
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');

  const fetchWFH = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/wfh/requests/');
      setRequests(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
      setError('Unable to load Work From Home requests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWFH();
  }, []);

  const handleApprove = async (id) => {
    try {
      setActionLoadingId(id);
      await api.post(`/wfh/requests/${id}/approve/`);
      addToast('WFH request approved successfully!', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      fetchWFH();
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to approve WFH request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const openRejectModal = (id) => {
    setRejectTargetId(id);
    setRejectReason('');
    setRejectError('');
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError('Please provide a reason for rejection.');
      return;
    }

    try {
      setActionLoadingId(rejectTargetId);
      await api.post(`/wfh/requests/${rejectTargetId}/reject/`, { rejection_reason: rejectReason.trim() });
      addToast('WFH request rejected.', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      setRejectModalOpen(false);
      fetchWFH();
    } catch (e) {
      addToast(e.response?.data?.error || 'Failed to reject WFH request', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const canApprove = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Work From Home (WFH) Requests</h1>
        <p className="text-xs text-slate-400 mt-1">Manage remote work applications and enable secure WFH check-ins</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        {loading ? (
          <LoadingState type="table" count={4} text="Loading WFH requests..." />
        ) : error ? (
          <ErrorState message={error} onRetry={fetchWFH} />
        ) : requests.length === 0 ? (
          <EmptyState 
            icon={Home}
            title="No WFH Requests"
            description="There are currently no active or past Work From Home requests submitted."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Target Date</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Status</th>
                  {canApprove && <th className="p-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {requests.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div>{w.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{w.employee_id_code}</div>
                    </td>
                    <td className="p-3 font-bold text-indigo-400">
                      {w.start_date === w.end_date ? w.start_date : `${w.start_date} to ${w.end_date}`}
                    </td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{w.reason}</td>
                    <td className="p-3"><StatusBadge status={w.status} /></td>
                    {canApprove && (
                      <td className="p-3 text-right space-x-2">
                        {w.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              disabled={actionLoadingId === w.id}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px] transition-all disabled:opacity-50"
                            >
                              {actionLoadingId === w.id ? (
                                <LoadingState type="button" text="Processing..." />
                              ) : (
                                'Approve WFH'
                              )}
                            </button>
                            <button
                              onClick={() => openRejectModal(w.id)}
                              disabled={actionLoadingId === w.id}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] transition-all disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REJECTION REASON MODAL (State #9 Form Validation) */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject WFH Request"
      >
        <form onSubmit={handleRejectSubmit} className="space-y-4">
          <div>
            <label htmlFor="wfh-reject-reason" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Reason for Rejection <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="wfh-reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError('');
              }}
              placeholder="e.g. In-office presence required for client audit"
              className={`w-full bg-slate-900 border ${
                rejectError ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20' : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/20'
              } rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all resize-none`}
            />
            <FormError message={rejectError} id="wfh-reject-error" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === rejectTargetId}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-rose-600/20 disabled:opacity-50"
            >
              {actionLoadingId === rejectTargetId ? (
                <LoadingState type="button" text="Rejecting..." />
              ) : (
                'Confirm Rejection'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default WFHPage;
