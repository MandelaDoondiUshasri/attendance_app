import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, Sliders, History, Save, Building2,
  AlertCircle, CheckCircle, Calculator, ShieldCheck, ToggleLeft, ToggleRight
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
  const [existingId, setExistingId] = useState(null);

  const [form, setForm] = useState({
    salary_structure: '',
    calculation_mode: 'CTC_BASED',
    monthly_ctc: '43000',
    monthly_gross: '40566.04',
    basic_salary: '20283.02',
    hra: '10141.51',
    special_allowance: '10141.51',
    
    // 6 Independent Statutory Deduction Toggles
    employee_pf_enabled: true,
    employer_pf_enabled: true,
    pt_enabled: true,
    employee_esi_enabled: true,
    employer_esi_enabled: true,
    tds_enabled: true,

    tax_regime: 'NEW_REGIME',
    professional_tax_state: 'TELANGANA',
    monthly_tds_override: '',
    bank_name: '',
    bank_account_number: '',
    bank_ifsc_code: '',
    effective_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  // Pure live calculation function reproducing reference model
  const livePreview = useMemo(() => {
    const ctc = parseFloat(form.monthly_ctc) || 0;
    const er_pf_on = form.employer_pf_enabled !== false;
    // HR Reference Formula: Gross = CTC / 1.06 (if employer PF is part of CTC)
    const gross = er_pf_on ? Math.round((ctc / 1.06) * 100) / 100 : ctc;
    const basic = Math.round((gross * 0.50) * 100) / 100;
    const hra = Math.round((basic * 0.50) * 100) / 100; // 50% of Basic = 25% of Gross
    const special = Math.round((gross - basic - hra) * 100) / 100;

    const ee_pf = (form.employee_pf_enabled !== false) ? Math.round((basic * 0.12) * 100) / 100 : 0;
    const er_pf = er_pf_on ? Math.round((basic * 0.12) * 100) / 100 : 0;

    let pt = 0;
    if (form.pt_enabled !== false) {
      pt = (form.professional_tax_state === 'DELHI') ? 0 : 200;
    }

    let ee_esi = 0;
    let er_esi = 0;
    if (gross <= 21000 && gross > 0) {
      if (form.employee_esi_enabled !== false) ee_esi = Math.round((gross * 0.0075) * 100) / 100;
      if (form.employer_esi_enabled !== false) er_esi = Math.round((gross * 0.0325) * 100) / 100;
    }

    let tds = 0;
    if (form.tds_enabled !== false && form.monthly_tds_override) {
      tds = parseFloat(form.monthly_tds_override) || 0;
    }

    const total_deductions = Math.round((ee_pf + pt + ee_esi + tds) * 100) / 100;
    const net_salary = Math.round(Math.max(0, gross - total_deductions) * 100) / 100;
    const total_ctc = Math.round((gross + er_pf + er_esi) * 100) / 100;

    return {
      gross,
      basic,
      hra,
      special,
      ee_pf,
      er_pf,
      pt,
      ee_esi,
      er_esi,
      tds,
      total_deductions,
      net_salary,
      total_ctc
    };
  }, [
    form.monthly_ctc,
    form.employee_pf_enabled,
    form.employer_pf_enabled,
    form.pt_enabled,
    form.employee_esi_enabled,
    form.employer_esi_enabled,
    form.tds_enabled,
    form.professional_tax_state,
    form.monthly_tds_override
  ]);

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
          setExistingId(s.id);
          setForm({
            salary_structure: s.structure || s.salary_structure || '',
            calculation_mode: s.calculation_mode || 'CTC_BASED',
            monthly_ctc: s.monthly_ctc || '43000',
            monthly_gross: s.monthly_gross || '40566.04',
            basic_salary: s.basic_salary || '20283.02',
            hra: s.hra || '10141.51',
            special_allowance: s.special_allowance || '10141.51',

            // Load saved 6 toggles
            employee_pf_enabled: s.employee_pf_enabled !== false,
            employer_pf_enabled: s.employer_pf_enabled !== false,
            pt_enabled: s.pt_enabled !== false,
            employee_esi_enabled: s.employee_esi_enabled !== false,
            employer_esi_enabled: s.employer_esi_enabled !== false,
            tds_enabled: s.tds_enabled !== false,

            tax_regime: s.tax_regime || 'NEW_REGIME',
            professional_tax_state: s.pt_state || s.professional_tax_state || 'TELANGANA',
            monthly_tds_override: s.monthly_tds || s.monthly_tds_override || '',
            bank_name: s.bank_name || '',
            bank_account_number: s.bank_account_number || '',
            bank_ifsc_code: s.bank_ifsc || s.bank_ifsc_code || '',
            effective_date: s.effective_date || new Date().toISOString().split('T')[0],
            reason: '',
          });
        } else {
          setExistingId(null);
          const defaultStruct = structList.find(x => x.is_default);
          const nominalSal = parseFloat(employee.salary) > 0 ? employee.salary : 43000;
          setForm({
            salary_structure: defaultStruct ? defaultStruct.id : '',
            calculation_mode: 'CTC_BASED',
            monthly_ctc: nominalSal,
            monthly_gross: (nominalSal / 1.06).toFixed(2),
            basic_salary: ((nominalSal / 1.06) * 0.50).toFixed(2),
            hra: ((nominalSal / 1.06) * 0.25).toFixed(2),
            special_allowance: ((nominalSal / 1.06) * 0.25).toFixed(2),

            employee_pf_enabled: true,
            employer_pf_enabled: true,
            pt_enabled: true,
            employee_esi_enabled: true,
            employer_esi_enabled: true,
            tds_enabled: true,

            tax_regime: 'NEW_REGIME',
            professional_tax_state: 'TELANGANA',
            monthly_tds_override: '',
            bank_name: '',
            bank_account_number: '',
            bank_ifsc_code: '',
            effective_date: new Date().toISOString().split('T')[0],
            reason: 'Initial salary structure configuration.',
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
    setForm(prev => ({
      ...prev,
      monthly_ctc: ctcVal
    }));
  };

  const handleToggle = (key) => {
    setForm(prev => ({
      ...prev,
      [key]: !prev[key]
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
      const payload = {
        employee: employee.id,
        structure: form.salary_structure || null,
        calculation_mode: form.calculation_mode,
        monthly_ctc: parseFloat(form.monthly_ctc) || 0,
        monthly_gross: livePreview.gross,
        basic_salary: livePreview.basic,
        hra: livePreview.hra,
        special_allowance: livePreview.special,

        // Save 6 Independent Statutory Toggles
        employee_pf_enabled: form.employee_pf_enabled,
        employer_pf_enabled: form.employer_pf_enabled,
        pt_enabled: form.pt_enabled,
        employee_esi_enabled: form.employee_esi_enabled,
        employer_esi_enabled: form.employer_esi_enabled,
        tds_enabled: form.tds_enabled,

        pf_applicable: (form.employee_pf_enabled || form.employer_pf_enabled),
        esi_applicable: (form.employee_esi_enabled || form.employer_esi_enabled),
        tax_regime: form.tax_regime,
        pt_state: form.professional_tax_state,
        monthly_tds: form.monthly_tds_override ? parseFloat(form.monthly_tds_override) : 0,
        bank_name: form.bank_name,
        bank_account_number: form.bank_account_number,
        bank_ifsc: form.bank_ifsc_code,
        effective_date: form.effective_date,
        reason: form.reason || 'Salary configuration update.',
      };

      if (existingId) {
        await api.patch(`/salaries/employee-salaries/${existingId}/`, payload);
      } else {
        await api.post('/salaries/employee-salaries/', payload);
      }

      addToast(`Salary structure saved for ${employee.full_name}!`, 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || err.response?.data?.detail || 'Failed to update salary.', 'error');
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
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[85vh] overflow-y-auto pr-1">
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
              <option value="">Default Standard Structure (50-25-25)</option>
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

        {/* Live Computed Salary Breakdown Cards */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-emerald-400" /> Live Salary Preview
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Formula: Gross = CTC / 1.06
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Gross Salary</span>
              <span className="font-bold text-emerald-400">₹{livePreview.gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Basic (50%)</span>
              <span className="font-bold text-slate-200">₹{livePreview.basic.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">HRA (25%)</span>
              <span className="font-bold text-slate-200">₹{livePreview.hra.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Special All. (25%)</span>
              <span className="font-bold text-slate-200">₹{livePreview.special.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs pt-1">
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Employee PF (12%)</span>
              <span className={`font-bold ${form.employee_pf_enabled ? 'text-rose-400' : 'text-slate-500 line-through'}`}>
                ₹{livePreview.ee_pf.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Prof. Tax (PT)</span>
              <span className={`font-bold ${form.pt_enabled ? 'text-rose-400' : 'text-slate-500 line-through'}`}>
                ₹{livePreview.pt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <span className="text-[10px] text-slate-400 block font-sans">Total Deductions</span>
              <span className="font-bold text-rose-300">
                ₹{livePreview.total_deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-emerald-950/40 p-2 rounded-lg border border-emerald-800/60">
              <span className="text-[10px] text-emerald-400 font-bold block font-sans">Net In-Hand Pay</span>
              <span className="font-extrabold text-emerald-300 text-sm">
                ₹{livePreview.net_salary.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STATUTORY DEDUCTION SETTINGS (6 FUNCTIONAL INDEPENDENT TOGGLES) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <div className="bg-slate-950/90 p-3.5 rounded-xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Statutory Deduction Settings
            </h4>
            <span className="text-[10px] text-slate-400 font-sans">
              Instant reactive override
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Toggle 1: Employee PF */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Employee PF Deduction</span>
                <span className="text-[10px] text-slate-400 block">12% deducted from basic salary</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('employee_pf_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.employee_pf_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.employee_pf_enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Toggle 2: Employer PF */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Employer PF Contribution</span>
                <span className="text-[10px] text-slate-400 block">12% corporate contribution in CTC</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('employer_pf_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.employer_pf_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.employer_pf_enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Toggle 3: Professional Tax */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Professional Tax (PT)</span>
                <span className="text-[10px] text-slate-400 block">State-specific statutory deduction</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('pt_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.pt_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.pt_enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Toggle 4: Employee ESI */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Employee ESI</span>
                <span className="text-[10px] text-slate-400 block">0.75% for gross ≤ ₹21,000</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('employee_esi_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.employee_esi_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.employee_esi_enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Toggle 5: Employer ESI */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Employer ESI</span>
                <span className="text-[10px] text-slate-400 block">3.25% for gross ≤ ₹21,000</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('employer_esi_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.employer_esi_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.employer_esi_enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Toggle 6: Income Tax / TDS */}
            <div className="flex items-center justify-between p-2.5 bg-slate-900/90 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs font-bold text-slate-200 block">Income Tax / TDS</span>
                <span className="text-[10px] text-slate-400 block">Monthly tax deduction at source</span>
              </div>
              <button
                type="button"
                onClick={() => handleToggle('tds_enabled')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                  form.tds_enabled
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                {form.tds_enabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* State & Tax Regime Settings */}
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

        {/* Action Buttons */}
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
