import React, { useState, useEffect } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, ShieldAlert,
  Calendar, AlertTriangle, CheckCircle, ChevronRight, Sliders,
  HelpCircle, UserX, ArrowUpRight, ArrowDownRight, Award
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import PermissionDenied from '../../components/common/states/PermissionDenied';
import FormError from '../../components/common/states/FormError';

export const SalaryManagementPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  const [payrollData, setPayrollData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Salary Adjustment Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [adjFormErrors, setAdjFormErrors] = useState({});
  const [adjForm, setAdjForm] = useState({
    type: 'INCREMENT', // INCREMENT or DECREMENT
    amount: '',
    reason: '',
    effective_date: new Date().toISOString().split('T')[0],
    confirmed: false
  });
  const [adjLoading, setAdjLoading] = useState(false);

  const fetchPayrollAndHistory = async () => {
    if ((!['CEO', 'SYSTEM_ADMIN'].includes(user?.role))) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const [payRes, histRes] = await Promise.all([
        api.get(`/salaries/payroll/?month=${selectedMonth}&year=${selectedYear}`),
        api.get('/salaries/history/')
      ]);
      setPayrollData(payRes.data);
      setHistory(histRes.data.results || histRes.data || []);
    } catch (e) {
      console.error('Error fetching payroll data:', e);
      setError('Unable to load payroll financial records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayrollAndHistory();
  }, [selectedMonth, selectedYear]);

  const openAdjustmentModal = (emp) => {
    setSelectedEmp(emp);
    setAdjFormErrors({});
    setAdjForm({
      type: 'INCREMENT',
      amount: '',
      reason: '',
      effective_date: new Date().toISOString().split('T')[0],
      confirmed: false
    });
    setIsAdjModalOpen(true);
  };

  const handleSalaryAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const errors = {};
    if (!adjForm.amount || parseFloat(adjForm.amount) <= 0) {
      errors.amount = 'Please enter a valid positive adjustment amount.';
    }
    if (!adjForm.reason?.trim()) {
      errors.reason = 'Please enter a justification for this salary change.';
    }
    if (!adjForm.confirmed) {
      errors.confirmed = 'You must confirm and authorize this compensation adjustment.';
    }

    if (Object.keys(errors).length > 0) {
      setAdjFormErrors(errors);
      return;
    }

    setAdjLoading(true);
    try {
      const endpoint = adjForm.type === 'INCREMENT' ? '/salaries/increment/' : '/salaries/decrement/';
      await api.post(endpoint, {
        employee_id: selectedEmp.employee_id,
        amount: parseFloat(adjForm.amount),
        reason: adjForm.reason.trim(),
        effective_date: adjForm.effective_date,
        confirmed: true
      });

      addToast(`Successfully applied salary ${adjForm.type.toLowerCase()} for ${selectedEmp.full_name}!`, 'success');
      setIsAdjModalOpen(false);
      setAdjFormErrors({});
      fetchPayrollAndHistory();
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.message || 'Failed to update salary', 'error');
    } finally {
      setAdjLoading(false);
    }
  };

  if ((!['CEO', 'SYSTEM_ADMIN'].includes(user?.role))) {
    return <PermissionDenied />;
  }

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const summary = payrollData?.summary || {
    total_base_payroll: '0.00',
    total_deductions: '0.00',
    total_net_payroll: '0.00',
    total_employees: 0,
    penalized_employees: 0
  };

  return (
    <div className="space-y-6">
      {/* HEADER & MONTH FILTER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-400" /> Executive Financial & Payroll Governance
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automated leave & WFH salary deductions, real-time payroll breakdown, and executive compensation control
          </p>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* POLICY REMINDER BANNER */}
      <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-200">
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-indigo-400 shrink-0" />
          <span>
            <strong>Company Policy Enforced:</strong> 1 Sick Leave & 1 Casual Leave & 4 WFH allowed free/month. Any leaves exceeding these thresholds (&gt;1 SL, &gt;1 CL, &gt;4 WFH) or shift deficits are automatically deducted at standard daily compensation rates.
          </span>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="text-xs font-semibold text-slate-400 mb-1">Gross Base Payroll</div>
          <div className="text-2xl font-extrabold text-white font-mono">
            ₹{parseFloat(summary.total_base_payroll).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-500 mt-2">{summary.total_employees} Total Active Employees</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-xs font-semibold text-rose-300 mb-1 flex items-center justify-between">
            <span>Total Deductions</span>
            <TrendingDown className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold text-rose-400 font-mono">
            -₹{parseFloat(summary.total_deductions).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-rose-300/70 mt-2">{summary.penalized_employees} staff with deductions</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-xs font-semibold text-emerald-300 mb-1 flex items-center justify-between">
            <span>Net Disbursable Payroll</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono">
            ₹{parseFloat(summary.total_net_payroll).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-300/70 mt-2">After all policy penalties</div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="text-xs font-semibold text-slate-400 mb-1">Attendance Compliance</div>
          <div className="text-2xl font-extrabold text-indigo-400 font-mono">
            {summary.total_employees > 0
              ? `${Math.round(((summary.total_employees - summary.penalized_employees) / summary.total_employees) * 100)}%`
              : '100%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-2">100% full attendance rate</div>
        </div>
      </div>

      {/* MONTHLY PAYROLL BREAKDOWN TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-emerald-400" /> Monthly Payroll & Salary Deductions Roster
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Base Salary</th>
                <th className="p-3">Sick Leave (1 Free)</th>
                <th className="p-3">Casual Leave (1 Free)</th>
                <th className="p-3">WFH (4 Free)</th>
                <th className="p-3">Half-Day/Absence</th>
                <th className="p-3 text-rose-400">Total Deductions</th>
                <th className="p-3 text-emerald-400">Net Payable</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan="9" className="p-6 text-center text-slate-500">Calculating monthly payroll records...</td></tr>
              ) : !payrollData?.records?.length ? (
                <tr><td colSpan="9" className="p-6 text-center text-slate-500">No employee records found.</td></tr>
              ) : (
                payrollData.records.map((r) => (
                  <tr key={r.employee_id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{r.full_name}</span>
                        {r.is_half_day && (
                          <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">HALF DAY</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.employee_code} • {r.department}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-200">
                      ₹{parseFloat(r.base_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {/* SICK LEAVE */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{r.sick_leaves_taken} days</span>
                        {r.excess_sick_leaves > 0 ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                            +{r.excess_sick_leaves} excess (-₹{r.sick_leave_deduction})
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">✓ Free</span>
                        )}
                      </div>
                    </td>
                    {/* CASUAL LEAVE */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{r.casual_leaves_taken} days</span>
                        {r.excess_casual_leaves > 0 ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                            +{r.excess_casual_leaves} excess (-₹{r.casual_leave_deduction})
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">✓ Free</span>
                        )}
                      </div>
                    </td>
                    {/* WFH */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{r.wfh_days_taken} days</span>
                        {r.excess_wfh_days > 0 ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                            +{r.excess_wfh_days} excess (-₹{r.wfh_deduction})
                          </span>
                        ) : (
                          <span className="text-[10px] text-emerald-400">✓ Free</span>
                        )}
                      </div>
                    </td>
                    {/* HALF DAYS / ABSENCES */}
                    <td className="p-3 text-slate-300">
                      {r.half_days_count > 0 || r.absent_days_count > 0 ? (
                        <div className="text-[11px] font-mono text-amber-400">
                          {r.half_days_count > 0 && `${r.half_days_count} HD `}
                          {r.absent_days_count > 0 && `${r.absent_days_count} Absent`}
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-500">None</span>
                      )}
                    </td>
                    {/* TOTAL DEDUCTIONS */}
                    <td className="p-3 font-mono font-bold text-rose-400 text-sm">
                      {parseFloat(r.total_deduction) > 0 ? (
                        `-₹${parseFloat(r.total_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      ) : (
                        '₹0.00'
                      )}
                    </td>
                    {/* NET PAYABLE */}
                    <td className="p-3 font-mono font-black text-emerald-400 text-sm">
                      ₹{parseFloat(r.net_payable_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    {/* ACTIONS */}
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openAdjustmentModal(r)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-700 inline-flex items-center gap-1 transition-all"
                      >
                        <Sliders className="w-3.5 h-3.5 text-brand-400" /> Adjust
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* IMMUTABLE SALARY ADJUSTMENT AUDIT LOGS */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-400" /> Immutable Salary Adjustment Logs (Increments & Decrements)
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
                <tr><td colSpan="8" className="p-6 text-center text-slate-500">No salary modifications logged yet.</td></tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-slate-300">{h.effective_date}</td>
                    <td className="p-3 font-semibold text-white">
                      <div>{h.employee_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{h.employee_id_code}</div>
                    </td>
                    <td className="p-3"><StatusBadge status={h.change_type} /></td>
                    <td className="p-3 font-mono text-slate-400">₹{h.previous_salary}</td>
                    <td className="p-3 font-mono font-bold text-indigo-400">
                      {h.change_type === 'INCREMENT' ? '+' : '-'}₹{h.amount} ({h.percentage}%)
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-400 text-sm">₹{h.new_salary}</td>
                    <td className="p-3 text-slate-300 max-w-xs truncate">{h.reason}</td>
                    <td className="p-3 text-slate-400 font-mono">{h.changed_by_email || 'CEO Governance'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SALARY INCREMENT / DECREMENT MODAL */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title={`Executive Salary Adjustment - ${selectedEmp?.full_name}`}
      >
        <form onSubmit={handleSalaryAdjustment} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Current Base Salary</div>
              <div className="text-base font-bold font-mono text-white">
                ₹{selectedEmp?.base_salary}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Daily Rate (1/30th)</div>
              <div className="text-sm font-mono text-slate-300">
                ₹{selectedEmp?.daily_rate}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: 'INCREMENT' })}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  adjForm.type === 'INCREMENT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" /> Increment (+)
              </button>
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: 'DECREMENT' })}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  adjForm.type === 'DECREMENT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" /> Decrement (-)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="adj-amount" className="block text-xs font-semibold text-slate-300 mb-1">
              Adjustment Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <input
              id="adj-amount"
              type="number"
              value={adjForm.amount}
              onChange={(e) => {
                setAdjForm({ ...adjForm, amount: e.target.value });
                if (adjFormErrors.amount) setAdjFormErrors({ ...adjFormErrors, amount: null });
              }}
              placeholder="e.g. 5000"
              min="1"
              className={`w-full p-2.5 bg-slate-900 border ${
                adjFormErrors.amount ? 'border-rose-500' : 'border-slate-800'
              } rounded-xl text-xs text-white focus:outline-none focus:border-brand-500`}
            />
            <FormError message={adjFormErrors.amount} id="adj-amount-error" />
          </div>

          <div>
            <label htmlFor="adj-reason" className="block text-xs font-semibold text-slate-300 mb-1">
              Reason for Executive Adjustment <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="adj-reason"
              value={adjForm.reason}
              onChange={(e) => {
                setAdjForm({ ...adjForm, reason: e.target.value });
                if (adjFormErrors.reason) setAdjFormErrors({ ...adjFormErrors, reason: null });
              }}
              placeholder="e.g. Performance appraisal increment, promotion, structural adjustment..."
              rows={3}
              className={`w-full p-2.5 bg-slate-900 border ${
                adjFormErrors.reason ? 'border-rose-500' : 'border-slate-800'
              } rounded-xl text-xs text-white resize-none focus:outline-none focus:border-brand-500`}
            />
            <FormError message={adjFormErrors.reason} id="adj-reason-error" />
          </div>

          <div>
            <label htmlFor="adj-date" className="block text-xs font-semibold text-slate-300 mb-1">Effective Date</label>
            <input
              id="adj-date"
              type="date"
              value={adjForm.effective_date}
              onChange={(e) => setAdjForm({ ...adjForm, effective_date: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={adjForm.confirmed}
                onChange={(e) => {
                  setAdjForm({ ...adjForm, confirmed: e.target.checked });
                  if (adjFormErrors.confirmed) setAdjFormErrors({ ...adjFormErrors, confirmed: null });
                }}
                className="w-4 h-4 mt-0.5 rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                I hereby authorize this executive salary change as CEO. This adjustment will permanently update employee payroll records and write an immutable audit log.
              </span>
            </label>
            <FormError message={adjFormErrors.confirmed} id="adj-confirm-error" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjLoading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {adjLoading ? (
                <LoadingState type="button" text="Authorizing..." />
              ) : (
                'Authorize & Apply'
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SalaryManagementPage;
