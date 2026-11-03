import React, { useState, useEffect } from 'react';
import {
  Layers, Plus, Check, Star, CheckCircle, Sliders,
  HelpCircle, Eye, Edit2, AlertCircle, RefreshCw, Sparkles, Building2
} from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/common/Modal';
import { useAppState } from '../../../context/AppStateContext';

export const SalaryStructureTab = () => {
  const { addToast } = useAppState();
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    calculation_mode: 'CTC_BASED',
    basic_percentage: 50.00,
    da_percentage: 0.00,
    hra_percentage: 50.00,
    conveyance_allowance: 0.00,
    special_allowance_percentage: 25.00,
    other_allowance: 0.00,
    is_default: false,
    is_active: true,
  });

  const fetchStructures = async () => {
    try {
      setLoading(true);
      const res = await api.get('/salaries/structures/');
      const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      setStructures(data);
    } catch (err) {
      console.error('Failed to load salary structures:', err);
      addToast('Unable to load salary structure templates.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructures();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      addToast('Template Name and Unique Code are required.', 'error');
      return;
    }

    try {
      setSaving(true);
      await api.post('/salaries/structures/', form);
      addToast('Salary structure template created successfully!', 'success');
      setModalOpen(false);
      fetchStructures();
    } catch (err) {
      console.error('Save error:', err);
      addToast(err.response?.data?.error || 'Failed to save salary structure.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (structureId) => {
    try {
      await api.post(`/salaries/structures/${structureId}/set-default/`);
      addToast('Default salary structure template updated.', 'success');
      fetchStructures();
    } catch (err) {
      console.error(err);
      addToast('Failed to set default structure.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Salary Structure Templates
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                Master Governance
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Define corporate compensation packages, component ratios, and CTC / Gross calculation policies
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setForm({
              name: '',
              code: '',
              description: '',
              calculation_mode: 'CTC_BASED',
              basic_percentage: 50.00,
              da_percentage: 0.00,
              hra_percentage: 50.00,
              conveyance_allowance: 0.00,
              special_allowance_percentage: 25.00,
              other_allowance: 0.00,
              is_default: false,
              is_active: true,
            });
            setModalOpen(true);
          }}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all flex items-center gap-2 shadow-lg shadow-indigo-950/40"
        >
          <Plus className="w-4 h-4" /> Create Structure Template
        </button>
      </div>

      {/* Structure Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {structures.map((s) => (
          <div
            key={s.id}
            className={`bg-slate-900/80 border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all ${
              s.is_default
                ? 'border-indigo-500/50 bg-gradient-to-b from-indigo-950/20 to-slate-900/90'
                : 'border-slate-800 hover:border-slate-700'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white">{s.name}</h3>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold block mt-0.5">
                    CODE: {s.code}
                  </span>
                </div>
                {s.is_default && (
                  <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Star className="w-2.5 h-2.5 fill-emerald-300" /> Default
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                {s.description || 'Standard corporate salary distribution policy.'}
              </p>

              {/* Component Bar Visualization */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Calculation Mode:</span>
                  <span className="font-semibold text-slate-200 uppercase font-mono text-[11px]">
                    {s.calculation_mode}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Basic Salary:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {s.basic_percentage}% of Gross
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">HRA:</span>
                  <span className="font-mono font-bold text-teal-300">
                    {s.hra_percentage}% of Basic
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Special Allowance:</span>
                  <span className="font-mono font-bold text-indigo-300">
                    {s.special_allowance_percentage}% (Remainder)
                  </span>
                </div>

                {/* Visual Ratio Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 flex overflow-hidden mt-3 border border-slate-800">
                  <div
                    style={{ width: `${s.basic_percentage}%` }}
                    className="bg-emerald-500 h-full"
                    title={`Basic: ${s.basic_percentage}%`}
                  />
                  <div
                    style={{ width: `${s.basic_percentage * (s.hra_percentage / 100)}%` }}
                    className="bg-teal-500 h-full"
                    title={`HRA: ${s.hra_percentage}% of Basic`}
                  />
                  <div
                    style={{ width: `${100 - s.basic_percentage - (s.basic_percentage * (s.hra_percentage / 100))}%` }}
                    className="bg-indigo-500 h-full"
                    title="Special Allowance / Remainder"
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                  <span>Basic (50%)</span>
                  <span>HRA (25%)</span>
                  <span>Special (25%)</span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase ${s.is_active ? 'text-emerald-400' : 'text-slate-500'}`}>
                {s.is_active ? '● Active' : '○ Inactive'}
              </span>

              {!s.is_default && (
                <button
                  onClick={() => handleSetDefault(s.id)}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all flex items-center gap-1"
                >
                  <Star className="w-3 h-3 text-amber-400" /> Set as Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Creation Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Salary Structure Template"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Template Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Executive 50-25-25"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Unique Code *</label>
              <input
                type="text"
                required
                placeholder="e.g. EXEC_50_25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs uppercase font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Calculation Mode</label>
            <select
              value={form.calculation_mode}
              onChange={(e) => setForm({ ...form, calculation_mode: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-medium"
            >
              <option value="CTC_BASED">CTC Based (Gross = CTC / 1.06, Solves Employer PF)</option>
              <option value="GROSS_BASED">Gross Based (Deductions from Direct Gross)</option>
              <option value="COMPONENT_WISE">Component-Wise (Sum of explicit amounts)</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Basic %</label>
              <input
                type="number"
                step="0.01"
                value={form.basic_percentage}
                onChange={(e) => setForm({ ...form, basic_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">HRA (% of Basic)</label>
              <input
                type="number"
                step="0.01"
                value={form.hra_percentage}
                onChange={(e) => setForm({ ...form, hra_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Special Allow. %</label>
              <input
                type="number"
                step="0.01"
                value={form.special_allowance_percentage}
                onChange={(e) => setForm({ ...form, special_allowance_percentage: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
            <textarea
              rows="2"
              placeholder="Compensation policy details..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
            />
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
                className="rounded border-slate-700 text-indigo-500 bg-slate-950"
              />
              <span className="text-xs text-slate-300">Set as Company Default</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded border-slate-700 text-indigo-500 bg-slate-950"
              />
              <span className="text-xs text-slate-300">Active</span>
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/40"
            >
              {saving ? 'Saving...' : 'Create Structure'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SalaryStructureTab;

