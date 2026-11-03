import React, { useState, useEffect } from 'react';
import {
  History, TrendingUp, TrendingDown, Clock, ShieldCheck,
  CheckCircle, ArrowUpRight, ArrowDownRight, UserCheck, Calendar
} from 'lucide-react';
import Modal from '../../../components/common/Modal';
import api from '../../../services/api';
import { useAppState } from '../../../context/AppStateContext';

const formatINR = (val) => {
  if (val === null || val === undefined) return '₹0.00';
  const num = typeof val === 'number' ? val : parseFloat(val);
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const SalaryRevisionHistoryModal = ({
  isOpen,
  onClose,
  employee
}) => {
  const { addToast } = useAppState();
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !employee) return;

    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/salaries/salary-revisions/?employee_id=${employee.id}`);
        const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setRevisions(data);
      } catch (err) {
        console.error(err);
        addToast('Unable to load salary revision history.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [isOpen, employee]);

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compensation Revision Audit Trail — ${employee.full_name}`}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Immutable historical audit log tracking all compensation revisions, increment percentages, effective dates, and authorized reasons for {employee.full_name} ({employee.employee_id}).
        </p>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading revision audit history...</div>
        ) : revisions.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800">
            <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-300">No Historical Revisions Recorded</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Salary revisions will appear here automatically when compensation packages are modified.
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {revisions.map((rev) => (
              <div
                key={rev.id}
                className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                      rev.change_type === 'INCREMENT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : rev.change_type === 'PROMOTION'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        : 'bg-slate-800 text-slate-300 border border-slate-700'
                    }`}>
                      {rev.change_type}
                    </span>
                    {parseFloat(rev.percentage_change || 0) > 0 && (
                      <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-0.5">
                        <ArrowUpRight className="w-3.5 h-3.5" /> +{rev.percentage_change}%
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    Effective: {rev.effective_date}
                  </span>
                </div>

                {/* Amount Comparisons */}
                <div className="grid grid-cols-2 gap-3 pt-1 font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Monthly CTC</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-400 line-through text-[11px]">{formatINR(rev.previous_monthly_ctc)}</span>
                      <span className="text-white font-bold">{formatINR(rev.revised_monthly_ctc)}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block font-sans">Monthly Gross</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-slate-400 line-through text-[11px]">{formatINR(rev.previous_gross)}</span>
                      <span className="text-emerald-300 font-bold">{formatINR(rev.revised_gross)}</span>
                    </div>
                  </div>
                </div>

                {/* Justification & Approver */}
                <div className="pt-2 border-t border-slate-900 text-xs text-slate-300">
                  <span className="text-slate-500 font-semibold mr-1">Reason:</span>
                  <span className="italic">"{rev.reason || 'Not specified'}"</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>Authorized by: {rev.approved_by_name || 'System / HR Administrator'}</span>
                  <span>Recorded: {new Date(rev.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 flex justify-end border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SalaryRevisionHistoryModal;

