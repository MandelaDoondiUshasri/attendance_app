import React, { useState } from 'react';
import {
  Lock, Unlock, CheckCircle2, AlertOctagon, RotateCcw,
  ShieldCheck, ArrowRight, FileCheck, AlertTriangle
} from 'lucide-react';
import Modal from '../../../components/common/Modal';
import api from '../../../services/api';
import { useAppState } from '../../../context/AppStateContext';

export const PayrollWorkflowModal = ({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onWorkflowComplete
}) => {
  const { addToast } = useAppState();
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState('finalize'); // 'review' | 'approve' | 'finalize' | 'reverse'
  const [reason, setReason] = useState('');

  const executeAction = async (action) => {
    if (action === 'reverse' && !reason.trim()) {
      addToast('An authorized reason is strictly required to unlock/reverse finalized payroll.', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/salaries/payroll/workflow/', {
        year: selectedYear,
        month: selectedMonth,
        action: action,
        reason: reason.trim(),
      });
      addToast(res.data?.message || `Payroll workflow action '${action}' completed.`, 'success');
      setReason('');
      if (onWorkflowComplete) onWorkflowComplete();
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || `Failed to execute ${action} on payroll.`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Monthly Payroll Lifecycle & Audit Lock (${selectedMonth}/${selectedYear})`}
    >
      <div className="space-y-5">
        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-300 leading-relaxed">
            Statutory payroll follows an immutable 4-stage governance pipeline. Once finalized, records are cryptographically locked and official PDF payslips are published. Unlocking requires executive audit justification.
          </p>

          {/* Workflow Stepper */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-bold uppercase tracking-wider">
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
              1. Draft / Calc
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              2. Under Review
            </div>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-300 border border-teal-500/30">
              3. Approved
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3 text-emerald-400" /> 4. Finalized
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => executeAction('review')}
            className="p-3 rounded-xl bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/40 text-indigo-200 text-xs font-bold text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span>Submit for Review</span>
              <ArrowRight className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-[10px] text-slate-400 font-normal">
              Freeze preliminary attendance edits and queue for HR audit.
            </p>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => executeAction('approve')}
            className="p-3 rounded-xl bg-teal-900/30 hover:bg-teal-900/50 border border-teal-500/40 text-teal-200 text-xs font-bold text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span>Approve Payroll</span>
              <ShieldCheck className="w-4 h-4 text-teal-400" />
            </div>
            <p className="text-[10px] text-slate-400 font-normal">
              HR verification complete; validate statutory PF / ESI figures.
            </p>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => executeAction('finalize')}
            className="p-3 rounded-xl bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-500/40 text-emerald-200 text-xs font-bold text-left transition-all"
          >
            <div className="flex items-center justify-between mb-1">
              <span>Finalize & Lock</span>
              <Lock className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-[10px] text-slate-400 font-normal">
              Lock ledger, prevent duplicate runs & generate official payslips.
            </p>
          </button>
        </div>

        {/* Reverse / Unlock Section */}
        <div className="pt-4 border-t border-slate-800">
          <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <AlertTriangle className="w-4 h-4" /> Unlock / Reverse Finalized Payroll
          </h4>
          <p className="text-[11px] text-slate-400 mb-2">
            Used only when retro-attendance or salary adjustments are sanctioned by CEO/HR. Reason will be logged permanently in the audit trail.
          </p>
          <textarea
            rows="2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Authorized justification for unlocking payroll (Mandatory)..."
            className="w-full px-3 py-2 bg-slate-950 border border-rose-900/50 rounded-xl text-white text-xs placeholder:text-slate-600 focus:outline-none focus:border-rose-500"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={loading || !reason.trim()}
              onClick={() => executeAction('reverse')}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/40"
            >
              <Unlock className="w-3.5 h-3.5" /> Confirm Payroll Reversal & Unlock
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PayrollWorkflowModal;

