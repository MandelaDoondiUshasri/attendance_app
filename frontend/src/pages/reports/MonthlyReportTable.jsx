import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, Monitor, DollarSign, Download, FileSpreadsheet, 
  Printer, Search, Filter, ChevronLeft, ChevronRight, CheckCircle2, 
  AlertTriangle, Eye, ArrowUpDown, RefreshCw, AlertCircle, Building2, User
} from 'lucide-react';
import api from '../../services/api';
import EmployeeMonthlyDetailModal from './EmployeeMonthlyDetailModal';

export const MonthlyReportTable = () => {
  const currentDate = new Date();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);
  const [error, setError] = useState(null);

  const [reportData, setReportData] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState('employee_id');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'

  // Fetch departments list
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await api.get('/employees/departments/');
        const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setDepartments(data);
      } catch (err) {
        // Non-blocking fallback
      }
    };
    fetchDepartments();
  }, []);

  // Fetch Monthly Report Data
  const fetchMonthlyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/reports/monthly-report/?year=${year}&month=${month}`;
      if (department) url += `&department=${department}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const res = await api.get(url);
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load monthly report:', err);
      setError(err.response?.data?.error || 'Failed to generate monthly report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [year, month, department]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMonthlyReport();
  };

  // Month navigation
  const prevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(prev => prev - 1);
    } else {
      setMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(prev => prev + 1);
    } else {
      setMonth(prev => prev + 1);
    }
  };

  // Sorting handler
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sorted employee list
  const sortedEmployees = useMemo(() => {
    if (!reportData?.employees) return [];
    const list = [...reportData.employees];

    return list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      aVal = aVal ?? 0;
      bVal = bVal ?? 0;
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [reportData?.employees, sortField, sortDirection]);

  // Open detailed employee modal
  const openEmployeeDetail = async (emp) => {
    setSelectedEmployee(emp);
    setDetailModalOpen(true);
  };

  // Download Excel Report
  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      let url = `/reports/export-monthly-excel/?year=${year}&month=${month}`;
      if (department) url += `&department=${department}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `monthly_report_${reportData?.month_name?.toLowerCase() || month}_${year}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Download CSV Report
  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      let url = `/reports/export-monthly-csv/?year=${year}&month=${month}`;
      if (department) url += `&department=${department}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;

      const response = await api.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `monthly_report_${reportData?.month_name?.toLowerCase() || month}_${year}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export CSV:', err);
      alert('Failed to export CSV file. Please try again.');
    } finally {
      setExportingCSV(false);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const cal = reportData?.calendar || {};
  const summary = reportData?.summary || {};

  return (
    <div className="space-y-6">
      
      {/* Top Filter & Toolbar Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 print:hidden">
        
        {/* Month / Year Navigator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-inner">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 flex items-center gap-2">
              <span className="font-bold text-sm text-white min-w-[90px] text-center">
                {monthNames[month - 1]}
              </span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-cyan-400 focus:outline-none cursor-pointer border-none py-0 pr-2 pl-0"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => {
              const now = new Date();
              setYear(now.getFullYear());
              setMonth(now.getMonth() + 1);
            }}
            className="px-2.5 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl border border-slate-800 transition-colors"
          >
            Current Month
          </button>
        </div>

        {/* Filter Controls: Department & Search */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Department Filter */}
          <div className="relative min-w-[170px]">
            <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 transition-colors cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee / ID..."
              className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => { setSearch(''); fetchMonthlyReport(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            )}
          </form>

          {/* Action Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Download Excel Spreadsheet with formatted columns and totals"
            >
              {exportingExcel ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Export Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exportingCSV || loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Download Standard UTF-8 CSV"
            >
              {exportingCSV ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Download className="w-4 h-4 text-cyan-400" />
              )}
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={loading}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Print Report or Save as PDF"
            >
              <Printer className="w-4 h-4 text-indigo-400" />
              <span>Print / PDF</span>
            </button>
          </div>

        </div>

      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-xs font-semibold">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Top Summary KPI Cards */}
      {reportData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 print:grid-cols-3">
          
          {/* Card 1: Total Employees & Attendance */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Employees
              <User className="w-3.5 h-3.5 text-brand-400" />
            </span>
            <p className="text-xl font-extrabold text-white">{summary.total_employees}</p>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Avg Attendance:</span>
              <span className="font-bold text-emerald-400">{summary.avg_attendance_percentage}%</span>
            </div>
          </div>

          {/* Card 2: Calendar Breakdown */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Scheduled Calendar
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-cyan-400">{cal.company_working_days}</span>
              <span className="text-xs text-slate-400">/ {cal.calendar_days} days</span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {cal.sundays} Sundays • {cal.second_saturdays} 2nd Sat • {cal.company_holidays} Hol
            </p>
          </div>

          {/* Card 3: Working Hours */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Actual Work Hours
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </span>
            <p className="text-xl font-extrabold text-white">{summary.total_actual_work_hours}h</p>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Expected: {summary.total_expected_work_hours}h</span>
              <span className={`font-bold ${summary.total_actual_work_hours >= summary.total_expected_work_hours ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.total_actual_work_hours >= summary.total_expected_work_hours ? '+' : ''}
                {roundVariance(summary.total_actual_work_hours - summary.total_expected_work_hours)}h
              </span>
            </div>
          </div>

          {/* Card 4: Screen Time */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Actual Screen Time
              <Monitor className="w-3.5 h-3.5 text-violet-400" />
            </span>
            <p className="text-xl font-extrabold text-violet-300">{summary.total_actual_screen_hours}h</p>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Expected: {summary.total_expected_work_hours}h</span>
              <span className={`font-bold ${summary.total_actual_screen_hours >= summary.total_expected_work_hours ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.total_actual_screen_hours >= summary.total_expected_work_hours ? '+' : ''}
                {roundVariance(summary.total_actual_screen_hours - summary.total_expected_work_hours)}h
              </span>
            </div>
          </div>

          {/* Card 5: Payroll Payable */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Total Salary Payable
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            </span>
            <p className="text-xl font-extrabold text-emerald-400 font-mono">₹{summary.total_payroll_payable?.toLocaleString('en-IN')}</p>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Base: ₹{summary.total_payroll_base?.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Card 6: Total Deductions & Health */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              Salary Deductions
              {summary.inconsistent_count === 0 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              )}
            </span>
            <p className="text-xl font-extrabold text-rose-400 font-mono">
              -₹{summary.total_salary_deductions?.toLocaleString('en-IN')}
            </p>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-slate-400">Absences: {summary.total_unpaid_absence_days}d</span>
              {summary.inconsistent_count === 0 ? (
                <span className="text-[10px] font-bold text-emerald-400">✓ All Reconciled</span>
              ) : (
                <span className="text-[10px] font-bold text-amber-400">⚠️ {summary.inconsistent_count} Flagged</span>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Main 21+ Column Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative">
        {loading && (
          <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
            <span className="text-xs font-semibold text-slate-300">Generating Monthly Attendance & Salary Report...</span>
          </div>
        )}

        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-950/95 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 z-10 border-b border-slate-800 select-none">
              <tr>
                {/* Sticky Employee Columns */}
                <th onClick={() => handleSort('employee_id')} className="px-3.5 py-3.5 cursor-pointer hover:text-white sticky left-0 z-20 bg-slate-950/95">
                  <div className="flex items-center gap-1">
                    <span>Employee ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th onClick={() => handleSort('employee_name')} className="px-4 py-3.5 cursor-pointer hover:text-white sticky left-[110px] z-20 bg-slate-950/95">
                  <div className="flex items-center gap-1">
                    <span>Name & Dept</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Salary */}
                <th onClick={() => handleSort('monthly_salary')} className="px-3.5 py-3.5 text-right cursor-pointer hover:text-white">
                  <div className="flex items-center justify-end gap-1">
                    <span>Salary (₹)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>

                {/* Calendar columns */}
                <th className="px-2.5 py-3.5 text-center">Cal</th>
                <th className="px-2.5 py-3.5 text-center">Sun</th>
                <th className="px-2.5 py-3.5 text-center">2nd Sat</th>
                <th onClick={() => handleSort('company_working_days')} className="px-3 py-3.5 text-center font-bold text-cyan-400 cursor-pointer">
                  Work Days
                </th>

                {/* Attendance & Leaves */}
                <th onClick={() => handleSort('present_days')} className="px-3 py-3.5 text-center font-bold text-emerald-400 cursor-pointer">
                  Present
                </th>
                <th onClick={() => handleSort('optional_leave_used')} className="px-2.5 py-3.5 text-center cursor-pointer text-violet-300">
                  Opt Leave
                </th>
                <th onClick={() => handleSort('casual_leave_used')} className="px-2.5 py-3.5 text-center cursor-pointer text-indigo-300">
                  Cas Leave
                </th>
                <th onClick={() => handleSort('total_paid_leave_used')} className="px-3 py-3.5 text-center font-bold text-white cursor-pointer">
                  Paid Leave
                </th>
                <th onClick={() => handleSort('unpaid_absence_days')} className="px-3 py-3.5 text-center font-bold text-rose-400 cursor-pointer">
                  Unpaid
                </th>

                {/* Work Hours */}
                <th className="px-3 py-3.5 text-right">Exp Hours</th>
                <th onClick={() => handleSort('actual_working_hours')} className="px-3 py-3.5 text-right cursor-pointer font-bold text-white">
                  Act Hours
                </th>
                <th onClick={() => handleSort('working_hour_difference')} className="px-3 py-3.5 text-right cursor-pointer">
                  Hour Diff
                </th>

                {/* Screen Time */}
                <th className="px-3 py-3.5 text-right">Exp Screen</th>
                <th onClick={() => handleSort('actual_screen_time')} className="px-3 py-3.5 text-right cursor-pointer font-bold text-violet-300">
                  Act Screen
                </th>
                <th onClick={() => handleSort('screen_time_difference')} className="px-3 py-3.5 text-right cursor-pointer">
                  Screen Diff
                </th>

                {/* Salary Breakdown */}
                <th className="px-3 py-3.5 text-right">Per-Day (₹)</th>
                <th onClick={() => handleSort('salary_deduction')} className="px-3.5 py-3.5 text-right text-rose-400 font-bold cursor-pointer">
                  Deduction (₹)
                </th>
                <th onClick={() => handleSort('salary_payable')} className="px-3.5 py-3.5 text-right text-emerald-400 font-extrabold cursor-pointer">
                  Payable (₹)
                </th>

                {/* Attendance % */}
                <th onClick={() => handleSort('final_attendance_percentage')} className="px-3 py-3.5 text-center cursor-pointer">
                  Att %
                </th>

                {/* Reconciliation & Details */}
                <th className="px-3.5 py-3.5 text-center">Audit</th>
                <th className="px-3.5 py-3.5 text-center">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
              {sortedEmployees.length === 0 && !loading ? (
                <tr>
                  <td colSpan="24" className="text-center py-12 text-slate-500 font-sans">
                    No employee attendance data found for {monthNames[month - 1]} {year}.
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    onClick={() => openEmployeeDetail(emp)}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Sticky Employee ID */}
                    <td className="px-3.5 py-3 font-bold text-white whitespace-nowrap sticky left-0 z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors">
                      {emp.employee_id}
                    </td>

                    {/* Sticky Employee Name & Department */}
                    <td className="px-4 py-3 font-sans whitespace-nowrap sticky left-[110px] z-10 bg-slate-900 group-hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white text-[11px] font-extrabold shrink-0">
                          {emp.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-100 text-xs truncate max-w-[140px]" title={emp.employee_name}>
                            {emp.employee_name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{emp.department}</p>
                        </div>
                      </div>
                    </td>

                    {/* Monthly Salary */}
                    <td className="px-3.5 py-3 text-right font-semibold text-white whitespace-nowrap">
                      ₹{emp.monthly_salary.toLocaleString('en-IN')}
                    </td>

                    {/* Calendar breakdown */}
                    <td className="px-2.5 py-3 text-center text-slate-400">{emp.calendar_days}</td>
                    <td className="px-2.5 py-3 text-center text-slate-400">{emp.sundays}</td>
                    <td className="px-2.5 py-3 text-center text-slate-400">{emp.second_saturdays}</td>
                    <td className="px-3 py-3 text-center font-bold text-cyan-400 bg-cyan-500/5">
                      {emp.company_working_days}
                    </td>

                    {/* Attendance counts */}
                    <td className="px-3 py-3 text-center font-bold text-emerald-400 bg-emerald-500/5">
                      {emp.present_days}
                    </td>
                    <td className="px-2.5 py-3 text-center text-violet-300">
                      {emp.optional_leave_used > 0 ? emp.optional_leave_used : '-'}
                    </td>
                    <td className="px-2.5 py-3 text-center text-indigo-300">
                      {emp.casual_leave_used > 0 ? emp.casual_leave_used : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-white">
                      {emp.total_paid_leave_used > 0 ? emp.total_paid_leave_used : '-'}
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-rose-400 bg-rose-500/5">
                      {emp.unpaid_absence_days > 0 ? emp.unpaid_absence_days : '0'}
                    </td>

                    {/* Work Hours */}
                    <td className="px-3 py-3 text-right text-slate-400">{emp.expected_working_hours}h</td>
                    <td className="px-3 py-3 text-right font-bold text-cyan-300">{emp.actual_working_hours}h</td>
                    <td className="px-3 py-3 text-right font-semibold">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                        emp.working_hour_difference >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {emp.working_hour_difference >= 0 ? `+${emp.working_hour_difference}` : emp.working_hour_difference}h
                      </span>
                    </td>

                    {/* Screen Time */}
                    <td className="px-3 py-3 text-right text-slate-400">{emp.expected_screen_time}h</td>
                    <td className="px-3 py-3 text-right font-bold text-violet-300">{emp.actual_screen_time}h</td>
                    <td className="px-3 py-3 text-right font-semibold">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                        emp.screen_time_difference >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {emp.screen_time_difference >= 0 ? `+${emp.screen_time_difference}` : emp.screen_time_difference}h
                      </span>
                    </td>

                    {/* Salary Calculations */}
                    <td className="px-3 py-3 text-right text-slate-300">
                      ₹{emp.per_day_salary.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3.5 py-3 text-right font-bold text-rose-400">
                      {emp.salary_deduction > 0 ? `-₹${emp.salary_deduction.toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-extrabold text-emerald-400 bg-emerald-500/10 whitespace-nowrap">
                      ₹{emp.salary_payable.toLocaleString('en-IN')}
                    </td>

                    {/* Attendance % */}
                    <td className="px-3 py-3 text-center font-bold text-white">
                      {emp.final_attendance_percentage}%
                    </td>

                    {/* Reconciliation status */}
                    <td className="px-3.5 py-3 text-center">
                      {emp.is_reconciled ? (
                        <span className="inline-flex items-center text-emerald-400" title="Present + Paid Leave + Unpaid = Working Days">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-400" title={emp.inconsistency_warning}>
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-3.5 py-3 text-center" onClick={(e) => { e.stopPropagation(); openEmployeeDetail(emp); }}>
                      <button className="p-1 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer with quick summary count */}
        {reportData && (
          <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 print:hidden">
            <span>Showing {sortedEmployees.length} active employees</span>
            <span className="font-semibold text-slate-300">Click any row to open the complete daily attendance and screen-time audit log.</span>
          </div>
        )}

      </div>

      {/* Single Employee Detailed Report Modal */}
      <EmployeeMonthlyDetailModal
        employee={selectedEmployee}
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedEmployee(null);
        }}
      />

    </div>
  );
};

function roundVariance(val) {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

export default MonthlyReportTable;
