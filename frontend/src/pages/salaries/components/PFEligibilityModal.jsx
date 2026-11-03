import React, { useState } from 'react';
import {
  ShieldAlert, CheckCircle2, AlertOctagon, HelpCircle,
  Sparkles, RefreshCw, Info, Calendar, DollarSign, UserCheck
} from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/common/Modal';

export const PFEligibilityModal = ({ isOpen, onClose, addToast }) => {
  const [wages, setWages] = useState('20000');
  const [joiningDate, setJoiningDate] = useState('2026-10-01');
  const [previousMembership, setPreviousMembership] = useState(false);
  const [isInternational, setIsInternational] = useState(false);
  const [hasUan, setHasUan] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleAssess = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.post('/salaries/pf/eligibility/', {
        monthly_wages: wages,
        joining_date: joiningDate,
        previous_pf_membership: previousMembership,
        international_worker: isInternational,
        has_uan: hasUan
      });
      setResult(res.data?.assessment || null);
    } catch (err) {
      console.error('Eligibility assessment failed:', err);
      addToast?.('Failed to assess statutory eligibility.', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="EPFO Statutory Eligibility Engine — 2026 Rules Simulator"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleAssess} className="space-y-5 text-sm">
        <p className="text-xs text-slate-400">
          Simulate official statutory eligibility and coverage rules under Gazette S.O. 5109(E)
          (revised ₹25,000 wage ceiling effective 17 September 2026).
        </p>

        {/* INPUTS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Monthly Applicable Wages (₹)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400 text-xs">₹</span>
              <input
                type="number"
                min="0"
                step="500"
                value={wages}
                onChange={(e) => setWages(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                required
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">Basic + DA + Retaining Allowance</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Date of Joining
            </label>
            <input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
              required
            />
            <p className="text-[10px] text-slate-500 mt-0.5">Transition benchmark: 17-Sep-2026</p>
          </div>
        </div>

        {/* TOGGLES */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
            <input
              type="checkbox"
              checked={previousMembership}
              onChange={(e) => setPreviousMembership(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
            />
            <div>
              <div className="text-xs font-semibold text-white">Prior PF Member</div>
              <div className="text-[10px] text-slate-400">Preserves membership</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
            <input
              type="checkbox"
              checked={hasUan}
              onChange={(e) => setHasUan(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
            />
            <div>
              <div className="text-xs font-semibold text-white">Active UAN</div>
              <div className="text-[10px] text-slate-400">Allotted previously</div>
            </div>
          </label>

          <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
            <input
              type="checkbox"
              checked={isInternational}
              onChange={(e) => setIsInternational(e.target.checked)}
              className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
            />
            <div>
              <div className="text-xs font-semibold text-white">Int'l Worker</div>
              <div className="text-[10px] text-amber-400">Uncapped ceiling</div>
            </div>
          </label>
        </div>

        {/* SUBMIT BUTTON */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Evaluating Rules...' : 'Run Statutory Assessment'}
          </button>
        </div>

        {/* ASSESSMENT RESULT CARD */}
        {result && (
          <div className="mt-4 p-4 rounded-xl border border-slate-700 bg-slate-900/90 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                {result.pf_applicable ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-rose-400" />
                )}
                <span className="font-bold text-white text-sm">
                  {result.pf_applicable ? 'MANDATORY EPF COVERAGE' : 'STATUTORILY EXCLUDED'}
                </span>
              </div>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                Rule: {result.scenario || 'Standard'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-800/60">
                <div className="text-[10px] text-slate-400">EPF Member</div>
                <div className={`font-bold ${result.epf_member ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {result.epf_member ? 'YES (Covered)' : 'NO'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-800/60">
                <div className="text-[10px] text-slate-400">EPS Member (8.33%)</div>
                <div className={`font-bold ${result.eps_member ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {result.eps_member ? 'YES (Eligible)' : 'NO (EPF 12%)'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-800/60">
                <div className="text-[10px] text-slate-400">Statutory Ceiling</div>
                <div className="font-bold text-white">
                  ₹{result.applicable_ceiling ? parseFloat(result.applicable_ceiling).toLocaleString('en-IN') : 'None'}
                </div>
              </div>

              <div className="p-2 rounded bg-slate-800/60">
                <div className="text-[10px] text-slate-400">Employee Deduction</div>
                <div className="font-bold text-emerald-400">
                  {result.pf_applicable ? '12% of Wages' : '0%'}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
              <div className="text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" /> Statutory Explanation
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{result.reason}</p>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};

export default PFEligibilityModal;

