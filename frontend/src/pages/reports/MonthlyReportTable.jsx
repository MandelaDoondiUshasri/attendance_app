import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, Clock, Monitor, IndianRupee, Download, FileSpreadsheet, 
  Printer, Search, Filter, ChevronLeft, ChevronRight, CheckCircle2, 
  AlertTriangle, Eye, ArrowUpDown, RefreshCw, AlertCircle, Building2, 
  User, Check, ShieldAlert, Sparkles, Layers, Activity, TrendingUp, TrendingDown
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
  const [detailLoading, setDetailLoading] = useState(false);

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

  const isCurrentMonth = () => {
    const now = new Date();
    return year === now.getFullYear() && month === (now.getMonth() + 1);
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

  // Open detailed employee modal – fetch full detail (incl. daily_breakdown) first
  const openEmployeeDetail = async (emp) => {
    setDetailLoading(true);
    try {
      const res = await api.get(
        `/reports/monthly-report/${emp.employee_id}/?year=${year}&month=${month}`
      );
      setSelectedEmployee(res.data);
    } catch (err) {
      console.error('Failed to load employee detail:', err);
      // Fallback to summary data so the modal still opens
      setSelectedEmployee(emp);
    } finally {
      setDetailLoading(false);
      setDetailModalOpen(true);
    }
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

  // Render sort indicator
  const renderSortIndicator = (field) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-600 opacity-0 group-hover/th:opacity-100 transition-opacity" />;
    }
    return (
      <span className="text-cyan-400 font-black text-[11px]">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Sleek Floating Control & Action Toolbar */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-4 print:hidden">
        
        {/* Month & Year Navigator */}
        <div className="flex items-center flex-wrap gap-2.5">
          <div className="flex items-center bg-slate-950/80 border border-slate-700/60 rounded-xl p-1 shadow-inner">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="px-3 py-0.5 flex items-center gap-2">
              <span className="font-extrabold text-sm text-white tracking-wide min-w-[95px] text-center">
                {monthNames[month - 1]}
              </span>
              <span className="text-slate-600">/</span>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-cyan-400 focus:outline-none cursor-pointer border-none py-0 pr-1 pl-0"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y} className="bg-slate-900 text-white">{y}</option>
                ))}
              </select>
            </div>

            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
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
            className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 ${
              isCurrentMonth()
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800 border-slate-800'
            }`}
          >
            {isCurrentMonth() && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>}
            Current Month
          </button>

          <button
            onClick={fetchMonthlyReport}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
            title="Reload Ledger Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Filters & Export Suite */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Department Filter */}
          <div className="relative min-w-[160px]">
            <Building2 className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or ID..."
              className="w-full pl-8 pr-7 py-2 bg-slate-950/80 border border-slate-700/60 rounded-xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
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

          {/* Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              disabled={exportingExcel || loading}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50 active:scale-98"
              title="Download formatted Excel workbook with color-coded formulas"
            >
              {exportingExcel ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5" />
              )}
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportCSV}
              disabled={exportingCSV || loading}
              className="px-3 py-2 bg-slate-950/80 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/70 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Download UTF-8 standard CSV"
            >
              {exportingCSV ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              disabled={loading}
              className="px-3 py-2 bg-slate-950/80 hover:bg-slate-800 text-slate-200 font-bold text-xs rounded-xl border border-slate-700/70 flex items-center gap-1.5 transition-all disabled:opacity-50"
              title="Print Monthly Ledger or Export PDF"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span>Print</span>
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

      {/* Executive KPI Summary Dashboard */}
      {reportData && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5 print:grid-cols-3">
          
          {/* Tile 1: Active Headcount & Attendance Rate */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-cyan-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Workforce</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Users className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white">{summary.total_employees}</span>
              <span className="text-xs font-semibold text-slate-400">staff</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Avg Attendance</span>
              <span className="font-extrabold text-emerald-400 font-mono">{summary.avg_attendance_percentage}%</span>
            </div>
          </div>

          {/* Tile 2: Operating Calendar */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-indigo-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Working Days</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Calendar className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-cyan-400">{cal.company_working_days}</span>
              <span className="text-xs font-semibold text-slate-400">/ {cal.calendar_days} days</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400 truncate">
              <span>{cal.sundays} Sun • {cal.second_saturdays} 2nd Sat • {cal.company_holidays} Hol</span>
            </div>
          </div>

          {/* Tile 3: Actual Work Hours */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-amber-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Actual Hours</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-white font-mono">{summary.total_actual_work_hours}h</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Exp: {summary.total_expected_work_hours}h</span>
              <span className={`font-mono font-bold ${summary.total_actual_work_hours >= summary.total_expected_work_hours ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.total_actual_work_hours >= summary.total_expected_work_hours ? '+' : ''}
                {roundVariance(summary.total_actual_work_hours - summary.total_expected_work_hours)}h
              </span>
            </div>
          </div>

          {/* Tile 4: Active Screen Time */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-purple-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Screen Time</span>
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Monitor className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-purple-300 font-mono">{summary.total_actual_screen_hours}h</span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Variance:</span>
              <span className={`font-mono font-bold ${summary.total_actual_screen_hours >= summary.total_expected_work_hours ? 'text-emerald-400' : 'text-amber-400'}`}>
                {summary.total_actual_screen_hours >= summary.total_expected_work_hours ? '+' : ''}
                {roundVariance(summary.total_actual_screen_hours - summary.total_expected_work_hours)}h
              </span>
            </div>
          </div>

          {/* Tile 5: Total Net Payable */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-emerald-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Net Payable</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <IndianRupee className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
                ₹{summary.total_payroll_payable?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Base:</span>
              <span className="text-slate-300 font-mono font-medium">₹{summary.total_payroll_base?.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Tile 6: Deductions & Audit Status */}
          <div className="group relative p-4 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-800/90 hover:border-rose-500/40 transition-all duration-200 shadow-xl overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <span>Deductions</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${summary.inconsistent_count === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {summary.inconsistent_count === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                -₹{summary.total_salary_deductions?.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{summary.total_unpaid_absence_days}d absence</span>
              {summary.inconsistent_count === 0 ? (
                <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  Reconciled
                </span>
              ) : (
                <span className="text-[10px] font-extrabold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {summary.inconsistent_count} Flagged
                </span>
              )}
            </div>
          </div>

        </div>
      )}

      {/* The Main 21-Column Executive Ledger */}
      <div className="rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800 shadow-2xl relative flex flex-col overflow-hidden">
        
        {/* Loading Overlay */}
        {(loading || detailLoading) && (
          <div className="absolute inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-white">
                {detailLoading ? 'Fetching Full Audit Breakdown...' : 'Calculating Monthly Reconciliation Ledger...'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Reconciling biometric timestamps, screen telemetry and formulas</p>
            </div>
          </div>
        )}

        {/* Scrollable Container with custom scrollbar */}
        <div
          className="table-scroll"
          style={{ maxHeight: '68vh' }}
        >
          <table className="text-left text-xs border-collapse" style={{ minWidth: '1750px', width: '100%' }}>
            
            {/* 2-Tier Grouped Sticky Header */}
            <thead className="select-none" style={{ position: 'sticky', top: 0, zIndex: 40, backgroundColor: '#090e1a' }}>
              
              {/* Top Tier: Category Groups */}
              <tr className="border-b border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                {/* Frozen Group: Employee Profile */}
                <th
                  colSpan="2"
                  className="px-4 py-2 border-r border-slate-800"
                  style={{ position: 'sticky', left: 0, zIndex: 46, backgroundColor: '#090e1a', boxShadow: '4px 0 14px -2px rgba(0, 0, 0, 0.7)' }}
                >
                  <div className="flex items-center gap-1.5 text-cyan-400">
                    <User className="w-3 h-3" />
                    <span>Employee Identity</span>
                  </div>
                </th>

                {/* Salary */}
                <th className="px-3.5 py-2 text-right border-r border-slate-800/60 text-slate-400">
                  Compensation
                </th>

                {/* Calendar & Attendance Group */}
                <th colSpan="9" className="px-3 py-2 text-center border-r border-slate-800/60 bg-slate-900/40 text-indigo-300">
                  <div className="flex items-center justify-center gap-1.5">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    <span>Operating Calendar & Attendance Ledger</span>
                  </div>
                </th>

                {/* Hours Group */}
                <th colSpan="3" className="px-3 py-2 text-center border-r border-slate-800/60 bg-slate-900/20 text-amber-300">
                  <div className="flex items-center justify-center gap-1.5">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Working Hours</span>
                  </div>
                </th>

                {/* Screen Time Group */}
                <th colSpan="3" className="px-3 py-2 text-center border-r border-slate-800/60 bg-slate-900/40 text-purple-300">
                  <div className="flex items-center justify-center gap-1.5">
                    <Monitor className="w-3 h-3 text-purple-400" />
                    <span>Screen Activity</span>
                  </div>
                </th>

                {/* Payroll Group */}
                <th colSpan="3" className="px-3 py-2 text-center border-r border-slate-800/60 bg-slate-900/60 text-emerald-400">
                  <div className="flex items-center justify-center gap-1.5">
                    <IndianRupee className="w-3 h-3 text-emerald-400" />
                    <span>Payroll Reconciliation</span>
                  </div>
                </th>

                {/* Audit & Action Group */}
                <th colSpan="3" className="px-3 py-2 text-center text-slate-300">
                  Audit & Action
                </th>
              </tr>

              {/* Lower Tier: Specific Columns */}
              <tr className="border-b border-slate-700/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 bg-slate-950/90">
                
                {/* Frozen Column 1: EMP ID (Width: 105px) */}
                <th
                  onClick={() => handleSort('employee_id')}
                  className="px-3.5 py-3 cursor-pointer hover:text-white border-r border-slate-800 group/th"
                  style={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 47,
                    width: '105px',
                    minWidth: '105px',
                    maxWidth: '105px',
                    backgroundColor: '#090e1a'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>ID</span>
                    {renderSortIndicator('employee_id')}
                  </div>
                </th>

                {/* Frozen Column 2: Name & Department (Width: 220px) */}
                <th
                  onClick={() => handleSort('employee_name')}
                  className="px-3.5 py-3 cursor-pointer hover:text-white border-r-2 border-slate-700 group/th"
                  style={{
                    position: 'sticky',
                    left: '105px',
                    zIndex: 47,
                    width: '220px',
                    minWidth: '220px',
                    maxWidth: '220px',
                    backgroundColor: '#090e1a',
                    boxShadow: '4px 0 14px -2px rgba(0, 0, 0, 0.7)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span>Employee & Dept</span>
                    {renderSortIndicator('employee_name')}
                  </div>
                </th>

                {/* Monthly Salary */}
                <th
                  onClick={() => handleSort('monthly_salary')}
                  className="px-3.5 py-3 text-right cursor-pointer hover:text-white border-r border-slate-800/60 group/th"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Base (₹)</span>
                    {renderSortIndicator('monthly_salary')}
                  </div>
                </th>

                {/* Calendar sub-columns */}
                <th className="px-2 py-3 text-center text-slate-400" title="Total Days in Month">Cal</th>
                <th className="px-2 py-3 text-center text-slate-400" title="Sundays Count">Sun</th>
                <th className="px-2 py-3 text-center text-slate-400" title="Second Saturdays">2nd Sat</th>
                <th
                  onClick={() => handleSort('company_working_days')}
                  className="px-2.5 py-3 text-center font-black text-cyan-400 cursor-pointer hover:text-cyan-300 group/th"
                  title="Company Working Days"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Work</span>
                    {renderSortIndicator('company_working_days')}
                  </div>
                </th>

                {/* Attendance counts */}
                <th
                  onClick={() => handleSort('present_days')}
                  className="px-2.5 py-3 text-center font-black text-emerald-400 cursor-pointer hover:text-emerald-300 group/th"
                  title="Total Days Present"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Present</span>
                    {renderSortIndicator('present_days')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('optional_leave_used')}
                  className="px-2 py-3 text-center cursor-pointer text-violet-300 hover:text-white group/th"
                  title="Optional Leave Used"
                >
                  <span>Opt</span>
                </th>
                <th
                  onClick={() => handleSort('casual_leave_used')}
                  className="px-2 py-3 text-center cursor-pointer text-indigo-300 hover:text-white group/th"
                  title="Casual Leave Used"
                >
                  <span>Cas</span>
                </th>
                <th
                  onClick={() => handleSort('total_paid_leave_used')}
                  className="px-2.5 py-3 text-center font-bold text-white cursor-pointer hover:text-cyan-300 group/th"
                  title="Total Paid Leaves Used"
                >
                  <span>Paid Lv</span>
                </th>
                <th
                  onClick={() => handleSort('unpaid_absence_days')}
                  className="px-2.5 py-3 text-center font-black text-rose-400 cursor-pointer hover:text-rose-300 border-r border-slate-800/60 group/th"
                  title="Unpaid Absence Days"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Unpaid</span>
                    {renderSortIndicator('unpaid_absence_days')}
                  </div>
                </th>

                {/* Work Hours Columns */}
                <th className="px-3 py-3 text-right text-slate-400" title="Expected Working Hours">Exp Hrs</th>
                <th
                  onClick={() => handleSort('actual_working_hours')}
                  className="px-3 py-3 text-right font-black text-white cursor-pointer hover:text-amber-300 group/th"
                  title="Actual Working Hours"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Act Hrs</span>
                    {renderSortIndicator('actual_working_hours')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('working_hour_difference')}
                  className="px-3 py-3 text-right cursor-pointer border-r border-slate-800/60 hover:text-white group/th"
                  title="Hour Difference (Actual - Expected)"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Diff</span>
                    {renderSortIndicator('working_hour_difference')}
                  </div>
                </th>

                {/* Screen Time Columns */}
                <th className="px-3 py-3 text-right text-slate-400" title="Expected Screen Time">Exp Scr</th>
                <th
                  onClick={() => handleSort('actual_screen_time')}
                  className="px-3 py-3 text-right font-black text-purple-300 cursor-pointer hover:text-purple-200 group/th"
                  title="Actual Screen Time"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Act Scr</span>
                    {renderSortIndicator('actual_screen_time')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('screen_time_difference')}
                  className="px-3 py-3 text-right cursor-pointer border-r border-slate-800/60 hover:text-white group/th"
                  title="Screen Time Difference"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Diff</span>
                    {renderSortIndicator('screen_time_difference')}
                  </div>
                </th>

                {/* Salary Calculation Columns */}
                <th className="px-3 py-3 text-right text-slate-400" title="Salary Per Day">Per-Day (₹)</th>
                <th
                  onClick={() => handleSort('salary_deduction')}
                  className="px-3 py-3 text-right text-rose-400 font-black cursor-pointer hover:text-rose-300 group/th"
                  title="Salary Deductions for Unpaid Days"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Deduction</span>
                    {renderSortIndicator('salary_deduction')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('salary_payable')}
                  className="px-3.5 py-3 text-right text-emerald-400 font-black cursor-pointer hover:text-emerald-300 border-r border-slate-800/60 group/th"
                  title="Final Salary Payable"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Payable (₹)</span>
                    {renderSortIndicator('salary_payable')}
                  </div>
                </th>

                {/* Attendance % */}
                <th
                  onClick={() => handleSort('final_attendance_percentage')}
                  className="px-3 py-3 text-center cursor-pointer hover:text-white group/th"
                  title="Attendance Percentage"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Att %</span>
                    {renderSortIndicator('final_attendance_percentage')}
                  </div>
                </th>

                {/* Reconciliation Audit & Action */}
                <th className="px-3 py-3 text-center" title="Reconciliation Status">Audit</th>
                <th className="px-3 py-3 text-center" title="Detailed Audit Slip">Slip</th>
              </tr>

            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/50 text-slate-300 font-mono">
              {sortedEmployees.length === 0 && !loading ? (
                <tr>
                  <td colSpan="24" className="text-center py-16 text-slate-500 font-sans">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-10 h-10 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                        <User className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">No Employee Records Found</p>
                      <p className="text-[11px] text-slate-500">
                        No attendance records for {monthNames[month - 1]} {year} match your filters.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedEmployees.map((emp) => (
                  <tr
                    key={emp.employee_id}
                    onClick={() => openEmployeeDetail(emp)}
                    className="hover:bg-indigo-950/20 transition-colors cursor-pointer group/row"
                  >
                    
                    {/* Frozen Column 1: EMP ID */}
                    <td
                      className="px-3.5 py-3 font-bold text-white whitespace-nowrap border-r border-slate-800 transition-colors group-hover/row:bg-slate-900"
                      style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 20,
                        width: '105px',
                        minWidth: '105px',
                        maxWidth: '105px',
                        backgroundColor: '#090e1a'
                      }}
                    >
                      <span className="text-xs tracking-wider text-slate-200">
                        {emp.employee_id}
                      </span>
                    </td>

                    {/* Frozen Column 2: Name & Department */}
                    <td
                      className="px-3.5 py-3 font-sans whitespace-nowrap border-r-2 border-slate-700 transition-colors group-hover/row:bg-slate-900"
                      style={{
                        position: 'sticky',
                        left: '105px',
                        zIndex: 20,
                        width: '220px',
                        minWidth: '220px',
                        maxWidth: '220px',
                        backgroundColor: '#090e1a',
                        boxShadow: '4px 0 14px -2px rgba(0, 0, 0, 0.7)'
                      }}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-600 via-indigo-600 to-cyan-500 flex items-center justify-center text-white text-[11px] font-black shrink-0 shadow-md">
                          {emp.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-100 text-xs truncate max-w-[130px]" title={emp.employee_name}>
                              {emp.employee_name}
                            </p>
                            {emp.is_half_day && (
                              <span className="px-1.5 py-0.2 text-[8px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded shrink-0">
                                0.5D
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]" title={emp.department}>
                            {emp.department || 'General'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Base Salary */}
                    <td className="px-3.5 py-3 text-right font-medium text-slate-200 whitespace-nowrap border-r border-slate-800/60">
                      ₹{(emp.monthly_salary || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Calendar Breakdown */}
                    <td className="px-2 py-3 text-center text-slate-400">{emp.calendar_days}</td>
                    <td className="px-2 py-3 text-center text-slate-400">{emp.sundays}</td>
                    <td className="px-2 py-3 text-center text-slate-400">{emp.second_saturdays}</td>
                    <td className="px-2.5 py-3 text-center font-bold text-cyan-400 bg-cyan-500/5">
                      {emp.company_working_days}
                    </td>

                    {/* Attendance counts */}
                    <td className="px-2.5 py-3 text-center font-bold text-emerald-400 bg-emerald-500/5">
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[11px]">
                        {emp.present_days}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center text-violet-300">
                      {emp.optional_leave_used > 0 ? emp.optional_leave_used : '-'}
                    </td>
                    <td className="px-2 py-3 text-center text-indigo-300">
                      {emp.casual_leave_used > 0 ? emp.casual_leave_used : '-'}
                    </td>
                    <td className="px-2.5 py-3 text-center font-bold text-white">
                      {emp.total_paid_leave_used > 0 ? emp.total_paid_leave_used : '-'}
                    </td>
                    <td className="px-2.5 py-3 text-center font-bold border-r border-slate-800/60">
                      {emp.unpaid_absence_days > 0 ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-400 font-extrabold text-[11px]">
                          {emp.unpaid_absence_days}
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>

                    {/* Working Hours */}
                    <td className="px-3 py-3 text-right text-slate-400">{emp.expected_working_hours}h</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-100">{emp.actual_working_hours}h</td>
                    <td className="px-3 py-3 text-right font-medium border-r border-slate-800/60">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        emp.working_hour_difference >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {emp.working_hour_difference >= 0 ? `+${emp.working_hour_difference}` : emp.working_hour_difference}h
                      </span>
                    </td>

                    {/* Screen Time */}
                    <td className="px-3 py-3 text-right text-slate-400">{emp.expected_screen_time}h</td>
                    <td className="px-3 py-3 text-right font-bold text-purple-300">{emp.actual_screen_time}h</td>
                    <td className="px-3 py-3 text-right font-medium border-r border-slate-800/60">
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        emp.screen_time_difference >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-amber-400 bg-amber-500/10'
                      }`}>
                        {emp.screen_time_difference >= 0 ? `+${emp.screen_time_difference}` : emp.screen_time_difference}h
                      </span>
                    </td>

                    {/* Salary Calculation */}
                    <td className="px-3 py-3 text-right text-slate-300">
                      ₹{(emp.per_day_salary || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-rose-400">
                      {(emp.salary_deduction || 0) > 0 ? `-₹${(emp.salary_deduction || 0).toLocaleString('en-IN')}` : '₹0'}
                    </td>
                    <td className="px-3.5 py-3 text-right font-black text-emerald-400 bg-emerald-500/10 whitespace-nowrap border-r border-slate-800/60">
                      ₹{(emp.salary_payable || 0).toLocaleString('en-IN')}
                    </td>

                    {/* Attendance % */}
                    <td className="px-3 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        emp.final_attendance_percentage >= 75
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : emp.final_attendance_percentage >= 50
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      }`}>
                        {emp.final_attendance_percentage}%
                      </span>
                    </td>

                    {/* Reconciliation Audit */}
                    <td className="px-3 py-3 text-center">
                      {emp.is_reconciled ? (
                        <span className="inline-flex items-center text-emerald-400" title="Reconciled: Present + Paid Leave + Unpaid = Working Days">
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-400" title={emp.inconsistency_warning || 'Formula disparity'}>
                          <AlertTriangle className="w-4 h-4" />
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-3 py-3 text-center" onClick={(e) => { e.stopPropagation(); openEmployeeDetail(emp); }}>
                      <button
                        className="p-1.5 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-brand-600 rounded-lg transition-all shadow group-hover/row:scale-105"
                        title="View Detailed Monthly Slip & Daily Breakdown"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Executive Table Footer */}
        {reportData && (
          <div className="px-6 py-3.5 bg-slate-950/95 border-t border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 print:hidden">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white">
                Showing {sortedEmployees.length} of {summary.total_employees || sortedEmployees.length} employees
              </span>
              <span className="text-slate-600">|</span>
              <span>
                Total Net Payable: <strong className="text-emerald-400 font-mono">₹{summary.total_payroll_payable?.toLocaleString('en-IN')}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>Click any employee row to open granular daily audit logs and print salary slips.</span>
            </div>
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
