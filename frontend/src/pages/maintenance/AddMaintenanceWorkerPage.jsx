import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, ArrowLeft, Wrench, ShieldCheck,
  CheckCircle2, Upload, AlertCircle, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

export const AddMaintenanceWorkerPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [workerDesgId, setWorkerDesgId] = useState(null);
  const [maintDept, setMaintDept] = useState({ id: null, name: 'Maintenance' });

  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    email: '',
    password: 'Password123!',
    mobile_number: '',
    gender: 'Male',
    joining_date: new Date().toISOString().split('T')[0],
    designation: '',
    department: 'Maintenance',
    shift: 'Morning',
    emergency_contact: '',
    employment_status: 'ACTIVE'
  });

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [deptRes, desgRes] = await Promise.all([
          api.get('/employees/departments/'),
          api.get('/employees/designations/')
        ]);

        const depts = deptRes.data.results || deptRes.data || [];
        const mDept = depts.find(d => d.code === 'MAINTENANCE' || d.code === 'MAINT' || d.name?.toLowerCase() === 'maintenance');
        if (mDept) {
          setMaintDept(mDept);
        }

        const desgs = desgRes.data.results || desgRes.data || [];
        // Look specifically for Worker or Maintenance Worker designation
        const wDesg = desgs.find(d => 
          (d.title?.toLowerCase() === 'worker' || d.title?.toLowerCase() === 'maintenance worker') &&
          (!mDept || d.department === mDept.id)
        ) || desgs.find(d => d.title?.toLowerCase() === 'worker' || d.title?.toLowerCase() === 'maintenance worker');

        if (wDesg) {
          setWorkerDesgId(wDesg.id);
          setFormData(prev => ({ ...prev, designation: wDesg.id }));
        }
      } catch (err) {
        console.error('Failed to load department metadata:', err);
      }
    };

    fetchMetadata();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      // Auto-generate email if worker ID changes and email is not explicitly touched
      if (name === 'employee_id' && (!prev.email || prev.email.endsWith('@frg.com'))) {
        const cleanId = value.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanId) {
          updated.email = `${cleanId}.maint@frg.com`;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id || !formData.full_name) {
      addToast('Worker ID and Full Name are required.', 'error');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        employee_id: formData.employee_id.trim(),
        full_name: formData.full_name.trim(),
        email: formData.email.trim() || `${formData.employee_id.toLowerCase().trim()}.maint@frg.com`,
        password: formData.password || 'Password123!',
        phone: formData.mobile_number.trim(),
        gender: formData.gender,
        joining_date: formData.joining_date,
        designation: formData.designation || null,
        shift: formData.shift,
        emergency_contact: formData.emergency_contact,
        employment_status: formData.employment_status,
        work_mode: 'OFFICE'
      };

      await api.post('/maintenance/workers/', payload);
      addToast(`Maintenance worker ${formData.full_name} added successfully!`, 'success');
      navigate('/maintenance/workers');
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.detail || JSON.stringify(err.response?.data) || 'Failed to add worker.';
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
        <button
          onClick={() => navigate('/maintenance/workers')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Maintenance Workers
        </button>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25">
          <Wrench className="w-3.5 h-3.5" />
          MAINTENANCE WORKFORCE ONBOARDING
        </span>
      </div>

      {/* Main Form Container */}
      <div className="rounded-3xl bg-[#0B0F19] border border-white/[0.08] shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Glow */}
        <div className="pointer-events-none absolute -top-24 -left-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-20 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl" />

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <UserPlus className="w-6 h-6 text-cyan-400" />
            Add Maintenance Worker
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Create a new maintenance worker profile locked to the Maintenance Department.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Identification */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Worker Identification
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Worker ID <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="employee_id"
                  required
                  placeholder="e.g. M006 or MAINT-006"
                  value={formData.employee_id}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Mobile Number <span className="text-rose-400">*</span>
                </label>
                <input
                  type="tel"
                  name="mobile_number"
                  required
                  placeholder="e.g. 9876543210"
                  value={formData.mobile_number}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  placeholder="auto-generated or custom"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Department & Role (Strictly Locked) */}
          <div className="space-y-4 pt-4 border-t border-white/[0.06]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              Department & Shift Assignment
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Department (LOCKED) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Department (Locked)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value="Maintenance"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-bold cursor-not-allowed select-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                    FIXED
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Supervisor cannot assign to other departments.</p>
              </div>

              {/* Designation (LOCKED) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Designation (Locked)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value="Worker"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-cyan-300 font-bold cursor-not-allowed select-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                    FIXED
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Designation locked to Worker for field workforce.</p>
              </div>

              {/* Shift */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Shift <span className="text-rose-400">*</span>
                </label>
                <select
                  name="shift"
                  value={formData.shift}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Morning">Morning Shift</option>
                  <option value="Evening">Evening Shift</option>
                  <option value="Night">Night Shift</option>
                  <option value="General">General Shift</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Additional Details */}
          <div className="space-y-4 pt-4 border-t border-white/[0.06]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              Additional Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Date of Joining</label>
                <input
                  type="date"
                  name="joining_date"
                  value={formData.joining_date}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Employment Status</label>
                <select
                  name="employment_status"
                  value={formData.employment_status}
                  onChange={handleChange}
                  className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Emergency Contact</label>
              <input
                type="text"
                name="emergency_contact"
                placeholder="Contact Name & Emergency Phone Number"
                value={formData.emergency_contact}
                onChange={handleChange}
                className="w-full bg-slate-900 border border-slate-700/70 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/[0.08]">
            <button
              type="button"
              onClick={() => navigate('/maintenance/workers')}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-brand-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Creating Worker...' : 'Create Maintenance Worker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMaintenanceWorkerPage;
