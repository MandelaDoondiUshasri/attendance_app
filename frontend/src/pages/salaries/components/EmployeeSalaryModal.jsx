import React, { useState, useEffect } from 'react';
import {
  DollarSign, Sliders, History, Save, Building2,
  AlertCircle, CheckCircle, Calculator, ShieldCheck
} from 'lucide-react';
import Modal from '../../../components/common/Modal';
import api from '../../../services/api';
import { useAppState } from '../../../context/AppStateContext';

export const EmployeeSalaryModal = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
  onOpenHistory
}) => {
  const { addToast } = useAppState();
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    salary_structure: '',
    calculation_mode: 'CTC_BASED',
    monthly_ctc: '',
    monthly_gross: '',
    basic_salary: '',
    hra: '',
    special_allowance: '',
    tax_regime: 'NEW_REGIME',
    professional_tax_state: 'TELANGANA',
    monthly_tds_override: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    effective_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    if (!isOpen || !employee) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const [structRes, salRes] = await Promise.all([
          api.get('/salaries/structures/'),
          api.get(`/salaries/employee-salaries/?employee_id=${employee.id}`)
        ]);

        const structList = structRes.data?.results || (Array.isArray(structRes.data) ? structRes.data : []);
        setStructures(structList);

        const salData = salRes.data?.results || (Array.isArray(salRes.data) ? salRes.data : []);
        if (salData.length > 0) {
          const s = salData[0];
          setHasExisting(true);
          setForm({
            salary_structure: s.salary_structure || '',
            calculation_mode: s.calculation_mode || 'CTC_BASED',
            monthly_ctc: s.monthly_ctc || '',
            monthly_gross: s.monthly_gross || '',
            basic_salary: s.basic_salary || '',
            hra: s.hra || '',
            special_allowance: s.special_allowance || '',
            tax_regime: s.tax_regime || 'NEW_REGIME',
            professional_tax_state: s.professional_tax_state || 'TELANGANA',
            monthly_tds_override: s.monthly_tds_override || '',
            bank_name: s.bank_name || '',
            bank_account_number: s.bank_account_number || '',
            bank_ifsc_code: s.bank_ifsc_code || '',
            effective_date: s.effective_date || new Date().toISOString().split('T')[0],
            reason: '',
          });
        } else {
          setHasExisting(false);
          const defaultStruct = structList.find(x => x.is_default);
          const nominalSal = employee.salary || 43000;
          setForm({
            salary_structure: defaultStruct ? defaultStruct.id : '',
            calculation_mode: 'CTC_BASED',
            monthly_ctc: nominalSal,
            monthly_gross: (nominalSal / 1.06).toFixed(2),
            basic_salary: (nominalSal / 1.06 * 0.5).toFixed(2),
            hra: (nominalSal / 1.06 * 0.25).toFixed(2),
            special_allowance: (nominalSal / 1.06 * 0.25).toFixed(2),
            tax_regime: 'NEW_REGIME',
            professional_tax_state: 'TELANGANA',
            monthly_tds_override: '',
            bank_name: '',
            bank_account_number: '',
            bank_ifsc_code: '',
            effective_date: new Date().toISOString().split('T')[0],
            reason: 'Initial salary structure assignment.',
          });
        }
      } catch (err) {
        console.error(err);
        addToast('Failed to load salary profile.', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, employee]);

  const handleCtcChange = (ctcVal) => {
    const ctc = parseFloat(ctcVal) || 0;
    const gross = (ctc / 1.06).toFixed(2);
    const basic = (gross * 0.5).toFixed(2);
    const hra = (basic * 0.5).toFixed(2);
    const special = (gross - basic - hra).toFixed(2);

    setForm(prev => ({
      ...prev,
      monthly_ctc: ctcVal,
      monthly_gross: gross,
      basic_salary: basic,
      hra: hra,
      special_allowance: special,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.monthly_ctc || parseFloat(form.monthly_ctc) <= 0) {
      addToast('A valid Monthly CTC amount is required.', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.post('/salaries/employee-salaries/', {
        employee: employee.id,
        salary_structure: form.salary_structure || null,
        calculation_mode: form.calculation_mode,
        monthly_ctc: parseFloat(form.monthly_ctc) || 0,
        monthly_gross: parseFloat(form.monthly_gross) || 0,
        basic_salary: parseFloat(form.basic_salary) || 0,
        hra: parseFloat(form.hra) || 0,
        special_allowance: parseFloat(form.special_allowance) || 0,
        tax_regime: form.tax_regime,
        professional_tax_state: form.professional_tax_state,
        monthly_tds_override: form.monthly_tds_override ? parseFloat(form.monthly_tds_override) : null,
        bank_name: form.bank_name,
        bank_account_number: form.bank_account_number,
        bank_ifsc_code: form.bank_ifsc_code,
        effective_date: form.effective_date,
        reason: form.reason || 'Salary configuration update.',
      });

      addToast(`Salary structure saved for ${employee.full_name}!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to update salary.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compensation & Statutory Profile — ${employee.full_name} (${employee.employee_id})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Top Summary / Switch to History */}
        <div className="flex items-center justify-between bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Designation</span>
            <span className="text-xs font-semibold text-slate-200">{employee.designation?.title || 'Staff Member'}</span>
          </div>

          {onOpenHistory && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenHistory(employee);
              }}
              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" /> View Revision History
            </button>
          )}
        </div>

        {/* Structure & CTC Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Salary Structure Template</label>
            <select
              value={form.salary_structure}
              onChange={(e) => setForm({ ...form, salary_structure: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
            >
              <option value="">Default Standard Structure</option>
              {structures.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Monthly CTC (₹) *</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold text-xs">₹</span>
              <input
                type="number"
                step="0.01"
                required
                value={form.monthly_ctc}
                onChange={(e) => handleCtcChange(e.target.value)}
                className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-sm font-bold"
              />
            </div>
          </div>
        </div>

        {/* Auto Computed Components */}
        <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 font-mono text-xs">
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Gross Salary (CTC / 1.06)</span>
            <span className="font-bold text-emerald-400">₹{form.monthly_gross || '0.00'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">Basic (50%)</span>
            <span className="font-bold text-slate-200">₹{form.basic_salary || '0.00'}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-sans">HRA (25%)</span>
            <span className="font-bold text-slate-200">₹{form.hra || '0.00'}</span>
          </div>
        </div>

        {/* Statutory Settings */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Professional Tax State</label>
            <select
              value={form.professional_tax_state}
              onChange={(e) => setForm({ ...form, professional_tax_state: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
            >
              <option value="TELANGANA">Telangana (₹200)</option>
              <option value="MAHARASHTRA">Maharashtra (₹200/₹300)</option>
              <option value="KARNATAKA">Karnataka (₹200)</option>
              <option value="GUJARAT">Gujarat (₹200)</option>
              <option value="WEST_BENGAL">West Bengal</option>
              <option value="DELHI">Delhi (Exempt / NIL)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Income Tax Regime</label>
            <select
              value={form.tax_regime}
              onChange={(e) => setForm({ ...form, tax_regime: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
            >
              <option value="NEW_REGIME">New Regime (Section 115BAC)</option>
              <option value="OLD_REGIME">Old Tax Regime</option>
            </select>
          </div>
        </div>

        {/* Bank Account Details */}
        <div className="pt-2 border-t border-slate-800">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
            Disbursement Bank Account
          </label>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Bank Name (e.g. HDFC Bank)"
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
            />
            <input
              type="text"
              placeholder="Account Number"
              value={form.bank_account_number}
              onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
            />
            <input
              type="text"
              placeholder="IFSC Code"
              value={form.bank_ifsc_code}
              onChange={(e) => setForm({ ...form, bank_ifsc_code: e.target.value.toUpperCase() })}
              className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono uppercase text-xs"
            />
          </div>
        </div>

        {/* Reason for Change (Triggers Revision Tracking) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Reason for Revision / Notes *
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Annual increment, promotion, or initial compensation setup..."
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
          />
        </div>

        {/* Buttons */}
        <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/40 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Compensation Profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default EmployeeSalaryModal;

