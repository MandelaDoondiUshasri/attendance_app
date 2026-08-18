import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Clock, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export const SalaryManagementPage = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSalaryData = async () => {
    try {
      const histRes = await api.get('/salaries/history/');
      setHistory(histRes.data.results || histRes.data || []);

      if (user?.role === 'CEO') {
        const salRes = await api.get('/salaries/');
        setSalaries(salRes.data.results || salRes.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Salary Governance & Compensation History</h1>
        <p className="text-xs text-slate-400 mt-1">Immutable audit records of salary increments, decrements, and executive compensation adjustments</p>
      </div>

      {user?.role === 'CEO' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" /> Active Employee Compensation Roster
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Employee</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Current Salary</th>
                  <th className="p-3">Effective Date</th>
                  <th className="p-3">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {salaries.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">
                      <div>{s.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{s.employee_id_code}</div>
                    </td>
                    <td className="p-3 text-slate-300">{s.department_name || 'N/A'}</td>
                    <td className="p-3 font-mono font-bold text-emerald-400 text-sm">₹{s.current_salary}</td>
                    <td className="p-3 text-slate-400">{s.effective_date}</td>
                    <td className="p-3 text-slate-400">{new Date(s.updated_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* IMMUTABLE SALARY HISTORY TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Immutable Salary Adjustment Logs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Employee</th>
                <th className="p-3">Type</th>
                <th className="p-3">Previous Salary</th>
                <th className="p-3">Change Amount</th>
                <th className="p-3">New Salary</th>
                <th className="p-3">Reason</th>
                <th className="p-3">Authorized By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {history.length === 0 ? (
                <tr><td colSpan="8" className="p-6 text-center text-slate-500">No salary modification history recorded</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-slate-300">{h.effective_date}</td>
                    <td className="p-3 font-semibold text-white">
                      <div>{h.employee_name}</div>
                      <div className="text-[10px] text-slate-400">{h.employee_id_code}</div>
                    </td>
                    <td className="p-3"><StatusBadge status={h.change_type} /></td>
                    <td className="p-3 font-mono text-slate-400">₹{h.previous_salary}</td>
                    <td className="p-3 font-mono font-bold text-indigo-400">
                      {h.change_type === 'INCREMENT' ? '+' : '-'}₹{h.amount} ({h.percentage}%)
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-400 text-sm">₹{h.new_salary}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{h.reason}</td>
                    <td className="p-3 text-slate-400">{h.changed_by_email || 'CEO Governance'}</td>
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

export default SalaryManagementPage;
