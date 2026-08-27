import React, { useState, useEffect } from 'react';
import { Users, FileText, Home, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';

export const HRDashboard = () => {
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingWFH, setPendingWFH] = useState([]);
  const [pendingCorrections, setPendingCorrections] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueues = async () => {
    try {
      const [leaveRes, wfhRes, corrRes] = await Promise.all([
        api.get('/leaves/requests/?status=PENDING'),
        api.get('/wfh/requests/?status=PENDING'),
        api.get('/attendance/corrections/?status=PENDING')
      ]);
      setPendingLeaves(leaveRes.data.results || leaveRes.data || []);
      setPendingWFH(wfhRes.data.results || wfhRes.data || []);
      setPendingCorrections((corrRes.data.results || corrRes.data || []).filter(c => c.status === 'PENDING'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueues();
  }, []);

  const handleApproveLeave = async (id) => {
    try {
      await api.post(`/leaves/requests/${id}/approve/`);
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || 'Approval failed');
    }
  };

  const handleRejectLeave = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return;
    try {
      await api.post(`/leaves/requests/${id}/reject/`, { rejection_reason: reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || 'Rejection failed');
    }
  };

  const handleApproveWFH = async (id) => {
    try {
      await api.post(`/wfh/requests/${id}/approve/`);
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || 'Approval failed');
    }
  };

  const handleRejectWFH = async (id) => {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return;
    try {
      await api.post(`/wfh/requests/${id}/reject/`, { rejection_reason: reason });
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || 'Rejection failed');
    }
  };

  const handleApproveCorr = async (id) => {
    try {
      await api.post(`/attendance/corrections/${id}/approve/`);
      fetchQueues();
    } catch (e) {
      alert(e.response?.data?.error || 'Approval failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">HR Operations & Review Hub</h1>
        <p className="text-xs text-slate-400 mt-1">Review pending leave applications, remote work approvals, and correction requests</p>
      </div>

      {/* QUEUE COUNT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

      {/* PENDING LEAVES SECTION */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-400" /> Pending Leave Requests ({pendingLeaves.length})
        </h3>
        {pendingLeaves.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No pending leave applications in queue</div>
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
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleRejectLeave(l.id)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 transition-colors"
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
          <div className="p-8 text-center text-slate-500 text-sm">No pending WFH applications in queue</div>
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
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors"
                      >
                        Approve WFH
                      </button>
                      <button
                        onClick={() => handleRejectWFH(w.id)}
                        className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 transition-colors"
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
          <div className="p-8 text-center text-slate-500 text-sm">No pending attendance correction requests</div>
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
                        className="px-2.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 transition-colors"
                      >
                        Approve Correction
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
  );
};

export default HRDashboard;
