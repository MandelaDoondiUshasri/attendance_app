import React, { useState, useEffect } from 'react';
import {
  Settings, Save, Calendar, Clock, Building2, ShieldCheck,
  CheckCircle2, Plus, Trash2, Award, Zap, AlertCircle, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';

export const SettingsPage = () => {
  const { user, setCompanyName } = useAuth();
  const [settings, setSettings] = useState({
    company_name: 'FRG Enterprise',
    office_start_time: '09:00',
    office_end_time: '18:00',
    grace_period_minutes: 15,
    required_working_hours: 8.0,
    half_day_threshold_hours: 4.0
  });

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [isAddHolidayModal, setIsAddHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState({ title: '', date: '', description: '' });

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      const [setRes, holRes] = await Promise.all([
        api.get('/core/settings/'),
        api.get('/core/holidays/')
      ]);
      setSettings(setRes.data);
      setHolidays(holRes.data.results || holRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsData();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.patch('/core/settings/', settings);
      setCompanyName(settings.company_name);
      setSaveSuccess('Organization & Attendance Rule settings updated successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  const handleCreateHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.post('/core/holidays/', newHoliday);
      alert('Official holiday added successfully!');
      setIsAddHolidayModal(false);
      setNewHoliday({ title: '', date: '', description: '' });
      fetchSettingsData();
    } catch (err) {
      alert(err.response?.data?.title?.[0] || err.response?.data?.date?.[0] || 'Failed to add holiday');
    }
  };

  const handleDeleteHoliday = async (id, title) => {
    if (!window.confirm(`Are you sure you want to remove ${title} from official holidays?`)) return;
    try {
      await api.delete(`/core/holidays/${id}/`);
      fetchSettingsData();
    } catch (err) {
      alert('Failed to remove holiday');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Settings className="w-7 h-7 text-indigo-400" /> Organization & Attendance Rule Engine Settings
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure company work schedules, shift rules, 8h/4h attendance windows, and official holidays
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Executive Governance Active</span>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-xs font-semibold flex items-center gap-2 shadow-lg">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* 2-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: SHIFT & ATTENDANCE RULE FORM (7 COLS) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
            <div className="border-b border-slate-800/80 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-400" /> Core Work Schedule & Shift Timing
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Parameters driving daily auto-attendance calculations</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* COMPANY NAME */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" /> Enterprise / Company Name
                </label>
                <input
                  type="text"
                  value={settings.company_name}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
                />
              </div>

              {/* TIMINGS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Office Start Time (HH:MM)</label>
                  <input
                    type="text"
                    value={settings.office_start_time}
                    onChange={(e) => setSettings({ ...settings, office_start_time: e.target.value })}
                    required
                    placeholder="09:00"
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Official morning reporting time</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Office End Time (HH:MM)</label>
                  <input
                    type="text"
                    value={settings.office_end_time}
                    onChange={(e) => setSettings({ ...settings, office_end_time: e.target.value })}
                    required
                    placeholder="18:00"
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Official evening checkout time</p>
                </div>
              </div>

              {/* THRESHOLDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Grace Period</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={settings.grace_period_minutes}
                      onChange={(e) => setSettings({ ...settings, grace_period_minutes: parseInt(e.target.value) || 0 })}
                      required
                      min="0"
                      max="60"
                      className="w-full p-2 bg-slate-900 border border-slate-700/80 rounded-lg text-xs text-white font-mono focus:outline-none font-bold"
                    />
                    <span className="text-[11px] text-slate-400 font-semibold">mins</span>
                  </div>
                  <p className="text-[9px] text-slate-500 mt-1">Leniency before LATE mark</p>
                </div>

                <div className="p-3.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                  <label className="block text-[11px] font-bold text-indigo-300 mb-1">Full-Day Shift</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      value={settings.required_working_hours}
                      onChange={(e) => setSettings({ ...settings, required_working_hours: parseFloat(e.target.value) || 0 })}
                      required
                      min="1"
                      max="16"
                      className="w-full p-2 bg-slate-900 border border-indigo-500/30 rounded-lg text-xs text-white font-mono focus:outline-none font-bold"
                    />
                    <span className="text-[11px] text-indigo-300 font-semibold">hrs</span>
                  </div>
                  <p className="text-[9px] text-indigo-400/80 mt-1">Strict 8.00h window</p>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <label className="block text-[11px] font-bold text-amber-300 mb-1">Half-Day Shift</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.5"
                      value={settings.half_day_threshold_hours}
                      onChange={(e) => setSettings({ ...settings, half_day_threshold_hours: parseFloat(e.target.value) || 0 })}
                      required
                      min="1"
                      max="8"
                      className="w-full p-2 bg-slate-900 border border-amber-500/30 rounded-lg text-xs text-white font-mono focus:outline-none font-bold"
                    />
                    <span className="text-[11px] text-amber-300 font-semibold">hrs</span>
                  </div>
                  <p className="text-[9px] text-amber-400/80 mt-1">Strict 4.00h window</p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition-all"
                >
                  <Save className="w-4 h-4" /> Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: EXECUTIVE POLICY & DEDUCTIONS RULES (5 COLS) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" /> Executive Governance Policies
            </h3>
            <p className="text-xs text-slate-400">Rules strictly enforced by the backend payroll engine</p>

            <div className="space-y-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold shrink-0 text-xs">
                  SL
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Sick Leave Allowance</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <strong>1 Day / Month</strong> allowed free. Any excess (&gt;1 day) incurs automatic salary deduction: <code className="text-emerald-400">Base Salary / 30</code>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0 text-xs">
                  CL
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Casual Leave Allowance</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <strong>1 Day / Month</strong> allowed free. Any excess (&gt;1 day) incurs automatic salary deduction: <code className="text-indigo-400">Base Salary / 30</code>.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold shrink-0 text-xs">
                  WFH
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Remote WFH Allowance</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    <strong>4 Days / Month</strong> allowed free. Excess days (&gt;4) are flagged for executive payroll review.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold shrink-0 text-xs">
                  HD
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Strict Office Working Window</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Full-day staff must complete <strong>8.0 hours</strong>. Half-day staff must maintain <strong>4.0 hours</strong> strictly in the office.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* OFFICIAL COMPANY HOLIDAYS TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" /> Official Organizational Holidays
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Official non-working days exempt from attendance marking and penalties</p>
          </div>

          <button
            onClick={() => setIsAddHolidayModal(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-3.5 h-3.5 text-brand-400" /> Add Official Holiday
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Holiday Name</th>
                <th className="p-3">Date</th>
                <th className="p-3">Description</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {holidays.length === 0 ? (
                <tr><td colSpan="4" className="p-6 text-center text-slate-500">No holidays added yet. Click &quot;Add Official Holiday&quot; to configure.</td></tr>
              ) : (
                holidays.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-semibold text-white flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>{h.title}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{h.date}</td>
                    <td className="p-3 text-slate-400">{h.description || 'Public Holiday'}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDeleteHoliday(h.id, h.title)}
                        className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-all"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD HOLIDAY MODAL */}
      <Modal isOpen={isAddHolidayModal} onClose={() => setIsAddHolidayModal(false)} title="Add Official Company Holiday">
        <form onSubmit={handleCreateHoliday} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Holiday Name</label>
            <input
              type="text"
              value={newHoliday.title}
              onChange={(e) => setNewHoliday({ ...newHoliday, title: e.target.value })}
              placeholder="e.g. Independence Day, New Year"
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Holiday Date</label>
            <input
              type="date"
              value={newHoliday.date}
              onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={newHoliday.description}
              onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
              placeholder="e.g. National Public Holiday"
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddHolidayModal(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg"
            >
              Save Holiday
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SettingsPage;

