import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, Filter, UserX, Shield, Edit3 } from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';

export const EmployeesPage = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [form, setForm] = useState({
    employee_id: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
    full_name: '',
    email: '',
    password: 'Password123!',
    role: 'EMPLOYEE',
    phone: '',
    department: '',
    designation: '',
    joining_date: new Date().toISOString().split('T')[0],
    work_mode: 'OFFICE',
    salary: '85000',
    is_half_day: false,
    biometric_id: `FP-${Math.floor(1000 + Math.random() * 9000)}`
  });

  const fetchEmployees = async () => {
    try {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees/', {
        ...form,
        department: form.department ? parseInt(form.department) : null,
        designation: form.designation ? parseInt(form.designation) : null,
      });
      alert('Employee profile created successfully.');
      setIsAddModalOpen(false);
      fetchEmployees();
    } catch (err) {
      const errorData = err.response?.data;
      let errorMsg = 'Creation failed';
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        } else {
          const fieldErrors = Object.entries(errorData)
            .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
          if (fieldErrors) {
            errorMsg = fieldErrors;
          }
        }
      }
      alert(errorMsg);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!window.confirm(`Are you sure you want to deactivate ${name}?`)) return;
    try {
      await api.post(`/employees/${id}/deactivate/`);
      fetchEmployees();
    } catch (err) {
      alert(err.response?.data?.message || 'Deactivation failed');
    }
  };

  const filteredEmployees = employees.filter(e =>
    e.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canManage = user?.role === 'CEO' || user?.role === 'HR';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Employee Directory</h1>
          <p className="text-xs text-slate-400 mt-1">Manage personnel records, departments, and work modes</p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add New Employee
          </button>
        )}
      </div>

      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by Employee ID, Name, or Email..."
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* EMPLOYEES TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Department</th>
                <th className="p-3">Designation</th>
                <th className="p-3">Work Mode</th>
                <th className="p-3">Joining Date</th>
                {user?.role === 'CEO' && <th className="p-3">Salary</th>}
                <th className="p-3">Status</th>
                {canManage && <th className="p-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredEmployees.length === 0 ? (
                <tr><td colSpan="8" className="p-6 text-center text-slate-500">No employee records found</td></tr>
              ) : (
                filteredEmployees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-900/40">
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
                    <td className="p-3 text-slate-300">{emp.department_name || 'Unassigned'}</td>
                    <td className="p-3 text-slate-300">{emp.designation_title || 'Unassigned'}</td>
                    <td className="p-3 text-indigo-400 font-semibold">{emp.work_mode}</td>
                    <td className="p-3 text-slate-400">{emp.joining_date}</td>
                    {user?.role === 'CEO' && <td className="p-3 font-mono text-emerald-400">₹{emp.salary}</td>}
                    <td className="p-3"><StatusBadge status={emp.employment_status} /></td>
                    {canManage && (
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {emp.employment_status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => handleDeactivate(emp.id, emp.full_name)}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold rounded-lg border border-rose-500/30 text-[11px] transition-all"
                              >
                                Deactivate
                              </button>
                            </>
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

      {/* ADD EMPLOYEE MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Employee Account">
        <form onSubmit={handleCreateEmployee} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Employee ID</label>
              <input
                type="text"
                value={form.employee_id}
                onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="HR">HR / ADMIN</option>
                <option value="ATTENDANCE_OPERATOR">OPERATOR</option>
                <option value="CEO">CEO</option>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Base Salary (₹)</label>
              <input
                type="number"
                value={form.salary}
                onChange={(e) => setForm({ ...form, salary: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
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
                <span className="text-xs font-semibold text-slate-300">Half Day Employee</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow-lg">Save Employee Account</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
