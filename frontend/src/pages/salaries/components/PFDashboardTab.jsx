import React, { useState, useEffect } from 'react';
import {
  Users, Shield, ShieldAlert, CheckCircle2, AlertOctagon,
  DollarSign, TrendingUp, RefreshCw, Filter, Search,
  Play, Sparkles, Sliders, ChevronRight, FileText,
  UserCheck, AlertTriangle, Building2, Eye, Download
} from 'lucide-react';
import api from '../../../services/api';
import EmployeePFProfileModal from './EmployeePFProfileModal';
import PFEligibilityModal from './PFEligibilityModal';

export const PFDashboardTab = ({
  selectedMonth,
  selectedYear,
  departments,
  addToast,
  isCEO,
  onOpenSalaryModal,
  onOpenRevisionHistory
}) => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedEmpForProfile, setSelectedEmpForProfile] = useState(null);
  const [simulatorModalOpen, setSimulatorModalOpen] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processModalOpen, setProcessModalOpen] = useState(false);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      let url = `/salaries/pf/dashboard/?year=${selectedYear}&month=${selectedMonth}`;
      if (selectedDept) url += `&department=${selectedDept}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await api.get(url);
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to load PF dashboard data:', err);
      addToast?.('Unable to load PF & Payroll dashboard records.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedMonth, selectedYear, selectedDept, selectedStatus]);

  const handleProcessPayroll = async () => {
    try {
      setProcessing(true);
      const payload = {
        year: selectedYear,
        month: selectedMonth
      };
      if (selectedDept) payload.department_id = selectedDept;

      const res = await api.post('/salaries/pf/process/', payload);
      addToast?.(res.data?.message || 'Monthly automated payroll calculation completed successfully!', 'success');
      setProcessModalOpen(false);
      fetchDashboard();
    } catch (err) {
      console.error('Payroll processing error:', err);
      addToast?.(err.response?.data?.error || 'Failed to process monthly automated payroll.', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const openProfileModal = (emp) => {
    setSelectedEmpForProfile({
      id: emp.employee_id,
      full_name: emp.full_name,
      employee_id: emp.employee_code,
      salary: emp.base_salary || emp.pf_wages || 0,
      joining_date: emp.joining_date
    });
    setProfileModalOpen(true);
  };

  const summary = dashboardData?.summary || {};
  const employees = dashboardData?.employees || [];

  return (
    <div className="space-y-6">
      {/* TOP HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-400" />
            EPFO Statutory PF & Monthly Payroll Dashboard
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time compliance under Gazette Notification S.O. 5109(E) (Revised ₹25,000 ceiling from 17-Sep-2026).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSimulatorModalOpen(true)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            EPFO Rules Simulator
          </button>

          <button
            onClick={() => setProcessModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/40 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Process Monthly Payroll
          </button>
        </div>
      </div>

      {/* STATUTORY SUMMARY KPI METRICS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Total Employees */}
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
            <span>Employees Tracked</span>
            <Users className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="text-xl font-black text-white">{summary.total_employees || 0}</div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-bold">{summary.eligible_employees || 0}</span> covered •{' '}
            <span className="text-rose-400 font-bold">{summary.excluded_employees || 0}</span> excluded
          </div>
        </div>

        {/* Employee PF Deductions (A/C 1) */}
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
            <span>Employee PF (12%)</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-xl font-black text-indigo-400">
            ₹{parseFloat(summary.total_employee_pf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Deducted from Take-Home (A/C 1)</div>
        </div>

        {/* Employer EPF Share (3.67%) */}
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
            <span>Employer EPF (3.67%)</span>
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400">
            ₹{parseFloat(summary.total_employer_epf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Employer EPF Share (A/C 1)</div>
        </div>

        {/* Employer EPS Share (8.33%) */}
        <div className="glass-panel p-3.5 rounded-xl border border-slate-800 bg-slate-900/40">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
            <span>Employer EPS (8.33%)</span>
            <Shield className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-black text-teal-400">
            ₹{parseFloat(summary.total_employer_eps || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Pension Fund Share (A/C 10)</div>
        </div>

        {/* Total Monthly PF Statutory Liability */}
        <div className="glass-panel p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-semibold text-emerald-400 mb-1 flex items-center justify-between">
            <span>Total PF Remittance</span>
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-white">
            ₹{parseFloat(summary.total_pf_liability || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-emerald-400/80 mt-1">
            Includes EDLI ₹{parseFloat(summary.total_employer_edli || 0).toFixed(0)} + Admin ₹
            {parseFloat(summary.total_admin_charges || 0).toFixed(0)}
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search employee or UAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchDashboard()}
              className="pl-8 pr-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500 w-48 sm:w-60"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
          >
            <option value="">All Coverage Statuses</option>
            <option value="eligible">PF Covered Only</option>
            <option value="excluded">Excluded Employees Only</option>
          </select>
        </div>

        <button
          onClick={fetchDashboard}
          title="Refresh table"
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors self-end sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* EMPLOYEE-WISE PF & PAYROLL TABLE */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-700/80">
              <th className="py-3 px-4">Employee</th>
              <th className="py-3 px-3">UAN & Coverage</th>
              <th className="py-3 px-3 text-right">Earned PF Wages</th>
              <th className="py-3 px-3 text-right">Employee PF (12%)</th>
              <th className="py-3 px-3 text-right">Employer EPF (3.67%)</th>
              <th className="py-3 px-3 text-right">EPS (8.33%)</th>
              <th className="py-3 px-3 text-right">Total Remittance</th>
              <th className="py-3 px-3 text-right">Net Take-Home</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
                  Loading PF records...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-slate-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No employee PF payroll records found for this period. Click "Process Monthly Payroll" to compute.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isExcluded = emp.exclusion_status;
                const isProcessed = emp.payroll_processed;

                return (
                  <tr
                    key={emp.employee_id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Employee Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        {emp.full_name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {emp.employee_code} • {emp.department}
                      </div>
                    </td>

                    {/* UAN & Status */}
                    <td className="py-3 px-3">
                      {emp.uan_number ? (
                        <div className="font-mono text-[11px] text-emerald-400 font-semibold">
                          {emp.uan_number}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">No UAN Registered</div>
                      )}
                      <div>
                        {isExcluded ? (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-semibold mt-0.5">
                            Excluded (Para 2(f))
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold mt-0.5">
                            EPF Active {emp.eps_member ? '+ EPS' : ''}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PF Wages */}
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-200">
                      ₹{parseFloat(emp.pf_wages || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Employee PF */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-indigo-400">
                      ₹{parseFloat(emp.employee_pf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Employer EPF */}
                    <td className="py-3 px-3 text-right font-mono text-cyan-400">
                      ₹{parseFloat(emp.employer_epf || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Employer EPS */}
                    <td className="py-3 px-3 text-right font-mono text-teal-400">
                      ₹{parseFloat(emp.employer_eps || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Total Remittance */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      ₹{parseFloat(emp.total_remittance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Net Take-Home */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                      ₹{parseFloat(emp.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openProfileModal(emp)}
                          title="Statutory EPF & Pension Profile"
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[10px] font-semibold border border-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          <Shield className="w-3 h-3 text-emerald-400" />
                          PF
                        </button>
                        <button
                          onClick={() => {
                            if (onOpenSalaryModal) {
                              onOpenSalaryModal({
                                id: emp.employee_id,
                                full_name: emp.full_name,
                                employee_id: emp.employee_code,
                                salary: emp.base_salary || emp.pf_wages,
                                designation: { title: emp.department || 'Staff' }
                              });
                            }
                          }}
                          title="Salary Structure & Compensation Profile"
                          className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 rounded-lg text-[10px] font-semibold border border-emerald-500/30 transition-colors inline-flex items-center gap-1"
                        >
                          <DollarSign className="w-3 h-3 text-emerald-400" />
                          Salary
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* PROCESS PAYROLL CONFIRMATION MODAL */}
      {processModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-emerald-400">
              <Play className="w-6 h-6 fill-current" />
              <h3 className="text-base font-bold text-white">Run Monthly Automated Payroll</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              This action will evaluate attendance, calculate earned wages, determine statutory PF
              wages under the revised ₹25,000 ceiling, compute 12% employee deduction, employer
              allocations (EPF 3.67%, EPS 8.33%, EDLI 0.50%, Admin 0.50%), deduct PT & TDS, and generate
              audit records for <span className="font-bold text-white">{selectedMonth}/{selectedYear}</span>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setProcessModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessPayroll}
                disabled={processing}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-900/40 flex items-center gap-2 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {processing ? 'Processing Payroll...' : 'Execute Calculation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PF PROFILE MODAL */}
      {profileModalOpen && (
        <EmployeePFProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          employee={selectedEmpForProfile}
          onSuccess={fetchDashboard}
          addToast={addToast}
        />
      )}

      {/* STATUTORY ELIGIBILITY SIMULATOR */}
      {simulatorModalOpen && (
        <PFEligibilityModal
          isOpen={simulatorModalOpen}
          onClose={() => setSimulatorModalOpen(false)}
          addToast={addToast}
        />
      )}
    </div>
  );
};

export default PFDashboardTab;

