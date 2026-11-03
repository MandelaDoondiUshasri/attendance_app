import React, { useState, useEffect } from 'react';
import {
  Sliders, Shield, AlertTriangle, CheckCircle2, History,
  Save, RefreshCw, Info, Lock, Building, FileText
} from 'lucide-react';
import api from '../../../services/api';

const ESTABLISHMENT_CATEGORIES = [
  { value: 'STANDARD', label: 'Standard Industry / Commercial Establishment (12% Rate)' },
  { value: 'BEEDI', label: 'Beedi Manufacturing Industry (10% Eligible)' },
  { value: 'BRICK', label: 'Brick Industry (10% Eligible)' },
  { value: 'COIR', label: 'Coir Industry (other than spinning sector) (10% Eligible)' },
  { value: 'GUNNY', label: 'Gunny Manufacturing Industry (10% Eligible)' },
  { value: 'JUTE', label: 'Jute Industry (10% Eligible)' }
];

export const PFConfigTab = ({ addToast, isCEO }) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);

  const [form, setForm] = useState({
    wage_ceiling: '25000.00',
    previous_wage_ceiling: '15000.00',
    effective_date: '2026-09-17',
    gazette_notification: 'S.O. 5109(E)',
    employee_contribution_rate: '12.00',
    employer_contribution_rate: '12.00',
    employer_eps_rate: '8.33',
    employer_epf_rate: '3.67',
    employer_edli_rate: '0.50',
    admin_charge_rate: '0.50',
    min_admin_charge_active: '500.00',
    min_admin_charge_inactive: '75.00',
    eps_wage_ceiling: '25000.00',
    establishment_category: 'STANDARD',
    allow_higher_wage_contribution: true,
    is_special_10_percent_rate: false
  });

  const [changeReason, setChangeReason] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get('/salaries/pf/config/');
      const cfg = res.data?.config;
      if (cfg) {
        const isTen = parseFloat(cfg.employee_contribution_rate) === 10;
        setForm({
          wage_ceiling: String(cfg.wage_ceiling || '25000.00'),
          previous_wage_ceiling: String(cfg.previous_wage_ceiling || '15000.00'),
          effective_date: cfg.effective_date || '2026-09-17',
          gazette_notification: cfg.gazette_notification || 'S.O. 5109(E)',
          employee_contribution_rate: String(cfg.employee_contribution_rate || '12.00'),
          employer_contribution_rate: String(cfg.employer_contribution_rate || '12.00'),
          employer_eps_rate: String(cfg.employer_eps_rate || '8.33'),
          employer_epf_rate: String(cfg.employer_epf_rate || '3.67'),
          employer_edli_rate: String(cfg.employer_edli_rate || '0.50'),
          admin_charge_rate: String(cfg.admin_charge_rate || '0.50'),
          min_admin_charge_active: String(cfg.min_admin_charge_active || '500.00'),
          min_admin_charge_inactive: String(cfg.min_admin_charge_inactive || '75.00'),
          eps_wage_ceiling: String(cfg.eps_wage_ceiling || '25000.00'),
          establishment_category: cfg.establishment_category || 'STANDARD',
          allow_higher_wage_contribution: Boolean(cfg.allow_higher_wage_contribution),
          is_special_10_percent_rate: isTen
        });
      }
      setHistory(res.data?.audit_history || res.data?.history || []);
    } catch (err) {
      console.error('Failed to load PF config:', err);
      addToast?.('Unable to load statutory configuration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'is_special_10_percent_rate') {
        if (value) {
          updated.employee_contribution_rate = '10.00';
          updated.employer_contribution_rate = '10.00';
          updated.employer_epf_rate = '1.67';
        } else {
          updated.employee_contribution_rate = '12.00';
          updated.employer_contribution_rate = '12.00';
          updated.employer_epf_rate = '3.67';
        }
      }
      return updated;
    });
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setChangeReason('');
    setConfirmModalOpen(true);
  };

  const handleSaveConfig = async () => {
    if (!changeReason.trim()) {
      addToast?.('A reason / legal justification is required to update statutory settings.', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        wage_ceiling: form.wage_ceiling,
        previous_wage_ceiling: form.previous_wage_ceiling,
        effective_date: form.effective_date,
        employee_contribution_rate: form.employee_contribution_rate,
        employer_contribution_rate: form.employer_contribution_rate,
        employer_eps_rate: form.employer_eps_rate,
        employer_epf_rate: form.employer_epf_rate,
        employer_edli_rate: form.employer_edli_rate,
        admin_charge_rate: form.admin_charge_rate,
        min_admin_charge_active: form.min_admin_charge_active,
        min_admin_charge_inactive: form.min_admin_charge_inactive,
        eps_wage_ceiling: form.eps_wage_ceiling,
        establishment_category: form.establishment_category,
        allow_higher_wage_contribution: form.allow_higher_wage_contribution,
        reason: changeReason.trim()
      };
      await api.post('/salaries/pf/config/', payload);
      addToast?.('Statutory EPFO configuration updated and audit log recorded.', 'success');
      setConfirmModalOpen(false);
      fetchConfig();
    } catch (err) {
      console.error('Save config error:', err);
      addToast?.(err.response?.data?.error || 'Failed to update configuration.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            EPFO Statutory Configuration & Wage Ceilings (2026 Rules)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Administered under Ministry of Labour & Employment Gazette Notification S.O. 5109(E).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchConfig}
            title="Refresh"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* STATUTORY RULES INFO BOX */}
      <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/30 flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <div className="font-bold text-white">Statutory Update Overview — 2026 Rules</div>
          <p>
            Effective <strong className="text-emerald-400">17 September 2026</strong>, the statutory wage ceiling
            for mandatory coverage and contributions under the Employees' Provident Funds Scheme, 1952 is
            revised from <strong>₹15,000</strong> to <strong className="text-emerald-400">₹25,000 per month</strong>.
            Existing membership is preserved regardless of wage level.
          </p>
        </div>
      </div>

      {/* CONFIG FORM */}
      <form onSubmit={handleOpenConfirm} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* SECTION 1: WAGE CEILINGS & EFFECTIVE DATE */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> 1. Statutory Wage Ceilings & Transition Date
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Revised Statutory Wage Ceiling (₹/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="100"
                    value={form.wage_ceiling}
                    onChange={(e) => handleChange('wage_ceiling', e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">S.O. 5109(E) statutory benchmark: ₹25,000</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Previous Statutory Wage Ceiling (₹/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="100"
                    value={form.previous_wage_ceiling}
                    onChange={(e) => handleChange('previous_wage_ceiling', e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                    required
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">Applies for pre-transition periods: ₹15,000</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Statutory Effective Transition Date
                </label>
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(e) => handleChange('effective_date', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold text-emerald-400"
                  required
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Official Gazette Notification Date: 17-Sep-2026</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Pension (EPS) Wage Ceiling (₹/month)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-xs">₹</span>
                  <input
                    type="number"
                    step="100"
                    value={form.eps_wage_ceiling}
                    onChange={(e) => handleChange('eps_wage_ceiling', e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: CONTRIBUTION RATES & CHARGES */}
          <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4" /> 2. Contribution Rates & Allocations
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employee PF Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.employee_contribution_rate}
                  onChange={(e) => handleChange('employee_contribution_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold text-indigo-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Total Employer PF (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.employer_contribution_rate}
                  onChange={(e) => handleChange('employer_contribution_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold text-cyan-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employer EPS Share (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.employer_eps_rate}
                  onChange={(e) => handleChange('employer_eps_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold text-teal-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employer EPF Share (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.employer_epf_rate}
                  onChange={(e) => handleChange('employer_epf_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">EDLI Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.employer_edli_rate}
                  onChange={(e) => handleChange('employer_edli_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Admin Charge Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.admin_charge_rate}
                  onChange={(e) => handleChange('admin_charge_rate', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Min Admin Active (₹)</label>
                <input
                  type="number"
                  step="1"
                  value={form.min_admin_charge_active}
                  onChange={(e) => handleChange('min_admin_charge_active', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Min Admin Inactive (₹)</label>
                <input
                  type="number"
                  step="1"
                  value={form.min_admin_charge_inactive}
                  onChange={(e) => handleChange('min_admin_charge_inactive', e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 text-white rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none text-xs"
                  required
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: ESTABLISHMENT CATEGORY & 10% RATE TOGGLE */}
        <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4" /> 3. Establishment Category & Special Statutory Rates
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Establishment Category
              </label>
              <select
                value={form.establishment_category}
                onChange={(e) => handleChange('establishment_category', e.target.value)}
                className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
              >
                {ESTABLISHMENT_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800 w-full">
                <input
                  type="checkbox"
                  checked={form.is_special_10_percent_rate}
                  onChange={(e) => handleChange('is_special_10_percent_rate', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-amber-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    Enable Special 10% Statutory Contribution Rate
                    {form.is_special_10_percent_rate && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                        10% ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Applicable only to notified establishments under Section 6 1st Proviso.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
          >
            <Save className="w-4 h-4" />
            Update Statutory Configuration
          </button>
        </div>
      </form>

      {/* SECTION 4: AUDIT TRAIL LOG TABLE */}
      <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" /> Statutory Configuration Audit Trail
          </h4>
          <span className="text-[11px] text-slate-400">{history.length} Audit Entries</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Changed By</th>
                <th className="py-2.5 px-3">Field</th>
                <th className="py-2.5 px-3 text-right">Old Value</th>
                <th className="py-2.5 px-3 text-right">New Value</th>
                <th className="py-2.5 px-4">Legal Justification / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-500">
                    No statutory configuration changes recorded yet. Initial baseline active.
                  </td>
                </tr>
              ) : (
                history.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                      {log.modified_by_name || 'System Admin'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 whitespace-nowrap">
                      {log.field_name}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">
                      {log.previous_value}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-white whitespace-nowrap">
                      {log.new_value}
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {log.reason || 'Statutory compliance update'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONFIRMATION & JUSTIFICATION MODAL */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Confirm Statutory Setting Change</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Modifying EPFO statutory parameters directly impacts monthly salary deductions, employer
              liabilities, and ECR filings. EPFO compliance requires logging the authorized reason
              for this modification.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Authorized Change Justification <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="e.g. Updating to Gazette Notification S.O. 5109(E) statutory parameters"
                className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                disabled={saving || !changeReason.trim()}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Recording Change...' : 'Confirm & Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PFConfigTab;
