import React, { useState, useEffect } from 'react';
import { Settings, Save, Calendar, Clock } from 'lucide-react';
import api from '../../services/api';

export const SettingsPage = () => {
  const [settings, setSettings] = useState({
    company_name: '',
    office_start_time: '09:00',
    office_end_time: '18:00',
    grace_period_minutes: 15,
    required_working_hours: 8.0,
    half_day_threshold_hours: 4.0
  });

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchSettingsData = async () => {
    try {
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
      setSaveSuccess('Organization settings updated successfully!');
      setTimeout(() => setSaveSuccess(''), 4000);
    } catch (err) {
      alert(err.response?.data?.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Organization & Attendance Rule Engine Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Configure company work schedules, grace periods, half-day thresholds, and official holidays</p>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold">
          {saveSuccess}
        </div>
      )}

      {/* SETTINGS FORM */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Company Name</label>
            <input
              type="text"
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Office Start Time (HH:MM)</label>
              <input
                type="text"
                value={settings.office_start_time}
                onChange={(e) => setSettings({ ...settings, office_start_time: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Office End Time (HH:MM)</label>
              <input
                type="text"
                value={settings.office_end_time}
                onChange={(e) => setSettings({ ...settings, office_end_time: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Grace Period (Minutes)</label>
              <input
                type="number"
                value={settings.grace_period_minutes}
                onChange={(e) => setSettings({ ...settings, grace_period_minutes: parseInt(e.target.value) })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Required Working Hours</label>
              <input
                type="number"
                step="0.5"
                value={settings.required_working_hours}
                onChange={(e) => setSettings({ ...settings, required_working_hours: parseFloat(e.target.value) })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Half-Day Threshold (Hours)</label>
              <input
                type="number"
                step="0.5"
                value={settings.half_day_threshold_hours}
                onChange={(e) => setSettings({ ...settings, half_day_threshold_hours: parseFloat(e.target.value) })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              type="submit"
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Configuration
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
