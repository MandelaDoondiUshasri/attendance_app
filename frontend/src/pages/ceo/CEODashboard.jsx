import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Users, CalendarCheck, Home, FileText, Clock, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, Download, Plus, CheckCircle, XCircle,
  RefreshCw, Activity, ArrowUpRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import api, { API_V1_URL } from '../../services/api';
import Modal from '../../components/common/Modal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import ScreenTimeTrackerCard from '../../components/screentime/ScreenTimeTrackerCard';
import { useAppState } from '../../context/AppStateContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const CEODashboard = () => {
  const navigate = useNavigate();
  const { companyName } = useAuth();
  const { addToast } = useAppState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'ADD_EMP', 'SALARY', etc.

  // Salary modal state
  const [salaryForm, setSalaryForm] = useState({ employee_id: '', amount: '', reason: '', type: 'INCREMENT', date: new Date().toISOString().split('T')[0] });
  const [showSalaryConfirm, setShowSalaryConfirm] = useState(false);
  const [employeesList, setEmployeesList] = useState([]);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchDashboardData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get('/reports/analytics/');
      setData(res.data);
      const empRes = await api.get('/employees/');
      setEmployeesList(empRes.data.results || empRes.data || []);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleSalarySubmit = async () => {
    try {
      const endpoint = salaryForm.type === 'INCREMENT' ? '/salaries/increment/' : '/salaries/decrement/';
      await api.post(endpoint, {
        employee_id: parseInt(salaryForm.employee_id),
        amount: parseFloat(salaryForm.amount),
        reason: salaryForm.reason,
        effective_date: salaryForm.date,
        confirmed: true
      });
      addToast(`Salary ${salaryForm.type.toLowerCase()} processed successfully!`, 'success');
      setActionSuccess(`Salary ${salaryForm.type} processed successfully!`);
      setActiveModal(null);
      fetchDashboardData(true);
    } catch (err) {
      addToast(err.response?.data?.message || err.response?.data?.error || 'Salary modification failed.', 'error');
    }
  };

  const exportCSV = async (type) => {
    try {
      const response = await api.get(`/reports/export-${type}/`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `${type}_report_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      addToast(`${type.toUpperCase()} report exported successfully!`, 'success');
    } catch (err) {
      console.error('Failed to export report CSV:', err);
      addToast('Failed to download report. Please verify your permissions.', 'error');
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  return (
    <div className="space-y-8">
      {/* Top Welcome Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">{companyName || 'Enterprise'} Executive Analytics</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              REAL-TIME STREAM
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Live enterprise attendance, leave approvals, WFH queues, and financial governance</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors shadow"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Live Refresh'}</span>
          </button>

          <button
            onClick={() => setActiveModal('SALARY')}
            className="px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 flex items-center gap-2 transition-all"
          >
            <DollarSign className="w-4 h-4" /> Salary Adjustment
          </button>

          <button
            onClick={() => exportCSV('attendance')}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>


      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess('')} className="text-slate-400 hover:text-white"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      {/* TOP 11 KPI CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Total Employees</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-white">{kpis.total_employees}</p>
          <span className="text-[10px] text-emerald-400 font-bold mt-1 inline-block">Active Roster</span>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Present Today</span>
            <CalendarCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-400">{kpis.present_today}</p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">In Office</span>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">WFH Today</span>
            <Home className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-black text-indigo-400">{kpis.wfh_today}</p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">Approved Remote</span>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">On Leave Today</span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-purple-400">{kpis.leave_today}</p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">Approved Leave</span>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Absent Today</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-400">{kpis.absent_today}</p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">Unexcused</span>
        </div>

        <div className="glass-card p-4 rounded-2xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold">Late Arrivals</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-400">{kpis.late_today}</p>
          <span className="text-[10px] text-slate-400 mt-1 inline-block">Past Grace Period</span>
        </div>
      </div>

      {/* SECONDARY QUEUE CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div 
          onClick={() => navigate('/leaves')}
          className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-amber-500/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 group-hover:text-amber-400 transition-colors">Pending Leaves</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-amber-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-amber-400 mt-1">{kpis.pending_leaves}</p>
        </div>

        <div 
          onClick={() => navigate('/wfh')}
          className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 group-hover:text-indigo-400 transition-colors">Pending WFH</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-indigo-400 mt-1">{kpis.pending_wfh}</p>
        </div>

        <div 
          onClick={() => navigate('/attendance?tab=corrections')}
          className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-purple-500/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 group-hover:text-purple-400 transition-colors">Corrections</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-purple-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-purple-400 mt-1">{kpis.pending_corrections}</p>
        </div>

        <div 
          onClick={() => navigate('/salaries')}
          className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-emerald-500/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 group-hover:text-emerald-400 transition-colors">Increments</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-emerald-400 mt-1">{kpis.salary_increments}</p>
        </div>

        <div 
          onClick={() => navigate('/salaries')}
          className="glass-panel p-4 rounded-2xl border border-slate-800 hover:border-rose-500/50 cursor-pointer transition-all hover:-translate-y-0.5 group"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-400 group-hover:text-rose-400 transition-colors">Decrements</p>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-rose-400 transition-colors" />
          </div>
          <p className="text-xl font-bold text-rose-400 mt-1">{kpis.salary_decrements}</p>
        </div>
      </div>

      {/* 7 EXECUTIVE CHARTS SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Attendance Trend */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">1. 7-Day Attendance Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.attendance_trend || []}>
                <defs>
                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorWfh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Legend />
                <Area type="monotone" dataKey="present" stroke="#10b981" fillOpacity={1} fill="url(#colorPresent)" name="Present" />
                <Area type="monotone" dataKey="wfh" stroke="#6366f1" fillOpacity={1} fill="url(#colorWfh)" name="WFH" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. Office vs WFH */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">2. Office vs WFH Distribution</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.office_vs_wfh || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {(charts.office_vs_wfh || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Leave Distribution */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">3. Leave Distribution by Type</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.leave_distribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Approved Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Department Attendance */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">4. Department Attendance Rates</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.department_attendance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="department" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="present" fill="#10b981" radius={[6, 6, 0, 0]} name="Present" />
                <Bar dataKey="total" fill="#334155" radius={[6, 6, 0, 0]} name="Total Strength" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Late Arrival Trend */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">5. Late Arrival Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={charts.late_arrival_trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Area type="monotone" dataKey="late_count" stroke="#f59e0b" fill="#f59e0b20" name="Late Staff Count" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Salary Changes & 7. Monthly Attendance */}
        <div className="glass-panel p-6 rounded-2xl border border-slate-800">
          <h3 className="text-base font-bold text-white mb-4">6 & 7. Salary & Monthly Attendance Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthly_attendance || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} name="Monthly Cumulative Days" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* EMPLOYEE SCREEN TIME TRACKING */}
      <ScreenTimeTrackerCard />

      {/* SALARY ADJUSTMENT MODAL */}
      <Modal isOpen={activeModal === 'SALARY'} onClose={() => setActiveModal(null)} title="CEO Salary Adjustment Governance">
        <form onSubmit={(e) => { e.preventDefault(); setShowSalaryConfirm(true); }} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Employee</label>
            <select
              value={salaryForm.employee_id}
              onChange={(e) => setSalaryForm({ ...salaryForm, employee_id: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Choose Employee --</option>
              {employeesList.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.employee_id}) - Current: ₹{e.salary}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Adjustment Type</label>
              <select
                value={salaryForm.type}
                onChange={(e) => setSalaryForm({ ...salaryForm, type: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              >
                <option value="INCREMENT">Increment (+)</option>
                <option value="DECREMENT">Decrement (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Adjustment Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={salaryForm.amount}
                onChange={(e) => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                required
                placeholder="e.g. 15000"
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Governance Reason</label>
            <textarea
              value={salaryForm.reason}
              onChange={(e) => setSalaryForm({ ...salaryForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="Enter justification for performance merit increase or adjustment..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-500 rounded-xl shadow-lg"
            >
              Proceed to Confirmation
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION DIALOG */}
      <ConfirmationModal
        isOpen={showSalaryConfirm}
        onClose={() => setShowSalaryConfirm(false)}
        onConfirm={handleSalarySubmit}
        title={`Confirm Salary ${salaryForm.type}`}
        message={`Are you sure you want to apply a salary ${salaryForm.type} of ₹${salaryForm.amount} for the selected employee? This action will update current compensation and log an immutable record.`}
        confirmText={`Execute ${salaryForm.type}`}
      />
    </div>
  );
};

export default CEODashboard;
