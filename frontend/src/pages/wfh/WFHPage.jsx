import React, { useState, useEffect } from 'react';
import { Home, CheckCircle, XCircle } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export const WFHPage = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWFH = async () => {
    try {
      const res = await api.get('/wfh/requests/');
      setRequests(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWFH();
  }, []);

  const handleApprove = async (id) => {
    try {
      await api.post(`/wfh/requests/${id}/approve/`);
      fetchWFH();
    } catch (e) {
      alert(e.response?.data?.error || 'Approval failed');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await api.post(`/wfh/requests/${id}/reject/`, { rejection_reason: reason });
      fetchWFH();
    } catch (e) {
      alert(e.response?.data?.error || 'Rejection failed');
    }
  };

  const canApprove = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Work From Home (WFH) Requests</h1>
        <p className="text-xs text-slate-400 mt-1">Manage remote work applications and enable secure WFH check-ins</p>
      </div>

      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
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
              {requests.length === 0 ? (
                <tr><td colSpan="5" className="p-6 text-center text-slate-500">No WFH requests found</td></tr>
              ) : (
                requests.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">
                      <div>{w.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{w.employee_id_code}</div>
                    </td>
                    <td className="p-3 font-bold text-indigo-400">{w.date}</td>
                    <td className="p-3 text-slate-400 max-w-xs truncate">{w.reason}</td>
                    <td className="p-3"><StatusBadge status={w.status} /></td>
                    {canApprove && (
                      <td className="p-3 text-right space-x-2">
                        {w.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(w.id)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px]"
                            >
                              Approve WFH
                            </button>
                            <button
                              onClick={() => handleReject(w.id)}
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

export default WFHPage;
