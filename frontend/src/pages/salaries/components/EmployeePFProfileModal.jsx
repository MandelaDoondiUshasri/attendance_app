import React, { useState, useEffect } from 'react';
import {
  Shield, CheckCircle2, AlertTriangle, UserCheck, Globe,
  Calendar, FileText, Percent, RefreshCw, Save, X, Info
} from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/common/Modal';

export const EmployeePFProfileModal = ({
  isOpen,
  onClose,
  employee,
  onSuccess,
  addToast
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reassessing, setReassessing] = useState(false);
  const [profileId, setProfileId] = useState(null);

  const [formData, setFormData] = useState({
    pf_applicable: true,
    epf_member: true,
    eps_member: true,
    uan_number: '',
    pf_account_number: '',
    pf_joining_date: '',
    previous_pf_membership: false,
    previous_employer_pf_details: '',
    international_worker: false,
    eps_eligibility: true,
    higher_wage_contribution: false,
    pf_contribution_rate: '12.00',
    establishment_category: 'GENERAL',
    pf_exclusion_status: false,
    exclusion_reason: '',
    basic_percentage: '50.00',
    da_percentage: '0.00',
    hra_percentage: '30.00',
    special_allowance_percentage: '20.00'
  });

  const [uanError, setUanError] = useState('');

  // Load profile when modal opens
  useEffect(() => {
    if (!isOpen || !employee?.id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setUanError('');
        const res = await api.get(`/salaries/pf/profiles/?employee_id=${employee.id}`);
        const profiles = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        if (profiles.length > 0) {
          const p = profiles[0];
          setProfileId(p.id);
          setFormData({
            pf_applicable: Boolean(p.pf_applicable),
            epf_member: Boolean(p.epf_member),
            eps_member: Boolean(p.eps_member),
            uan_number: p.uan_number || '',
            pf_account_number: p.pf_account_number || '',
            pf_joining_date: p.pf_joining_date || '',
            previous_pf_membership: Boolean(p.previous_pf_membership),
            previous_employer_pf_details: p.previous_employer_pf_details || '',
            international_worker: Boolean(p.international_worker),
            eps_eligibility: Boolean(p.eps_eligibility),
            higher_wage_contribution: Boolean(p.higher_wage_contribution),
            pf_contribution_rate: p.pf_contribution_rate ? String(p.pf_contribution_rate) : '12.00',
            establishment_category: p.establishment_category || 'GENERAL',
            pf_exclusion_status: Boolean(p.pf_exclusion_status),
            exclusion_reason: p.exclusion_reason || '',
            basic_percentage: p.basic_percentage ? String(p.basic_percentage) : '50.00',
            da_percentage: p.da_percentage ? String(p.da_percentage) : '0.00',
            hra_percentage: p.hra_percentage ? String(p.hra_percentage) : '30.00',
            special_allowance_percentage: p.special_allowance_percentage ? String(p.special_allowance_percentage) : '20.00'
          });
        } else {
          setProfileId(null);
          // Set sensible defaults based on employee details
          setFormData({
            pf_applicable: true,
            epf_member: true,
            eps_member: true,
            uan_number: '',
            pf_account_number: '',
            pf_joining_date: employee.joining_date || '',
            previous_pf_membership: false,
            previous_employer_pf_details: '',
            international_worker: false,
            eps_eligibility: true,
            higher_wage_contribution: false,
            pf_contribution_rate: '12.00',
            establishment_category: 'GENERAL',
            pf_exclusion_status: false,
            exclusion_reason: '',
            basic_percentage: '50.00',
            da_percentage: '0.00',
            hra_percentage: '30.00',
            special_allowance_percentage: '20.00'
          });
        }
      } catch (err) {
        console.error('Failed to load PF profile:', err);
        addToast?.('Error loading PF profile details.', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [isOpen, employee?.id]);

  const validateUAN = (val) => {
    if (!val || !val.trim()) {
      setUanError('');
      return true;
    }
    const clean = val.trim();
    if (!/^\d{12}$/.test(clean)) {
      setUanError('UAN must be a valid 12-digit numeric identification number.');
      return false;
    }
    setUanError('');
    return true;
  };

  const handleChange = (field, value) => {
    if (field === 'uan_number') {
      validateUAN(value);
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleReassess = async () => {
    if (!employee?.id) return;
    try {
      setReassessing(true);
      const res = await api.post('/salaries/pf/eligibility/', {
        employee_id: employee.id,
        monthly_wages: employee.salary,
        joining_date: employee.joining_date,
        previous_pf_membership: formData.previous_pf_membership,
        international_worker: formData.international_worker,
        has_uan: Boolean(formData.uan_number?.trim())
      });
      const ass = res.data?.assessment;
      if (ass) {
        setFormData((prev) => ({
          ...prev,
          pf_applicable: ass.pf_applicable,
          epf_member: ass.epf_member,
          eps_member: ass.eps_member,
          eps_eligibility: ass.eps_eligibility,
          pf_exclusion_status: ass.is_excluded,
          exclusion_reason: ass.exclusion_reason || ''
        }));
        addToast?.(`Statutory Assessment: ${ass.reason}`, 'info');
      }
    } catch (err) {
      console.error('Reassess failed:', err);
      addToast?.('Failed to assess statutory eligibility.', 'error');
    } finally {
      setReassessing(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.uan_number && !validateUAN(formData.uan_number)) {
      addToast?.('Please enter a valid 12-digit numerical UAN.', 'error');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        employee: employee.id,
        pf_applicable: formData.pf_applicable,
        epf_member: formData.epf_member,
        eps_member: formData.eps_member,
        uan_number: formData.uan_number ? formData.uan_number.trim() : null,
        pf_account_number: formData.pf_account_number ? formData.pf_account_number.trim() : '',
        pf_joining_date: formData.pf_joining_date || null,
        previous_pf_membership: formData.previous_pf_membership,
        previous_employer_pf_details: formData.previous_employer_pf_details || '',
        international_worker: formData.international_worker,
        eps_eligibility: formData.eps_eligibility,
        higher_wage_contribution: formData.higher_wage_contribution,
        pf_contribution_rate: formData.pf_contribution_rate,
        establishment_category: formData.establishment_category,
        pf_exclusion_status: formData.pf_exclusion_status,
        exclusion_reason: formData.exclusion_reason || '',
        basic_percentage: formData.basic_percentage,
        da_percentage: formData.da_percentage,
        hra_percentage: formData.hra_percentage,
        special_allowance_percentage: formData.special_allowance_percentage
      };

      if (profileId) {
        await api.patch(`/salaries/pf/profiles/${profileId}/`, payload);
        addToast?.('Employee PF profile updated successfully.', 'success');
      } else {
        const res = await api.post('/salaries/pf/profiles/', payload);
        setProfileId(res.data.id);
        addToast?.('Employee PF profile created successfully.', 'success');
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Save PF profile error:', err.response?.data);
      const data = err.response?.data;
      const msg = data?.uan_number?.[0] || data?.error || data?.detail || 'Failed to save PF profile.';
      addToast?.(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Statutory PF & Pension Profile — ${employee?.full_name || 'Employee'}`}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-emerald-400" />
          <p className="text-sm">Loading statutory PF profile...</p>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6 text-sm">
          {/* STATUTORY BADGE & HEADER SUMMARY */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400 font-medium">Employee ID & Base Compensation</div>
              <div className="text-base font-bold text-white flex items-center gap-2">
                <span>{employee?.employee_id}</span>
                <span className="text-slate-500">•</span>
                <span>₹{parseFloat(employee?.salary || 0).toLocaleString('en-IN')}/mo</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReassess}
                disabled={reassessing}
                className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reassessing ? 'animate-spin' : ''}`} />
                {reassessing ? 'Assessing...' : 'Re-assess Statutory Eligibility'}
              </button>
            </div>
          </div>

          {/* SECTION 1: UAN & PF IDENTIFIERS */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4" /> 1. EPFO Identifiers & UAN
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Universal Account Number (UAN)
                  <span className="text-slate-500 text-[10px] ml-1">(12 numeric digits)</span>
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={formData.uan_number}
                  onChange={(e) => handleChange('uan_number', e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 101234567890"
                  className={`w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border ${
                    uanError ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-emerald-500'
                  } focus:outline-none`}
                />
                {uanError && <p className="text-[11px] text-rose-400 mt-1">{uanError}</p>}
                <p className="text-[10px] text-slate-500 mt-0.5">
                  EPFO Mandatory: Must be the employee's genuine 12-digit UAN. Never enter mock numbers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  PF Member ID / Account Number
                </label>
                <input
                  type="text"
                  value={formData.pf_account_number}
                  onChange={(e) => handleChange('pf_account_number', e.target.value.toUpperCase())}
                  placeholder="e.g. MH/BAN/0012345/000/0000123"
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  PF Joining Date
                </label>
                <input
                  type="date"
                  value={formData.pf_joining_date}
                  onChange={(e) => handleChange('pf_joining_date', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  PF Contribution Rate
                </label>
                <select
                  value={formData.pf_contribution_rate}
                  onChange={(e) => handleChange('pf_contribution_rate', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="12.00">12.00% (Standard Statutory Rate)</option>
                  <option value="10.00">10.00% (Special Qualified Establishment)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: STATUTORY MEMBERSHIP & COVERAGE FLAGS */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> 2. Statutory EPF & EPS Membership Flags
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.pf_applicable}
                  onChange={(e) => handleChange('pf_applicable', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">PF Applicable</div>
                  <div className="text-[10px] text-slate-400">Subject to EPF scheme deductions</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.epf_member}
                  onChange={(e) => handleChange('epf_member', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">EPF Member</div>
                  <div className="text-[10px] text-slate-400">Enrolled in EPF Scheme 1952</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.eps_member}
                  onChange={(e) => handleChange('eps_member', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">EPS Member (8.33%)</div>
                  <div className="text-[10px] text-slate-400">Pension Scheme 1995 active</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.eps_eligibility}
                  onChange={(e) => handleChange('eps_eligibility', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">EPS Eligibility (Age &lt; 58)</div>
                  <div className="text-[10px] text-slate-400">Ceases on reaching 58 years</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.international_worker}
                  onChange={(e) => handleChange('international_worker', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">International Worker</div>
                  <div className="text-[10px] text-amber-400">Uncapped ceiling (Para 83)</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 cursor-pointer hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={formData.higher_wage_contribution}
                  onChange={(e) => handleChange('higher_wage_contribution', e.target.checked)}
                  className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                />
                <div>
                  <div className="text-xs font-semibold text-white">Higher Wage PF Option</div>
                  <div className="text-[10px] text-indigo-400">Voluntary uncapped EPF wage</div>
                </div>
              </label>
            </div>
          </div>

          {/* SECTION 3: PREVIOUS PF DETAILS & EXCLUSION AUDIT */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4" /> 3. Previous Employment & Exclusion Audit
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.previous_pf_membership}
                    onChange={(e) => handleChange('previous_pf_membership', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    Existing / Previous PF Member (Preserves Membership)
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Previous Employer PF & Pension Details
                  </label>
                  <textarea
                    rows={2}
                    value={formData.previous_employer_pf_details}
                    onChange={(e) => handleChange('previous_employer_pf_details', e.target.value)}
                    placeholder="Previous establishment code, past UAN, exit date, etc."
                    className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.pf_exclusion_status}
                    onChange={(e) => handleChange('pf_exclusion_status', e.target.checked)}
                    className="rounded bg-slate-700 border-slate-600 text-rose-500 focus:ring-0"
                  />
                  <span className="text-xs font-semibold text-rose-300">
                    Excluded Employee (Para 2(f)(ii) of EPF Scheme)
                  </span>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Statutory Exclusion Reason
                  </label>
                  <input
                    type="text"
                    value={formData.exclusion_reason}
                    onChange={(e) => handleChange('exclusion_reason', e.target.value)}
                    placeholder="e.g. Joined post 17-Sep-2026 earning > ₹25,000 without prior UAN"
                    className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: SALARY COMPONENT MAPPING FOR STATUTORY PF WAGES */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                <Percent className="w-4 h-4" /> 4. Salary Component Structure (PF Wage Determination)
              </h4>
              <span className="text-[10px] text-slate-400">
                Statutory PF Wages = Basic + DA + Retaining Allowance
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Basic Salary %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.basic_percentage}
                  onChange={(e) => handleChange('basic_percentage', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Dearness Allowance %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.da_percentage}
                  onChange={(e) => handleChange('da_percentage', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">HRA % (PF Excluded)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.hra_percentage}
                  onChange={(e) => handleChange('hra_percentage', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Special Allowance %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.special_allowance_percentage}
                  onChange={(e) => handleChange('special_allowance_percentage', e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs px-3 py-2 rounded-lg border border-slate-700 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || Boolean(uanError)}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save PF Profile'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default EmployeePFProfileModal;

