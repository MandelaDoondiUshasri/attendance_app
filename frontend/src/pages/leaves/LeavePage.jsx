import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import EmptyState from '../../components/common/states/EmptyState';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
export const LeavePage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      await api.post(`/leaves/requests/${id}/approve/`);
      addToast('Leave approved successfully', 'success');
      fetchLeaves();
    } catch (e) {
      addToast(e.response?.data?.error || 'Approval failed', 'error');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await api.post(`/leaves/requests/${id}/reject/`, { rejection_reason: reason });
      addToast('Leave rejected', 'success');
      fetchLeaves();
    } catch (e) {
      addToast(e.response?.data?.error || 'Rejection failed', 'error');
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
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px]"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(l.id)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px]"
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
    </div>
  );
};

export default LeavePage;
