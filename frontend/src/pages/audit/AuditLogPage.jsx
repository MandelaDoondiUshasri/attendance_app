import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter } from 'lucide-react';
import api from '../../services/api';

export const AuditLogPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchAuditLogs = async () => {
    try {
      let url = '/audit/';
      if (actionFilter) url += `?action=${encodeURIComponent(actionFilter)}`;
      const res = await api.get(url);
      setLogs(res.data.results || res.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Executive System Audit Trail</h1>
          <p className="text-xs text-slate-400 mt-1">Immutable security log tracking logins, attendance, leave approvals, WFH, and salary modifications</p>
        </div>
      </div>

      {/* FILTER */}
      <div className="flex items-center gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div className="w-full max-w-xs">
          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Filter Action Type</label>
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. LOGIN, SALARY_INCREMENT, APPROVE_LEAVE..."
            className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor / User</th>
                <th className="p-3">Role</th>
                <th className="p-3">Action</th>
                <th className="p-3">Target Model</th>
                <th className="p-3">Reason / Details</th>
                <th className="p-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {logs.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-500 font-sans">No audit log records found</td></tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/40">
                    <td className="p-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="p-3 font-semibold text-white">{log.actor_email}</td>
                    <td className="p-3 text-indigo-400 font-bold">{log.actor_role}</td>
                    <td className="p-3 font-bold text-emerald-400">{log.action}</td>
                    <td className="p-3 text-slate-300">{log.target_model || '-'}</td>
                    <td className="p-3 text-slate-300 font-sans max-w-xs truncate">{log.reason}</td>
                    <td className="p-3 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
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

export default AuditLogPage;
