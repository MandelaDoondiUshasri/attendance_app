import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, Filter, UserX, Shield, Edit3, Camera, Fingerprint, RefreshCw, CheckCircle2 } from 'lucide-react';
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
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [enrollType, setEnrollType] = useState('FINGERPRINT'); // 'FINGERPRINT' | 'FACE'
  const [enrollScanning, setEnrollScanning] = useState(false);
  const [enrollProgress, setEnrollProgress] = useState(0);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [enrollError, setEnrollError] = useState('');

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

  const handleOpenEnrollModal = (emp) => {
    setSelectedEmployee(emp);
    setEnrollType('FINGERPRINT');
    setEnrollScanning(false);
    setEnrollProgress(0);
    setEnrollSuccess(false);
    setEnrollError('');
    setIsEnrollModalOpen(true);
  };

  const handleEnrollBiometric = async () => {
    setEnrollScanning(true);
    setEnrollError('');
    setEnrollProgress(0);

    // Simulate scanning animation progress
    const interval = setInterval(() => {
      setEnrollProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    // Wait for the scan to finish
    await new Promise(resolve => setTimeout(resolve, 1800));

    try {
      if (enrollType === 'FINGERPRINT') {
        const fpSeed = `FP-TEMPLATE-${selectedEmployee.employee_id}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
        await api.post('/biometrics/enroll-fingerprint/', {
          employee_id: selectedEmployee.employee_id,
          fingerprint_data: fpSeed
        });
      } else {
        const faceSeed = `FACE-EMBEDDING-${selectedEmployee.employee_id}-${Math.random().toString(36).substring(2, 11).toUpperCase()}`;
        await api.post('/biometrics/enroll-face/', {
          employee_id: selectedEmployee.employee_id,
          image_data: faceSeed
        });
      }
      setEnrollSuccess(true);
      fetchEmployees();
    } catch (err) {
      setEnrollError(err.response?.data?.error || err.response?.data?.message || 'Enrollment failed');
    } finally {
      setEnrollScanning(false);
    }
  };

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
      alert(err.response?.data?.message || err.response?.data?.email?.[0] || 'Creation failed');
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
          <p className="text-xs text-slate-400 mt-1">Manage personnel records, departments, work modes, and biometric credentials</p>
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
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-400">{emp.email}</span>
                        {emp.face_profile_enrolled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-bold rounded-md">
                            <Camera className="w-2.5 h-2.5" /> Face
                          </span>
                        )}
                        {emp.fingerprint_enrolled && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-bold rounded-md">
                            <Fingerprint className="w-2.5 h-2.5" /> Fingerprint
                          </span>
                        )}
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
                                onClick={() => handleOpenEnrollModal(emp)}
                                className="px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 font-bold rounded-lg border border-indigo-500/30 text-[11px] flex items-center gap-1 transition-all"
                              >
                                <Fingerprint className="w-3 h-3" /> Enroll Biometrics
                              </button>
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">Biometric ID</label>
              <input
                type="text"
                value={form.biometric_id}
                onChange={(e) => setForm({ ...form, biometric_id: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
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
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow-lg">Save Employee Account</button>
          </div>
        </form>
      </Modal>

      {/* BIOMETRIC ENROLLMENT MODAL */}
      <Modal isOpen={isEnrollModalOpen} onClose={() => { if (!enrollScanning) setIsEnrollModalOpen(false); }} title={`Enroll Biometrics for ${selectedEmployee?.full_name}`}>
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex rounded-xl p-1 bg-slate-900 border border-slate-800">
            <button
              type="button"
              disabled={enrollScanning}
              onClick={() => { setEnrollType('FINGERPRINT'); setEnrollSuccess(false); setEnrollError(''); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                enrollType === 'FINGERPRINT'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white disabled:opacity-50'
              }`}
            >
              <Fingerprint className="w-3.5 h-3.5" />
              Fingerprint
            </button>
            <button
              type="button"
              disabled={enrollScanning}
              onClick={() => { setEnrollType('FACE'); setEnrollSuccess(false); setEnrollError(''); }}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                enrollType === 'FACE'
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white disabled:opacity-50'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              Face ID
            </button>
          </div>

          {/* Scanner view */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[220px]">
            {enrollScanning ? (
              <div className="space-y-4 w-full">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin absolute" />
                  <span className="text-[10px] font-black text-white">{enrollProgress}%</span>
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-300">
                    {enrollType === 'FINGERPRINT' ? 'Scanning Fingerprint Pattern...' : 'Analyzing Face Structure & Liveness...'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">Please keep contact with the sensor grid</p>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-slate-900 rounded-full h-1.5 max-w-xs mx-auto overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-150 ${enrollType === 'FINGERPRINT' ? 'bg-indigo-500' : 'bg-brand-500'}`}
                    style={{ width: `${enrollProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : enrollSuccess ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">Enrollment Completed</h3>
                <p className="text-[11px] text-slate-400">
                  {enrollType === 'FINGERPRINT' 
                    ? 'Fingerprint template generated and securely mapped to profile.' 
                    : 'Facial recognition hash and liveness factors successfully enrolled.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto border transition-all ${
                  enrollType === 'FINGERPRINT' 
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:scale-105' 
                    : 'bg-brand-500/10 border-brand-500/30 text-brand-400 hover:scale-105'
                }`}>
                  {enrollType === 'FINGERPRINT' ? <Fingerprint className="w-8 h-8" /> : <Camera className="w-8 h-8" />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-300">
                    {enrollType === 'FINGERPRINT' ? 'Fingerprint Biometric Scanner' : 'Face Biometric Capture'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs mx-auto">
                    {enrollType === 'FINGERPRINT'
                      ? 'Press and hold to enroll fingerprint. Requires a simulated capture scan.'
                      : 'Initialize high-fidelity facial geometry scan for employee.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleEnrollBiometric}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all ${
                    enrollType === 'FINGERPRINT' 
                      ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 animate-pulse' 
                      : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/20 animate-pulse'
                  }`}
                >
                  {enrollType === 'FINGERPRINT' ? 'START FINGER SCAN' : 'START CAMERA CAPTURE'}
                </button>
              </div>
            )}

            {enrollError && (
              <div className="mt-3 p-2 bg-rose-500/10 border border-rose-500/35 text-rose-400 text-[10px] rounded-lg">
                {enrollError}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button 
              type="button" 
              disabled={enrollScanning}
              onClick={() => setIsEnrollModalOpen(false)} 
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl disabled:opacity-50"
            >
              {enrollSuccess ? 'Done' : 'Cancel'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
