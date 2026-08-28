import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, Filter, UserX, Shield, Edit3, Building, Trash2, UserCheck } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import EmptyState from '../../components/common/states/EmptyState';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import NoSearchResults from '../../components/common/states/NoSearchResults';
import FormError from '../../components/common/states/FormError';
import { useAppState } from '../../context/AppStateContext';


export const EmployeesPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [activeDeptTab, setActiveDeptTab] = useState('departments');
  const [newDept, setNewDept] = useState({ name: '', code: '', description: '' });
  const [newDesignation, setNewDesignation] = useState({ title: '', department: '', description: '' });

  const [form, setForm] = useState({
    employee_id: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    full_name: '',
    email: '',
    password: 'Password123!',
    role: 'EMPLOYEE',
    phone: '',
    dob: '',
    emergency_contact: '',
    address: '',
    department: '',
    designation: '',
    joining_date: new Date().toISOString().split('T')[0],
    work_mode: 'OFFICE',
    salary: '85000',
    is_half_day: false
  });

  const [editForm, setEditForm] = useState({
    id: null,
    employee_id: '',
    full_name: '',
    email: '',
    role: 'EMPLOYEE',
    phone: '',
    dob: '',
    emergency_contact: '',
    address: '',
    department: '',
    designation: '',
    joining_date: '',
    work_mode: 'OFFICE',
    salary: '0',
    is_half_day: false,
    employment_status: 'ACTIVE'
  });

  const fetchEmployees = async () => {
    try {
      setError(null);
      const [empRes, deptRes, desgRes] = await Promise.all([
        api.get('/employees/'),
        api.get('/employees/departments/'),
        api.get('/employees/designations/')
      ]);
      setEmployees(empRes.data.results || empRes.data || []);
      setDepartments(deptRes.data.results || deptRes.data || []);
      setDesignations(desgRes.data.results || desgRes.data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleOpenEdit = (emp) => {
    setEditForm({
      id: emp.id,
      employee_id: emp.employee_id || '',
      full_name: emp.full_name || '',
      email: emp.email || '',
      role: emp.role || 'EMPLOYEE',
      phone: emp.phone || '',
      dob: emp.dob || '',
      emergency_contact: emp.emergency_contact || '',
      address: emp.address || '',
      department: emp.department ? String(emp.department) : '',
      designation: emp.designation ? String(emp.designation) : '',
      joining_date: emp.joining_date || '',
      work_mode: emp.work_mode || 'OFFICE',
      salary: emp.salary ? String(emp.salary) : '0',
      is_half_day: Boolean(emp.is_half_day),
      employment_status: emp.employment_status || 'ACTIVE'
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        full_name: editForm.full_name.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        user: {
          role: editForm.role
        },
        phone: editForm.phone?.trim() || null,
        dob: editForm.dob || null,
        emergency_contact: editForm.emergency_contact?.trim() || null,
        address: editForm.address?.trim() || null,
        department: editForm.department ? parseInt(editForm.department) : null,
        designation: editForm.designation ? parseInt(editForm.designation) : null,
        joining_date: editForm.joining_date || null,
        work_mode: editForm.work_mode,
        salary: parseFloat(editForm.salary) || 0,
        is_half_day: Boolean(editForm.is_half_day),
        employment_status: editForm.employment_status
      };

      await api.patch(`/employees/${editForm.id}/`, payload);
      addToast('Employee profile updated successfully!', 'success');
      setIsEditModalOpen(false);
      fetchEmployees();
    } catch (err) {
      console.error("Employee update error:", err.response?.data);
      const data = err.response?.data;
      let errorMsg = 'Update failed. Please verify the entered details.';
      if (data) {
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.errors && typeof data.errors === 'object') {
          const detailStrings = Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          if (detailStrings.length > 0) errorMsg = detailStrings.join('\n');
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else if (typeof data === 'object') {
          const detailStrings = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          if (detailStrings.length > 0) errorMsg = detailStrings.join('\n');
        }
      }
      addToast(errorMsg, 'error');
    }
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        employee_id: form.employee_id.trim(),
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.role,
        work_mode: form.work_mode,
        phone: form.phone?.trim() || null,
        dob: form.dob || null,
        emergency_contact: form.emergency_contact?.trim() || null,
        address: form.address?.trim() || null,
        department: form.department ? parseInt(form.department) : null,
        designation: form.designation ? parseInt(form.designation) : null,
        joining_date: form.joining_date || new Date().toISOString().split('T')[0],
        salary: parseFloat(form.salary) || 0,
        is_half_day: Boolean(form.is_half_day)
      };

      await api.post('/employees/', payload);
      addToast('Employee profile registered successfully!', 'success');
      setIsAddModalOpen(false);
      setForm({
        employee_id: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
        full_name: '',
        email: '',
        password: 'Password123!',
        role: 'EMPLOYEE',
        phone: '',
        dob: '',
        emergency_contact: '',
        address: '',
        department: '',
        designation: '',
        joining_date: new Date().toISOString().split('T')[0],
        work_mode: 'OFFICE',
        salary: '85000',
        is_half_day: false
      });
      fetchEmployees();
    } catch (err) {
      console.error("Employee registration error:", err.response?.data);
      const data = err.response?.data;
      let errorMsg = 'Registration failed. Please check the entered information.';
      if (data) {
        if (typeof data === 'string') {
          errorMsg = data;
        } else if (data.errors && typeof data.errors === 'object') {
          const detailStrings = Object.entries(data.errors).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          if (detailStrings.length > 0) {
            errorMsg = detailStrings.join('\n');
          } else if (data.message) {
            errorMsg = data.message;
          }
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.message) {
          errorMsg = data.message;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (typeof data === 'object') {
          const detailStrings = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          if (detailStrings.length > 0) errorMsg = detailStrings.join('\n');
        }
      }
      addToast(errorMsg, 'error');
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;
    try {
      await api.post(`/employees/${id}/deactivate/`);
      addToast(`Employee ${name} deactivated successfully.`, 'success');
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.message || 'Deactivation failed', 'error');
    }
  };

  const handleActivate = async (id, name) => {
    if (!window.confirm(`Are you sure you want to reactivate ${name}?`)) return;
    try {
      await api.post(`/employees/${id}/activate/`);
      addToast(`Employee ${name} reactivated successfully!`, 'success');
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.message || 'Activation failed', 'error');
    }
  };

  const handleCreateDept = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees/departments/', newDept);
      addToast('Department created successfully!', 'success');
      setNewDept({ name: '', code: '', description: '' });
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || err.response?.data?.message || 'Failed to create department', 'error');
    }
  };

  const handleDeleteDept = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete the "${name}" department? Any assigned employees will become unassigned.`)) return;
    try {
      await api.delete(`/employees/departments/${id}/`);
      addToast(`Department "${name}" deleted successfully.`, 'success');
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete department', 'error');
    }
  };

  const handleCreateDesignation = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees/designations/', newDesignation);
      addToast('Designation created successfully!', 'success');
      setNewDesignation({ title: '', department: '', description: '' });
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.message || err.response?.data?.title?.[0] || 'Failed to create designation', 'error');
    }
  };

  const handleDeleteDesignation = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete the "${title}" designation? Any assigned employees will become unassigned.`)) return;
    try {
      await api.delete(`/employees/designations/${id}/`);
      addToast(`Designation "${title}" deleted successfully.`, 'success');
      fetchEmployees();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete designation', 'error');
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.phone && e.phone.includes(searchTerm))
  );

  const canManage = (['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR';

  if (loading) return <LoadingState type="full" text="Loading directory..." />;
  if (error) return <ErrorState message={error} onRetry={fetchEmployees} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Employee Directory & Personnel Records</h1>
          <p className="text-xs text-slate-400 mt-1">Manage personnel records, departments, DOB, contact details, and work modes</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsDeptModalOpen(true)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all shadow-md"
            >
              <Building className="w-4 h-4 text-brand-400" /> Manage Departments
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add New Employee
            </button>
          </div>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Employee ID, Name, Email, or Phone Number..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* EMPLOYEES TABLE */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Contact & DOB</th>
                <th className="p-3">Department & Role</th>
                <th className="p-3">Work Mode</th>
                <th className="p-3">Joining Date</th>
                {(['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) && <th className="p-3">Salary</th>}
                <th className="p-3">Status</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-0">
                    {searchTerm ? (
                      <NoSearchResults searchTerm={searchTerm} onClear={() => setSearchTerm('')} />
                    ) : (
                      <EmptyState title="No Employees Found" description="Get started by adding your first employee." icon={Users} />
                    )}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      <div>{emp.full_name}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-400 font-mono">{emp.employee_id}</span>
                        {emp.is_half_day && (
                          <>
                            <span className="text-[10px] text-slate-600">•</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-md uppercase tracking-wider">Half Day</span>
                          </>
                        )}
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-400">{emp.email}</span>
                      </div>
                    </td>
                    <td className="p-3 text-slate-300">
                      <div className="font-mono text-slate-200">{emp.phone || 'No phone registered'}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {emp.dob ? `DOB: ${emp.dob}` : 'DOB not set'}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="text-white font-medium">{emp.department_name || 'Unassigned'}</div>
                      <div className="text-[10px] text-slate-400">{emp.designation_title || 'General Staff'}</div>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {emp.work_mode}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{emp.joining_date}</td>
                    {(['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) && (
                      <td className="p-3 font-mono font-bold text-emerald-400">
                        ₹{parseFloat(emp.salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="p-3"><StatusBadge status={emp.employment_status} /></td>
                    {canManage && (
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 text-[11px] transition-all flex items-center gap-1"
                            title="Edit Employee Information"
                          >
                            <Edit3 className="w-3 h-3 text-brand-400" /> Edit
                          </button>

                          {emp.employment_status === 'ACTIVE' ? (
                            <button
                              onClick={() => handleDeactivate(emp.id, emp.full_name)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] transition-all"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(emp.id, emp.full_name)}
                              className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold rounded-lg border border-emerald-500/30 text-[11px] transition-all flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" /> Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER EMPLOYEE MODAL (ALL ESSENTIAL DETAILS) */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Employee Account">
        <form onSubmit={handleCreateEmployee} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* SECTION 1: IDENTITY */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">1. Account & Identity</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={form.employee_id}
                  onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@company.com"
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password (Min. 8 chars)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                  placeholder="••••••••"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: PERSONAL & CONTACT */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2. Personal & Contact Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth (DOB)</label>
                <input
                  type="date"
                  value={form.dob}
                  onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Emergency Contact (Optional)</label>
                <input
                  type="text"
                  value={form.emergency_contact}
                  onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
                  placeholder="e.g. Family Contact +91..."
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Residential Address (Optional)</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Street address, City, State, PIN"
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* SECTION 3: EMPLOYMENT & COMPENSATION */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">3. Employment & Compensation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="HR">HR / ADMIN</option>
                  <option value="CEO">CEO</option>
                  {user?.role === 'SYSTEM_ADMIN' && <option value="SYSTEM_ADMIN">SYSTEM ADMIN</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Work Mode</label>
                <select
                  value={form.work_mode}
                  onChange={(e) => setForm({ ...form, work_mode: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="OFFICE">OFFICE</option>
                  <option value="WFH">WFH</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                <select
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Choose Dept --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                <select
                  value={form.designation}
                  onChange={(e) => setForm({ ...form, designation: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Choose Designation --</option>
                  {designations
                    .filter(d => !form.department || d.department === parseInt(form.department))
                    .map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={form.joining_date}
                  onChange={(e) => setForm({ ...form, joining_date: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Base Salary (₹)</label>
                <input
                  type="number"
                  value={form.salary}
                  onChange={(e) => setForm({ ...form, salary: e.target.value })}
                  required
                  min="0"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={form.is_half_day}
                    onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-slate-300">Half Day Employee (4h shift)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg"
            >
              Register Employee Profile
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT EMPLOYEE MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Employee Profile: ${editForm.full_name} (${editForm.employee_id})`}
      >
        <form onSubmit={handleUpdateEmployee} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {/* SECTION 1: IDENTITY */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-brand-400 uppercase tracking-wider">1. Account & Identity</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Employee ID</label>
                <input
                  type="text"
                  value={editForm.employee_id}
                  disabled
                  className="w-full p-2.5 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  required
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Corporate Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* SECTION 2: PERSONAL & CONTACT */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">2. Personal & Contact Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth (DOB)</label>
                <input
                  type="date"
                  value={editForm.dob}
                  onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Emergency Contact</label>
                <input
                  type="text"
                  value={editForm.emergency_contact}
                  onChange={(e) => setEditForm({ ...editForm, emergency_contact: e.target.value })}
                  placeholder="e.g. Family Contact +91..."
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Residential Address</label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Street address, City, State, PIN"
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* SECTION 3: EMPLOYMENT & COMPENSATION */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">3. Employment & Compensation</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
                >
                  <option value="EMPLOYEE">EMPLOYEE</option>
                  <option value="HR">HR / ADMIN</option>
                  <option value="CEO">CEO</option>
                  {user?.role === 'SYSTEM_ADMIN' && <option value="SYSTEM_ADMIN">SYSTEM ADMIN</option>}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Work Mode</label>
                <select
                  value={editForm.work_mode}
                  onChange={(e) => setEditForm({ ...editForm, work_mode: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="OFFICE">OFFICE</option>
                  <option value="WFH">WFH</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Choose Dept --</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
                <select
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">-- Choose Designation --</option>
                  {designations
                    .filter(d => !editForm.department || d.department === parseInt(editForm.department))
                    .map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Joining Date</label>
                <input
                  type="date"
                  value={editForm.joining_date}
                  onChange={(e) => setEditForm({ ...editForm, joining_date: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Base Salary (₹)</label>
                <input
                  type="number"
                  value={editForm.salary}
                  onChange={(e) => setEditForm({ ...editForm, salary: e.target.value })}
                  required
                  min="0"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
                />
              </div>
              <div className="flex items-center mt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editForm.is_half_day}
                    onChange={(e) => setEditForm({ ...editForm, is_half_day: e.target.checked })}
                    className="w-4 h-4 rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-brand-500"
                  />
                  <span className="text-xs font-semibold text-slate-300">Half Day Employee (4h shift)</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* MANAGE DEPARTMENTS & DESIGNATIONS MODAL */}
      <Modal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} title="Department & Designation Governance">
        <div className="flex border-b border-slate-800 mb-4">
          <button
            onClick={() => setActiveDeptTab('departments')}
            className={`px-4 py-2 text-xs font-bold ${activeDeptTab === 'departments' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-white'}`}
          >
            Departments
          </button>
          <button
            onClick={() => setActiveDeptTab('designations')}
            className={`px-4 py-2 text-xs font-bold ${activeDeptTab === 'designations' ? 'text-brand-400 border-b-2 border-brand-500' : 'text-slate-400 hover:text-white'}`}
          >
            Designations
          </button>
        </div>

        <div className="space-y-6">
          {activeDeptTab === 'departments' ? (
            <>
              {/* Create New Dept Form */}
              <form onSubmit={handleCreateDept} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Add New Department</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Department Name</label>
                    <input
                      type="text"
                      value={newDept.name}
                      onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                      placeholder="e.g. Artificial Intelligence"
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Code (Short)</label>
                    <input
                      type="text"
                      value={newDept.code}
                      onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                      placeholder="e.g. AI"
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={newDept.description}
                    onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
                    placeholder="Department core responsibility and scope..."
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Department
                  </button>
                </div>
              </form>

              {/* Existing Depts List */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <span>Existing Organizational Departments</span>
                  <span className="text-[10px] text-slate-500 font-mono">{departments.length} total</span>
                </h4>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {departments.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">No departments created yet.</p>
                  ) : (
                    departments.map((dept) => (
                      <div key={dept.id} className="p-3.5 bg-slate-900/40 hover:bg-slate-900/80 flex items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{dept.name}</span>
                            <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 text-brand-300 border border-slate-700 rounded">{dept.code}</span>
                          </div>
                          {dept.description && <p className="text-[11px] text-slate-400 mt-0.5">{dept.description}</p>}
                        </div>
                        {canManage && (
                          <button
                            onClick={() => handleDeleteDept(dept.id, dept.name)}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                            title="Delete Department"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Create New Designation Form */}
              <form onSubmit={handleCreateDesignation} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Add New Designation</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Designation Title</label>
                    <input
                      type="text"
                      value={newDesignation.title}
                      onChange={(e) => setNewDesignation({ ...newDesignation, title: e.target.value })}
                      placeholder="e.g. Senior Backend Engineer"
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Department</label>
                    <select
                      value={newDesignation.department}
                      onChange={(e) => setNewDesignation({ ...newDesignation, department: e.target.value })}
                      required
                      className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                    >
                      <option value="">Select Department...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={newDesignation.description}
                    onChange={(e) => setNewDesignation({ ...newDesignation, description: e.target.value })}
                    placeholder="Role responsibilities..."
                    className="w-full p-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-md flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Designation
                  </button>
                </div>
              </form>

              {/* Existing Designations List */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center justify-between">
                  <span>Existing Organizational Designations</span>
                  <span className="text-[10px] text-slate-500 font-mono">{designations.length} total</span>
                </h4>
                <div className="divide-y divide-slate-800/80 border border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {designations.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">No designations created yet.</p>
                  ) : (
                    designations.map((desg) => {
                      const dept = departments.find(d => d.id === desg.department);
                      return (
                        <div key={desg.id} className="p-3.5 bg-slate-900/40 hover:bg-slate-900/80 flex items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{desg.title}</span>
                              {dept && (
                                <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-slate-800 text-brand-300 border border-slate-700 rounded">
                                  {dept.code}
                                </span>
                              )}
                            </div>
                            {desg.description && <p className="text-[11px] text-slate-400 mt-0.5">{desg.description}</p>}
                          </div>
                          {canManage && (
                            <button
                              onClick={() => handleDeleteDesignation(desg.id, desg.title)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0"
                              title="Delete Designation"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
