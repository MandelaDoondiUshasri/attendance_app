import React, { useState } from 'react';
import { 
  X, Calendar, Clock, Monitor, DollarSign, CheckCircle2, 
  AlertTriangle, Printer, User, ShieldCheck, Info, FileText, ArrowRight
} from 'lucide-react';

export const EmployeeMonthlyDetailModal = ({ employee, isOpen, onClose }) => {
  const [dayFilter, setDayFilter] = useState('ALL'); // 'ALL' | 'WORKING' | 'LEAVES_ABSENCE'

  if (!isOpen || !employee) return null;

  const handlePrint = () => {
    window.print();
  };

  const filteredDays = (employee.daily_breakdown || []).filter(d => {
    if (dayFilter === 'WORKING') return d.is_working_day;
    if (dayFilter === 'LEAVES_ABSENCE') {
      return (
        d.day_type.includes('LEAVE') || 
        d.day_type.includes('ABSENCE') || 
        d.attendance_status.includes('Leave') || 
        d.attendance_status.includes('Absent') ||
        d.paid_unpaid === 'Unpaid'
      );
    }
    return true;
  });

  const getDayTypeBadge = (dayType) => {
    switch (dayType) {
      case 'SUNDAY':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">Sunday</span>;
      case 'SECOND_SATURDAY':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">2nd Saturday</span>;
      case 'COMPANY_HOLIDAY':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">Holiday</span>;
      case 'Optional Leave':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-violet-500/20 text-violet-300 border border-violet-500/30">Optional Leave</span>;
      case 'Casual Leave':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Casual Leave</span>;
      case 'Other Paid Leave':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Paid Leave</span>;
      case 'Unpaid Absence':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">Unpaid Absence</span>;
      case 'Half Day':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/30">Half Day</span>;
      case 'PRE_JOINING':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-800 text-slate-400">Pre-Joining</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-800 text-slate-300">Working Day</span>;
    }
  };

  const getStatusBadge = (status) => {
    if (status.includes('Present') || status === 'Present') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">{status}</span>;
    }
    if (status.includes('Late')) {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">{status}</span>;
    }
    if (status.includes('Leave')) {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">{status}</span>;
    }
    if (status.includes('Absent') || status === 'Unpaid Absence') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">Absent</span>;
    }
    return <span className="text-slate-400 text-xs">{status}</span>;
  };

  const balances = employee.leave_balances || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static print:inset-auto">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:border-none print:shadow-none print:bg-white print:text-black">
        
        {/* Top Header / Employee Profile */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex items-center justify-between shrink-0 print:border-b print:border-slate-300">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 border-2 border-indigo-400/40 flex items-center justify-center text-white font-extrabold text-xl shadow-lg print:border print:border-slate-400">
              {employee.profile_photo ? (
                <img src={employee.profile_photo} alt={employee.employee_name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                employee.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight print:text-black">{employee.employee_name}</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg print:bg-slate-100 print:text-slate-800">
                  {employee.employee_id}
                </span>
                {employee.is_reconciled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="w-3 h-3" /> Reconciled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-3 h-3" /> Audit Flag
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 print:text-slate-600">
                {employee.department} • {employee.designation} • {employee.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 print:hidden">
            <div className="text-right mr-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Report Period</span>
              <span className="text-sm font-bold text-cyan-400">{employee.month_name} {employee.year}</span>
            </div>
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors shadow"
              title="Print Monthly Slip / Save PDF"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span>Print Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 print:p-2 print:overflow-visible">
          
          {/* Reconciliation & Inconsistency Banner */}
          {employee.is_reconciled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between print:border-emerald-600">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Attendance Reconciled</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <span className="font-semibold text-emerald-400">{employee.present_days} Present</span> +{' '}
                    <span className="font-semibold text-indigo-300">{employee.total_paid_leave_used} Paid Leave</span> +{' '}
                    <span className="font-semibold text-rose-400">{employee.unpaid_absence_days} Unpaid Absence</span> ={' '}
                    <span className="font-bold text-white">{employee.company_working_days} Scheduled Working Days</span>.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Attendance Rate</span>
                <p className="text-lg font-extrabold text-emerald-400">{employee.final_attendance_percentage}%</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Reconciliation Audit Notice</h4>
                <p className="text-xs text-slate-300 mt-0.5">{employee.inconsistency_warning}</p>
              </div>
            </div>
          )}

          {/* 4 Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Attendance Summary */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Breakdown</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Calendar Days:</span>
                  <span className="font-semibold text-slate-200">{employee.calendar_days} days</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Sundays / 2nd Sat:</span>
                  <span className="font-semibold text-slate-200">{employee.sundays} Sun / {employee.second_saturdays} Sat</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Company Working Days:</span>
                  <span className="font-bold text-cyan-400">{employee.company_working_days} days</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-emerald-400 font-medium">Present Days:</span>
                  <span className="font-bold text-emerald-400">{employee.present_days} days</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-indigo-400 font-medium">Paid Leave Days:</span>
                  <span className="font-bold text-indigo-300">{employee.total_paid_leave_used} days</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-rose-400 font-medium">Unpaid Absence:</span>
                  <span className="font-bold text-rose-400">{employee.unpaid_absence_days} days</span>
                </div>
              </div>
            </div>

            {/* Card 2: Leave Summary & Entitlements */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leave Balances</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-violet-300 text-[11px]">
                    <span>Optional Festival Leave:</span>
                    <span>{employee.optional_leave_used} Used this month</span>
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Entitlement: {balances.optional_leave_entitlement ?? 1}</span>
                    <span>Remaining: {balances.optional_leave_remaining ?? 0}</span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-indigo-300 text-[11px]">
                    <span>Casual Leave:</span>
                    <span>{employee.casual_leave_used} Used this month</span>
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Entitlement: {balances.casual_leave_entitlement ?? 12}</span>
                    <span>Remaining: {balances.casual_leave_remaining ?? 12}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-400">Total Paid Leave:</span>
                  <span className="font-bold text-white">{employee.total_paid_leave_used} days</span>
                </div>
              </div>
            </div>

            {/* Card 3: Working Hours vs Screen Time */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Metrics</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="space-y-2 text-xs">
                {/* Working Hours */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400" /> Working Time</span>
                    <span className={`font-mono ${employee.working_hour_difference >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {employee.working_hour_difference >= 0 ? `+${employee.working_hour_difference}` : employee.working_hour_difference}h
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Expected: {employee.expected_working_hours}h</span>
                    <span className="font-bold text-white">Actual: {employee.actual_working_hours}h</span>
                  </div>
                </div>

                {/* Screen Time */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-violet-400" /> Screen Time</span>
                    <span className={`font-mono ${employee.screen_time_difference >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {employee.screen_time_difference >= 0 ? `+${employee.screen_time_difference}` : employee.screen_time_difference}h
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Expected: {employee.expected_screen_time}h</span>
                    <span className="font-bold text-white">Actual: {employee.actual_screen_time}h</span>
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>Avg Work/Day: {employee.avg_working_hours_per_present}h</span>
                  <span>Avg Screen/Day: {employee.avg_screen_time_per_present}h</span>
                </div>
              </div>
            </div>

            {/* Card 4: Salary Computation */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 print:border-slate-300 print:bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salary Computation</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Monthly Base Salary:</span>
                  <span className="font-semibold text-white">₹{employee.monthly_salary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Effective Payable Days:</span>
                  <span className="font-semibold text-cyan-400">{employee.effective_payable_days} days</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Per-Day Salary:</span>
                  <span className="font-mono text-slate-200">₹{employee.per_day_salary.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-rose-400 font-medium">Salary Deduction ({employee.unpaid_absence_days}d):</span>
                  <span className="font-mono font-bold text-rose-400">-₹{employee.salary_deduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 bg-emerald-500/10 px-2 rounded-lg border border-emerald-500/20">
                  <span className="text-emerald-300 font-bold">Salary Payable:</span>
                  <span className="font-mono font-extrabold text-emerald-400 text-sm">₹{employee.salary_payable.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Daily Breakdown Table Header & Filter Tabs */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider print:text-black">
                  Daily Attendance, Working Hours & Screen Time Log
                </h3>
                <p className="text-xs text-slate-400 print:text-slate-600">
                  Day-by-day complete record of check-in, check-out, active screen time, and leave classifications.
                </p>
              </div>

              {/* Day Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0 print:hidden">
                <button
                  onClick={() => setDayFilter('ALL')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Days ({employee.calendar_days})
                </button>
                <button
                  onClick={() => setDayFilter('WORKING')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'WORKING' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Working Days ({employee.company_working_days})
                </button>
                <button
                  onClick={() => setDayFilter('LEAVES_ABSENCE')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'LEAVES_ABSENCE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Leaves & Absences
                </button>
              </div>
            </div>

            {/* Daily Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60 print:border-slate-300 print:bg-white">
              <div className="overflow-x-auto max-h-[42vh] print:max-h-none">
                <table className="w-full text-left text-xs text-slate-300 print:text-black">
                  <thead className="bg-slate-950/90 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 z-10 print:bg-slate-100 print:text-slate-700">
                    <tr>
                      <th className="px-3.5 py-3">Date</th>
                      <th className="px-3 py-3">Day</th>
                      <th className="px-3.5 py-3">Day Type</th>
                      <th className="px-3 py-3">Check In</th>
                      <th className="px-3 py-3">Check Out</th>
                      <th className="px-3 py-3 text-right">Working Time</th>
                      <th className="px-3 py-3 text-right">Screen Time</th>
                      <th className="px-3.5 py-3">Attendance Status</th>
                      <th className="px-3.5 py-3">Leave Type</th>
                      <th className="px-3 py-3 text-center">Paid / Unpaid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 print:divide-slate-200">
                    {filteredDays.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-slate-500">No records matching the selected day filter.</td>
                      </tr>
                    ) : (
                      filteredDays.map((d) => (
                        <tr 
                          key={d.date} 
                          className={`hover:bg-slate-800/40 transition-colors ${
                            d.paid_unpaid === 'Unpaid' ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          <td className="px-3.5 py-2.5 font-bold text-white print:text-black whitespace-nowrap">
                            {d.date_formatted}
                          </td>
                          <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                            {d.day_name}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {getDayTypeBadge(d.day_type)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                            {d.check_in || '-'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px]">
                            {d.missing_checkout ? (
                              <span className="text-rose-400 font-bold" title="Missing Check-out">Missing Checkout</span>
                            ) : (
                              <span className="text-slate-300">{d.check_out || '-'}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-cyan-400">
                            {d.working_hours > 0 ? `${d.working_hours} hrs` : '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono font-semibold text-violet-300">
                            {d.missing_screentime ? (
                              <span className="text-amber-400 font-medium text-[10px]" title="No screen activity recorded">No Track</span>
                            ) : d.screen_hours > 0 ? (
                              `${d.screen_hours} hrs`
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            {getStatusBadge(d.attendance_status)}
                          </td>
                          <td className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap">
                            {d.leave_type !== '-' ? (
                              <span className="font-semibold text-indigo-300">{d.leave_type}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            {d.paid_unpaid === 'Paid' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid</span>
                            )}
                            {d.paid_unpaid === 'Unpaid' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">Unpaid</span>
                            )}
                            {d.paid_unpaid === 'Half Paid' && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">Half Paid</span>
                            )}
                            {d.paid_unpaid === '-' && (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between shrink-0 print:hidden">
          <div className="text-xs text-slate-400">
            <span className="font-semibold text-slate-300">FRG Policy Formula:</span> Effective Days = Working Days - Paid Leaves • Per-Day = Salary / Effective Days • Deduction = Unpaid Days × Per-Day
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
          >
            Close Report
          </button>
        </div>

      </div>
    </div>
  );
};

export default EmployeeMonthlyDetailModal;
