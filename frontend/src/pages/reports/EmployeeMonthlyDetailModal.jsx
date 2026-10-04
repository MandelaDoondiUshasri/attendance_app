import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Calendar, Clock, Monitor, DollarSign, CheckCircle2, 
  AlertTriangle, Printer, User, ShieldCheck, Info, FileText, ArrowRight,
  Edit3, Save, RotateCcw, Calculator, Sparkles, Check, HelpCircle, Sliders
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export const EmployeeMonthlyDetailModal = ({ employee, isOpen, onClose, onUpdate }) => {
  const { user } = useAuth();
  const isManagement = user?.role === 'CEO' || user?.role === 'HR' || user?.role === 'SYSTEM_ADMIN' || user?.is_ceo || user?.is_hr;

  const [currentEmployee, setCurrentEmployee] = useState(employee);
  const [dayFilter, setDayFilter] = useState('ALL'); // 'ALL' | 'WORKING' | 'LEAVES_ABSENCE'
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Form states for manual rectification
  const [editForm, setEditForm] = useState({});
  const [editableDailyRows, setEditableDailyRows] = useState([]);

  const printRef = useRef(null);

  useEffect(() => {
    setCurrentEmployee(employee);
    setIsEditing(false);
    setSaveError(null);
    setSaveSuccess(null);
  }, [employee]);

  if (!isOpen || !currentEmployee) return null;

  // Initialize edit form when starting editing
  const startEditing = () => {
    setEditForm({
      present_days: currentEmployee.present_days ?? '',
      optional_leave_used: currentEmployee.optional_leave_used ?? '',
      casual_leave_used: currentEmployee.casual_leave_used ?? '',
      other_paid_leave_used: currentEmployee.other_paid_leave_used ?? '',
      total_paid_leave_used: currentEmployee.total_paid_leave_used ?? '',
      unpaid_absence_days: currentEmployee.unpaid_absence_days ?? '',
      expected_working_hours: currentEmployee.expected_working_hours ?? '',
      actual_working_hours: currentEmployee.actual_working_hours ?? '',
      expected_screen_time: currentEmployee.expected_screen_time ?? '',
      actual_screen_time: currentEmployee.actual_screen_time ?? '',
      monthly_salary: currentEmployee.monthly_salary ?? '',
      effective_payable_days: currentEmployee.effective_payable_days ?? '',
      per_day_salary: currentEmployee.per_day_salary ?? '',
      salary_deduction: currentEmployee.salary_deduction ?? '',
      salary_payable: currentEmployee.salary_payable ?? '',
      reason: currentEmployee.adjustment_reason || '',
      daily_overrides: currentEmployee.daily_overrides ? { ...currentEmployee.daily_overrides } : {},
    });
    setEditableDailyRows(JSON.parse(JSON.stringify(currentEmployee.daily_breakdown || [])));
    setIsEditing(true);
    setSaveError(null);
    setSaveSuccess(null);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  // Helper: auto-calculate salary numbers based on base salary & unpaid absence
  const autoCalculateSalary = () => {
    const base = parseFloat(editForm.monthly_salary) || 0;
    const payableDays = parseFloat(editForm.effective_payable_days) || 1;
    const unpaid = parseFloat(editForm.unpaid_absence_days) || 0;
    const perDay = payableDays > 0 ? Math.round((base / payableDays) * 100) / 100 : 0;
    const deduction = Math.round((unpaid * perDay) * 100) / 100;
    const payable = Math.max(0, Math.round((base - deduction) * 100) / 100);

    setEditForm(prev => ({
      ...prev,
      per_day_salary: perDay,
      salary_deduction: deduction,
      salary_payable: payable
    }));
  };

  // Helper: sync summary metrics from the daily rows
  const syncSummaryFromDaily = () => {
    let present = 0;
    let unpaid = 0;
    let workHrs = 0;
    let screenHrs = 0;
    let casual = 0;
    let optional = 0;
    let otherPaid = 0;

    editableDailyRows.forEach(row => {
      const st = row.attendance_status || '';
      const dt = row.day_type || '';
      const pu = row.paid_unpaid || '';

      if (st.includes('Present') || st === 'WFH Present') present += 1;
      else if (st === 'Half Day') {
        present += 0.5;
        unpaid += 0.5;
      } else if (st.includes('Casual') || dt.includes('Casual')) casual += 1;
      else if (st.includes('Optional') || dt.includes('Optional')) optional += 1;
      else if (pu === 'Paid' && !st.includes('Present')) otherPaid += 1;
      else if (st.includes('Absent') || pu === 'Unpaid') unpaid += 1;

      workHrs += parseFloat(row.working_hours) || 0;
      screenHrs += parseFloat(row.screen_hours) || 0;
    });

    const totalPaid = casual + optional + otherPaid;
    setEditForm(prev => ({
      ...prev,
      present_days: Math.round(present * 10) / 10,
      casual_leave_used: casual,
      optional_leave_used: optional,
      total_paid_leave_used: totalPaid,
      unpaid_absence_days: Math.round(unpaid * 10) / 10,
      actual_working_hours: Math.round(workHrs * 100) / 100,
      actual_screen_time: Math.round(screenHrs * 100) / 100,
    }));
  };

  // Handle inline daily table change
  const handleDailyRowChange = (index, field, value) => {
    setEditableDailyRows(prevRows => {
      const updated = [...prevRows];
      const targetRow = { ...updated[index], [field]: value };
      
      // Auto-set status/paid flags if relevant
      if (field === 'day_type') {
        if (value === 'Casual Leave') {
          targetRow.leave_type = 'Casual Leave';
          targetRow.attendance_status = 'Casual Leave';
          targetRow.paid_unpaid = 'Paid';
        } else if (value === 'Optional Leave') {
          targetRow.leave_type = 'Optional Leave';
          targetRow.attendance_status = 'Optional Leave';
          targetRow.paid_unpaid = 'Paid';
        } else if (value === 'Unpaid Absence') {
          targetRow.attendance_status = 'Absent';
          targetRow.paid_unpaid = 'Unpaid';
        } else if (value === 'Working Day' && targetRow.attendance_status.includes('Absent')) {
          targetRow.attendance_status = 'Present';
          targetRow.paid_unpaid = 'Paid';
        }
      }

      updated[index] = targetRow;

      const rowDate = targetRow.date;
      setEditForm(prev => ({
        ...prev,
        daily_overrides: {
          ...(prev.daily_overrides || {}),
          [rowDate]: {
            ...((prev.daily_overrides && prev.daily_overrides[rowDate]) || {}),
            day_type: targetRow.day_type,
            check_in: targetRow.check_in,
            check_out: targetRow.check_out,
            working_hours: parseFloat(targetRow.working_hours) || 0,
            screen_hours: parseFloat(targetRow.screen_hours) || 0,
            attendance_status: targetRow.attendance_status,
            leave_type: targetRow.leave_type,
            paid_unpaid: targetRow.paid_unpaid,
          }
        }
      }));

      return updated;
    });
  };

  // Submit manual adjustment
  const handleSaveAdjustment = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const payload = {
        year: currentEmployee.year,
        month: currentEmployee.month,
        present_days: editForm.present_days !== '' ? parseFloat(editForm.present_days) : null,
        casual_leave_used: editForm.casual_leave_used !== '' ? parseFloat(editForm.casual_leave_used) : null,
        optional_leave_used: editForm.optional_leave_used !== '' ? parseFloat(editForm.optional_leave_used) : null,
        total_paid_leave_used: editForm.total_paid_leave_used !== '' ? parseFloat(editForm.total_paid_leave_used) : null,
        unpaid_absence_days: editForm.unpaid_absence_days !== '' ? parseFloat(editForm.unpaid_absence_days) : null,
        expected_working_hours: editForm.expected_working_hours !== '' ? parseFloat(editForm.expected_working_hours) : null,
        actual_working_hours: editForm.actual_working_hours !== '' ? parseFloat(editForm.actual_working_hours) : null,
        expected_screen_time: editForm.expected_screen_time !== '' ? parseFloat(editForm.expected_screen_time) : null,
        actual_screen_time: editForm.actual_screen_time !== '' ? parseFloat(editForm.actual_screen_time) : null,
        monthly_salary: editForm.monthly_salary !== '' ? parseFloat(editForm.monthly_salary) : null,
        effective_payable_days: editForm.effective_payable_days !== '' ? parseFloat(editForm.effective_payable_days) : null,
        per_day_salary: editForm.per_day_salary !== '' ? parseFloat(editForm.per_day_salary) : null,
        salary_deduction: editForm.salary_deduction !== '' ? parseFloat(editForm.salary_deduction) : null,
        salary_payable: editForm.salary_payable !== '' ? parseFloat(editForm.salary_payable) : null,
        reason: editForm.reason,
        daily_overrides: editForm.daily_overrides,
      };

      const res = await api.post(
        `/reports/monthly-report/${currentEmployee.employee_id}/override/`,
        payload
      );

      setCurrentEmployee(res.data.report);
      setIsEditing(false);
      setSaveSuccess('Payslip adjusted and saved successfully! The printed slip and monthly report now reflect your corrections.');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to save payslip adjustment:', err);
      setSaveError(err.response?.data?.error || 'Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Reset to system computed values
  const handleResetAdjustment = async () => {
    if (!window.confirm("Are you sure you want to reset this payslip to system computed values? All manual overrides for this month will be removed.")) {
      return;
    }
    setResetting(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await api.delete(
        `/reports/monthly-report/${currentEmployee.employee_id}/override/?year=${currentEmployee.year}&month=${currentEmployee.month}`
      );
      setCurrentEmployee(res.data.report);
      setIsEditing(false);
      setSaveSuccess('Payslip successfully reset to original system computed values.');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to reset payslip adjustment:', err);
      setSaveError(err.response?.data?.error || 'Failed to reset. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      alert('Please allow popups to print the report.');
      return;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Employee Report - ${currentEmployee.employee_name} - ${currentEmployee.month_name} ${currentEmployee.year}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      color: #0f172a;
      background: #fff;
      padding: 20px;
    }

    /* ── Header ── */
    .print-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .print-header .emp-info { display: flex; align-items: center; gap: 14px; }
    .avatar {
      width: 56px; height: 56px; border-radius: 10px;
      background: linear-gradient(135deg, #4f46e5, #6366f1);
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 20px; font-weight: 900;
      overflow: hidden; flex-shrink: 0;
    }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .emp-name { font-size: 18px; font-weight: 900; color: #1e293b; }
    .emp-meta { font-size: 10px; color: #64748b; margin-top: 2px; }
    .emp-badges { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
    .badge {
      padding: 2px 8px; border-radius: 6px; font-size: 9px;
      font-weight: 700; border: 1px solid;
    }
    .badge-id    { background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe; }
    .badge-ok    { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
    .badge-warn  { background:#fffbeb; color:#b45309; border-color:#fde68a; }
    .badge-half  { background:#fff7ed; color:#c2410c; border-color:#fed7aa; }
    .badge-adj   { background:#faf5ff; color:#7e22ce; border-color:#d8b4fe; }

    .report-period { text-align: right; }
    .report-period .label { font-size: 9px; color: #64748b; text-transform: uppercase; font-weight: 700; }
    .report-period .value { font-size: 15px; font-weight: 800; color: #0ea5e9; }

    /* ── Adjustment Notice ── */
    .adj-notice {
      background: #faf5ff; border: 1px solid #d8b4fe; border-radius: 8px;
      padding: 8px 12px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;
    }
    .adj-notice strong { color: #6b21a8; font-size: 10px; text-transform: uppercase; }
    .adj-notice p { font-size: 9.5px; color: #581c87; margin-top: 2px; }

    /* ── Reconciliation Banner ── */
    .recon-banner {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-radius: 10px; margin-bottom: 14px;
      border: 1px solid;
    }
    .recon-ok   { background: #f0fdf4; border-color: #86efac; }
    .recon-warn { background: #fffbeb; border-color: #fde68a; }
    .recon-banner h4 { font-size: 10px; font-weight: 800; text-transform: uppercase; margin-bottom: 2px; }
    .recon-ok h4   { color: #15803d; }
    .recon-warn h4 { color: #b45309; }
    .recon-banner p  { font-size: 10px; color: #475569; }
    .recon-banner .att-rate { font-size: 18px; font-weight: 900; color: #16a34a; }

    /* ── 4-Card Grid ── */
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .card {
      border: 1px solid #e2e8f0; border-radius: 10px;
      padding: 10px; background: #f8fafc;
    }
    .card-title {
      font-size: 9px; font-weight: 800; text-transform: uppercase;
      color: #64748b; letter-spacing: .6px; margin-bottom: 8px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .card-row {
      display: flex; justify-content: space-between; align-items: center;
      font-size: 10px; padding: 2.5px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .card-row:last-child { border-bottom: none; }
    .card-row .lbl { color: #64748b; }
    .card-row .val { font-weight: 700; color: #0f172a; }
    .val-cyan    { color: #0284c7 !important; }
    .val-green   { color: #16a34a !important; }
    .val-indigo  { color: #4338ca !important; }
    .val-rose    { color: #e11d48 !important; }
    .val-violet  { color: #7c3aed !important; }
    .val-amber   { color: #b45309 !important; }

    /* inner box inside card */
    .inner-box {
      border: 1px solid #e2e8f0; border-radius: 7px;
      padding: 6px; margin-bottom: 5px; background: #fff;
    }
    .inner-box .row1 { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; }
    .inner-box .row2 { display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8; margin-top: 3px; }

    /* payable highlight */
    .payable-row {
      display: flex; justify-content: space-between;
      background: #f0fdf4; border: 1px solid #86efac;
      border-radius: 7px; padding: 5px 8px; margin-top: 5px;
    }
    .payable-row .lbl { color: #15803d; font-weight: 800; font-size: 10px; }
    .payable-row .val { color: #16a34a; font-weight: 900; font-size: 13px; font-family: monospace; }

    /* ── Daily Breakdown Table ── */
    .section-title {
      font-size: 11px; font-weight: 900; text-transform: uppercase;
      letter-spacing: .8px; color: #1e293b; margin-bottom: 6px;
    }
    .section-sub { font-size: 9px; color: #64748b; margin-bottom: 8px; }

    table { width: 100%; border-collapse: collapse; }
    thead { background: #1e293b; }
    thead th {
      padding: 6px 8px; text-align: left;
      font-size: 9px; font-weight: 800; color: #f1f5f9;
      text-transform: uppercase; letter-spacing: .5px;
    }
    thead th.r { text-align: right; }
    thead th.c { text-align: center; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr.unpaid-row { background: #fff1f2; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody tr.unpaid-row:nth-child(even) { background: #ffe4e6; }
    tbody td { padding: 4.5px 8px; font-size: 9.5px; color: #334155; }
    tbody td.bold { font-weight: 700; color: #0f172a; }
    tbody td.r { text-align: right; font-family: monospace; }
    tbody td.c { text-align: center; }
    tbody td.cyan   { color: #0284c7; font-weight: 700; }
    tbody td.violet { color: #7c3aed; font-weight: 700; }

    /* status pills */
    .pill {
      display: inline-block; padding: 1px 6px; border-radius: 5px;
      font-size: 9px; font-weight: 700; border: 1px solid;
    }
    .pill-present { background:#f0fdf4; color:#16a34a; border-color:#86efac; }
    .pill-late    { background:#fffbeb; color:#b45309; border-color:#fde68a; }
    .pill-leave   { background:#eef2ff; color:#4338ca; border-color:#c7d2fe; }
    .pill-absent  { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
    .pill-paid    { background:#f0fdf4; color:#16a34a; border-color:#86efac; }
    .pill-unpaid  { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
    .pill-halfpaid{ background:#fff7ed; color:#c2410c; border-color:#fed7aa; }
    .pill-sun     { background:#fff1f2; color:#be123c; border-color:#fecdd3; }
    .pill-sat     { background:#fffbeb; color:#b45309; border-color:#fde68a; }
    .pill-hol     { background:#f5f3ff; color:#5b21b6; border-color:#ddd6fe; }
    .pill-opt     { background:#faf5ff; color:#6d28d9; border-color:#e9d5ff; }
    .pill-casual  { background:#eef2ff; color:#3730a3; border-color:#c7d2fe; }
    .pill-wday    { background:#f0f9ff; color:#0369a1; border-color:#bae6fd; }
    .pill-pre     { background:#f8fafc; color:#64748b; border-color:#e2e8f0; }
    .pill-halfday { background:#fff7ed; color:#c2410c; border-color:#fed7aa; }

    /* ── Footer ── */
    .print-footer {
      margin-top: 14px; padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      font-size: 9px; color: #94a3b8;
      display: flex; justify-content: space-between;
    }

    @media print {
      body { padding: 10px; }
      .cards-grid { grid-template-columns: repeat(4, 1fr) !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="print-header">
    <div class="emp-info">
      <div class="avatar">
        ${currentEmployee.profile_photo
          ? `<img src="${currentEmployee.profile_photo}" alt="${currentEmployee.employee_name}" />`
          : currentEmployee.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)
        }
      </div>
      <div>
        <div class="emp-name">${currentEmployee.employee_name}</div>
        <div class="emp-meta">${currentEmployee.department} &bull; ${currentEmployee.designation} &bull; ${currentEmployee.email}</div>
        <div class="emp-badges">
          <span class="badge badge-id">${currentEmployee.employee_id}</span>
          ${currentEmployee.is_adjusted
            ? `<span class="badge badge-adj">&#9881; Rectified by ${currentEmployee.adjusted_by_name || 'Management'}</span>`
            : ''}
          ${currentEmployee.is_reconciled
            ? `<span class="badge badge-ok">&#10003; Reconciled</span>`
            : `<span class="badge badge-warn">&#9888; Audit Flag</span>`}
          ${currentEmployee.is_half_day
            ? `<span class="badge badge-half">Half Day Employee</span>`
            : ''}
        </div>
      </div>
    </div>
    <div class="report-period">
      <div class="label">Report Period</div>
      <div class="value">${currentEmployee.month_name} ${currentEmployee.year}</div>
    </div>
  </div>

  ${currentEmployee.is_adjusted ? `
  <div class="adj-notice">
    <div>
      <strong>&#9881; Payslip Rectified / Adjusted by ${currentEmployee.adjusted_by_name || 'Management'}</strong>
      <p>${currentEmployee.adjustment_reason ? `Reason: <em>"${currentEmployee.adjustment_reason}"</em>` : 'Manual corrections applied to attendance &amp; salary computation.'}</p>
    </div>
    <div style="font-size:9px;color:#7e22ce;font-weight:700">Official HR Approved Record</div>
  </div>
  ` : ''}

  <!-- Reconciliation Banner -->
  ${currentEmployee.is_reconciled ? `
  <div class="recon-banner recon-ok">
    <div>
      <h4>&#10003; Attendance Reconciled</h4>
      <p>
        <strong style="color:#15803d">${currentEmployee.present_days} Present</strong> +
        <strong style="color:#4338ca">${currentEmployee.total_paid_leave_used} Paid Leave</strong> +
        <strong style="color:#e11d48">${currentEmployee.unpaid_absence_days} Unpaid Absence</strong> =
        <strong>${currentEmployee.company_working_days} Scheduled Working Days</strong>
      </p>
    </div>
    <div style="text-align:right">
      <div style="font-size:9px;color:#64748b;">Attendance Rate</div>
      <div class="att-rate">${currentEmployee.final_attendance_percentage}%</div>
    </div>
  </div>
  ` : `
  <div class="recon-banner recon-warn">
    <div>
      <h4>&#9888; Reconciliation Audit Notice</h4>
      <p>${currentEmployee.inconsistency_warning || ''}</p>
    </div>
  </div>
  `}

  <!-- 4 Summary Cards -->
  <div class="cards-grid">

    <!-- Card 1: Attendance -->
    <div class="card">
      <div class="card-title">Attendance Breakdown <span>&#128197;</span></div>
      <div class="card-row"><span class="lbl">Calendar Days:</span><span class="val">${currentEmployee.calendar_days} days</span></div>
      <div class="card-row"><span class="lbl">Sundays / 2nd Sat:</span><span class="val">${currentEmployee.sundays} Sun / ${currentEmployee.second_saturdays} Sat</span></div>
      <div class="card-row"><span class="lbl">Company Working Days:</span><span class="val val-cyan">${currentEmployee.company_working_days} days</span></div>
      <div class="card-row"><span class="lbl" style="color:#16a34a">Present Days:</span><span class="val val-green">${currentEmployee.present_days} days</span></div>
      <div class="card-row"><span class="lbl" style="color:#4338ca">Paid Leave Days:</span><span class="val val-indigo">${currentEmployee.total_paid_leave_used} days</span></div>
      <div class="card-row"><span class="lbl" style="color:#e11d48">Unpaid Absence:</span><span class="val val-rose">${currentEmployee.unpaid_absence_days} days</span></div>
    </div>

    <!-- Card 2: Leave Balances -->
    <div class="card">
      <div class="card-title">Leave Balances <span>&#128196;</span></div>
      <div class="inner-box">
        <div class="row1"><span style="color:#6d28d9">Optional Festival Leave:</span><span style="color:#6d28d9">${currentEmployee.optional_leave_used} Used</span></div>
        <div class="row2"><span>Entitlement: ${currentEmployee.leave_balances?.optional_leave_entitlement ?? 1}</span><span>Remaining: ${currentEmployee.leave_balances?.optional_leave_remaining ?? 0}</span></div>
      </div>
      <div class="inner-box">
        <div class="row1"><span style="color:#3730a3">Casual Leave:</span><span style="color:#3730a3">${currentEmployee.casual_leave_used} Used</span></div>
        <div class="row2"><span>Entitlement: ${currentEmployee.leave_balances?.casual_leave_entitlement ?? 12}</span><span>Remaining: ${currentEmployee.leave_balances?.casual_leave_remaining ?? 12}</span></div>
      </div>
      <div class="card-row" style="padding-top:4px"><span class="lbl">Total Paid Leave:</span><span class="val">${currentEmployee.total_paid_leave_used} days</span></div>
    </div>

    <!-- Card 3: Time Metrics -->
    <div class="card">
      <div class="card-title">Time Metrics <span>&#9200;</span></div>
      <div class="inner-box">
        <div class="row1">
          <span>&#9200; Working Time</span>
          <span style="color:${currentEmployee.working_hour_difference >= 0 ? '#16a34a' : '#b45309'}">
            ${currentEmployee.working_hour_difference >= 0 ? '+' : ''}${currentEmployee.working_hour_difference}h
          </span>
        </div>
        <div class="row2"><span>Expected: ${currentEmployee.expected_working_hours}h</span><span><strong>Actual: ${currentEmployee.actual_working_hours}h</strong></span></div>
      </div>
      <div class="inner-box">
        <div class="row1">
          <span>&#128201; Screen Time</span>
          <span style="color:${currentEmployee.screen_time_difference >= 0 ? '#16a34a' : '#b45309'}">
            ${currentEmployee.screen_time_difference >= 0 ? '+' : ''}${currentEmployee.screen_time_difference}h
          </span>
        </div>
        <div class="row2"><span>Expected: ${currentEmployee.expected_screen_time}h</span><span><strong>Actual: ${currentEmployee.actual_screen_time}h</strong></span></div>
      </div>
      <div style="font-size:9px;color:#94a3b8;display:flex;justify-content:space-between;padding-top:3px">
        <span>Avg Work/Day: ${currentEmployee.avg_working_hours_per_present}h</span>
        <span>Avg Screen/Day: ${currentEmployee.avg_screen_time_per_present}h</span>
      </div>
    </div>

    <!-- Card 4: Salary Computation -->
    <div class="card">
      <div class="card-title">Salary Computation <span>&#128176;</span></div>
      <div class="card-row"><span class="lbl">Monthly Base Salary:</span><span class="val">&#8377;${Number(currentEmployee.monthly_salary).toLocaleString('en-IN')}</span></div>
      <div class="card-row"><span class="lbl">Effective Payable Days:</span><span class="val val-cyan">${currentEmployee.effective_payable_days} days</span></div>
      <div class="card-row"><span class="lbl">Per-Day Salary:</span><span class="val">&#8377;${Number(currentEmployee.per_day_salary).toLocaleString('en-IN')}</span></div>
      <div class="card-row"><span class="lbl val-rose">Salary Deduction (${currentEmployee.unpaid_absence_days}d):</span><span class="val val-rose">-&#8377;${Number(currentEmployee.salary_deduction).toLocaleString('en-IN')}</span></div>
      <div class="payable-row"><span class="lbl">Salary Payable:</span><span class="val">&#8377;${Number(currentEmployee.salary_payable).toLocaleString('en-IN')}</span></div>
    </div>
  </div>

  <!-- Daily Breakdown -->
  <div class="section-title">Daily Attendance, Working Hours &amp; Screen Time Log</div>
  <div class="section-sub">Day-by-day complete record of check-in, check-out, active screen time, and leave classifications.</div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Day</th>
        <th>Day Type</th>
        <th>Check In</th>
        <th>Check Out</th>
        <th class="r">Working Time</th>
        <th class="r">Screen Time</th>
        <th>Attendance Status</th>
        <th>Leave Type</th>
        <th class="c">Paid / Unpaid</th>
      </tr>
    </thead>
    <tbody>
      ${(currentEmployee.daily_breakdown || []).map(d => {
        const isUnpaid = d.paid_unpaid === 'Unpaid';
        const rowClass = isUnpaid ? 'unpaid-row' : '';

        let dayTypePill = '';
        switch (d.day_type) {
          case 'SUNDAY': dayTypePill = `<span class="pill pill-sun">Sunday</span>`; break;
          case 'SECOND_SATURDAY': dayTypePill = `<span class="pill pill-sat">2nd Saturday</span>`; break;
          case 'COMPANY_HOLIDAY': dayTypePill = `<span class="pill pill-hol">Holiday</span>`; break;
          case 'Optional Leave': dayTypePill = `<span class="pill pill-opt">Optional Leave</span>`; break;
          case 'Casual Leave': dayTypePill = `<span class="pill pill-casual">Casual Leave</span>`; break;
          case 'Other Paid Leave': dayTypePill = `<span class="pill pill-casual">Paid Leave</span>`; break;
          case 'Unpaid Absence': dayTypePill = `<span class="pill pill-unpaid">Unpaid Absence</span>`; break;
          case 'Half Day': dayTypePill = `<span class="pill pill-halfday">Half Day</span>`; break;
          case 'PRE_JOINING': dayTypePill = `<span class="pill pill-pre">Pre-Joining</span>`; break;
          default: dayTypePill = `<span class="pill pill-wday">Working Day</span>`; break;
        }

        let statusPill = '';
        const st = d.attendance_status || '';
        if (st.includes('Present') || st === 'WFH Present') statusPill = `<span class="pill pill-present">${st}</span>`;
        else if (st.includes('Late')) statusPill = `<span class="pill pill-late">${st}</span>`;
        else if (st.includes('Leave') || st === 'Casual Leave' || st === 'Optional Leave') statusPill = `<span class="pill pill-leave">${st}</span>`;
        else if (st.includes('Absent') || st === 'Unpaid Absence' || st === 'Unpaid Leave') statusPill = `<span class="pill pill-absent">Absent</span>`;
        else statusPill = `<span style="color:#64748b">${st}</span>`;

        let paidPill = '';
        if (d.paid_unpaid === 'Paid') paidPill = `<span class="pill pill-paid">Paid</span>`;
        else if (d.paid_unpaid === 'Unpaid') paidPill = `<span class="pill pill-unpaid">Unpaid</span>`;
        else if (d.paid_unpaid === 'Half Paid') paidPill = `<span class="pill pill-halfpaid">Half Paid</span>`;
        else paidPill = `<span style="color:#94a3b8">-</span>`;

        return `
        <tr class="${rowClass}">
          <td class="bold">${d.date_formatted || d.date}</td>
          <td>${d.day_name}</td>
          <td>${dayTypePill}</td>
          <td style="font-family:monospace">${d.check_in || '-'}</td>
          <td style="font-family:monospace">${d.missing_checkout ? '<span style="color:#e11d48;font-weight:700">Missing</span>' : (d.check_out || '-')}</td>
          <td class="r cyan">${d.working_hours > 0 ? d.working_hours + ' hrs' : '-'}</td>
          <td class="r violet">${d.missing_screentime ? '<span style="color:#b45309;font-size:8.5px">No Track</span>' : (d.screen_hours > 0 ? d.screen_hours + ' hrs' : '-')}</td>
          <td>${statusPill}</td>
          <td>${d.leave_type !== '-' ? `<span style="color:#4338ca;font-weight:600">${d.leave_type}</span>` : '<span style="color:#94a3b8">-</span>'}</td>
          <td class="c">${paidPill}</td>
        </tr>`;
      }).join('')}
    </tbody>
  </table>

  <!-- Footer -->
  <div class="print-footer">
    <span>Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</span>
    <span>Document ID: FRG-PAYSLIP-${currentEmployee.employee_id}-${currentEmployee.month}${currentEmployee.year}</span>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() { window.close(); };
    };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const activeDailyRows = isEditing ? editableDailyRows : (currentEmployee.daily_breakdown || []);

  const filteredDays = activeDailyRows.filter(d => {
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
    if (status.includes('Present') || status === 'Present' || status === 'WFH Present') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">{status}</span>;
    }
    if (status.includes('Late')) {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30">{status}</span>;
    }
    if (status.includes('Leave')) {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">{status}</span>;
    }
    if (status.includes('Absent') || status === 'Unpaid Absence' || status === 'Unpaid Leave') {
      return <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">Absent</span>;
    }
    return <span className="text-slate-400 text-xs">{status}</span>;
  };

  const balances = currentEmployee.leave_balances || {};

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-6">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Top Header / Employee Profile */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-600 border-2 border-indigo-400/40 flex items-center justify-center text-white font-extrabold text-xl shadow-lg overflow-hidden shrink-0">
              {currentEmployee.profile_photo ? (
                <img src={currentEmployee.profile_photo} alt={currentEmployee.employee_name} className="w-full h-full object-cover rounded-2xl" />
              ) : (
                currentEmployee.employee_name.split(' ').map(n => n[0]).join('').substring(0, 2)
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-extrabold text-white tracking-tight">{currentEmployee.employee_name}</h2>
                <span className="px-2 py-0.5 text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg">
                  {currentEmployee.employee_id}
                </span>
                {currentEmployee.is_adjusted && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg shadow-sm" title={`Adjusted by ${currentEmployee.adjusted_by_name || 'Management'}`}>
                    <Sparkles className="w-3 h-3 text-purple-400" /> Rectified Slip
                  </span>
                )}
                {currentEmployee.is_half_day && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg">
                    Half Day Employee
                  </span>
                )}
                {currentEmployee.is_reconciled ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="w-3 h-3" /> Reconciled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                    <AlertTriangle className="w-3 h-3" /> Audit Flag
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentEmployee.department} • {currentEmployee.designation} • {currentEmployee.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="text-right mr-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">Report Period</span>
              <span className="text-sm font-bold text-cyan-400">{currentEmployee.month_name} {currentEmployee.year}</span>
            </div>

            {/* CEO / HR Edit Mode Trigger & Action Controls */}
            {isManagement && (
              <>
                {!isEditing ? (
                  <button
                    onClick={startEditing}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl border border-indigo-500 flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
                    title="Rectify errors or edit payslip fields"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Payslip</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={cancelEditing}
                      disabled={saving}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveAdjustment}
                      disabled={saving}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-500 flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/25"
                    >
                      <Save className="w-4 h-4" />
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                )}
              </>
            )}

            <button
              onClick={handlePrint}
              disabled={isEditing}
              className={`px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-colors shadow ${
                isEditing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
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

        {/* Edit Mode Notice & Quick Tools Banner */}
        {isEditing && (
          <div className="px-6 py-3.5 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-indigo-950/70 border-b border-indigo-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                <Sliders className="w-4 h-4" />
              </span>
              <div>
                <p className="font-bold text-white">CEO / HR Rectification Mode Active</p>
                <p className="text-slate-400 text-[11px]">Edit any monthly summary counts or fine-tune daily punches below. Saved adjustments automatically update the printed slip and payroll.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={syncSummaryFromDaily}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold rounded-lg border border-cyan-500/30 flex items-center gap-1.5 transition-colors"
                title="Recalculate summary cards from edited daily log below"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Sync From Daily Rows</span>
              </button>
              <button
                type="button"
                onClick={autoCalculateSalary}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-semibold rounded-lg border border-emerald-500/30 flex items-center gap-1.5 transition-colors"
                title="Auto-calculate Per-Day Salary, Deduction, and Payable based on Base Salary and Unpaid Days"
              >
                <Calculator className="w-3.5 h-3.5 text-emerald-400" />
                <span>Auto-Calc Salary</span>
              </button>
            </div>
          </div>
        )}

        {/* Success or Error Notifications */}
        {saveSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
            <button onClick={() => setSaveSuccess(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {saveError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scrollable Modal Content */}
        <div ref={printRef} className="p-6 overflow-y-auto space-y-6">
          
          {/* Active Adjustment Information Banner */}
          {currentEmployee.is_adjusted && !isEditing && (
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Payslip Manually Rectified &amp; Approved
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Adjusted by <span className="font-semibold text-white">{currentEmployee.adjusted_by_name || 'Management'}</span> on{' '}
                    <span className="font-mono text-purple-200">{new Date(currentEmployee.adjusted_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>.
                    {currentEmployee.adjustment_reason ? ` Reason: "${currentEmployee.adjustment_reason}"` : ''}
                  </p>
                </div>
              </div>

              {isManagement && (
                <button
                  onClick={handleResetAdjustment}
                  disabled={resetting}
                  className="px-3 py-1.5 bg-purple-950/60 hover:bg-rose-950/60 text-purple-300 hover:text-rose-300 border border-purple-500/30 hover:border-rose-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                  title="Remove manual adjustments and recalculate from raw data"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{resetting ? 'Resetting...' : 'Reset to System Computed'}</span>
                </button>
              )}
            </div>
          )}

          {/* Reconciliation & Inconsistency Banner */}
          {currentEmployee.is_reconciled ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">Attendance Reconciled</h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <span className="font-semibold text-emerald-400">{currentEmployee.present_days} Present</span> +{' '}
                    <span className="font-semibold text-indigo-300">{currentEmployee.total_paid_leave_used} Paid Leave</span> +{' '}
                    <span className="font-semibold text-rose-400">{currentEmployee.unpaid_absence_days} Unpaid Absence</span> ={' '}
                    <span className="font-bold text-white">{currentEmployee.company_working_days} Scheduled Working Days</span>.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Attendance Rate</span>
                <p className="text-lg font-extrabold text-emerald-400">{currentEmployee.final_attendance_percentage}%</p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Reconciliation Audit Notice</h4>
                <p className="text-xs text-slate-300 mt-0.5">{currentEmployee.inconsistency_warning}</p>
              </div>
            </div>
          )}

          {/* 4 Summary Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Card 1: Attendance Summary */}
            <div className={`p-4 rounded-2xl bg-slate-900/80 border space-y-3 ${isEditing ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Attendance Breakdown</span>
                <Calendar className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Calendar Days:</span>
                  <span className="font-semibold text-slate-200">{currentEmployee.calendar_days} days</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Sundays / 2nd Sat:</span>
                  <span className="font-semibold text-slate-200">{currentEmployee.sundays} Sun / {currentEmployee.second_saturdays} Sat</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Company Working Days:</span>
                  <span className="font-bold text-cyan-400">{currentEmployee.company_working_days} days</span>
                </div>
                
                {/* Present Days */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-emerald-400 font-medium">Present Days:</span>
                  {!isEditing ? (
                    <span className="font-bold text-emerald-400">{currentEmployee.present_days} days</span>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={currentEmployee.calendar_days}
                      value={editForm.present_days}
                      onChange={(e) => setEditForm({ ...editForm, present_days: e.target.value })}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-emerald-500/50 rounded text-right font-bold text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                    />
                  )}
                </div>

                {/* Paid Leave Days */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-indigo-400 font-medium">Paid Leave Days:</span>
                  {!isEditing ? (
                    <span className="font-bold text-indigo-300">{currentEmployee.total_paid_leave_used} days</span>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.total_paid_leave_used}
                      onChange={(e) => setEditForm({ ...editForm, total_paid_leave_used: e.target.value })}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-indigo-500/50 rounded text-right font-bold text-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    />
                  )}
                </div>

                {/* Unpaid Absence */}
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-rose-400 font-medium">Unpaid Absence:</span>
                  {!isEditing ? (
                    <span className="font-bold text-rose-400">{currentEmployee.unpaid_absence_days} days</span>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={editForm.unpaid_absence_days}
                      onChange={(e) => setEditForm({ ...editForm, unpaid_absence_days: e.target.value })}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-rose-500/50 rounded text-right font-bold text-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Leave Summary & Entitlements */}
            <div className={`p-4 rounded-2xl bg-slate-900/80 border space-y-3 ${isEditing ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Leave Balances</span>
                <FileText className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="space-y-2 text-xs">
                
                {/* Optional Festival Leave */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between items-center font-semibold text-violet-300 text-[11px]">
                    <span>Optional Festival Leave:</span>
                    {!isEditing ? (
                      <span>{currentEmployee.optional_leave_used} Used this month</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editForm.optional_leave_used}
                          onChange={(e) => setEditForm({ ...editForm, optional_leave_used: e.target.value })}
                          className="w-14 px-1.5 py-0.5 bg-slate-900 border border-violet-500/40 rounded text-right font-bold text-violet-300"
                        />
                        <span className="text-[10px] text-slate-400">Used</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Entitlement: {balances.optional_leave_entitlement ?? 1}</span>
                    <span>Remaining: {balances.optional_leave_remaining ?? 0}</span>
                  </div>
                </div>

                {/* Casual Leave */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between items-center font-semibold text-indigo-300 text-[11px]">
                    <span>Casual Leave:</span>
                    {!isEditing ? (
                      <span>{currentEmployee.casual_leave_used} Used this month</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={editForm.casual_leave_used}
                          onChange={(e) => setEditForm({ ...editForm, casual_leave_used: e.target.value })}
                          className="w-14 px-1.5 py-0.5 bg-slate-900 border border-indigo-500/40 rounded text-right font-bold text-indigo-300"
                        />
                        <span className="text-[10px] text-slate-400">Used</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-slate-400 mt-1 text-[10px]">
                    <span>Entitlement: {balances.casual_leave_entitlement ?? 12}</span>
                    <span>Remaining: {balances.casual_leave_remaining ?? 12}</span>
                  </div>
                </div>

                <div className="flex justify-between text-xs pt-1">
                  <span className="text-slate-400">Total Paid Leave:</span>
                  <span className="font-bold text-white">
                    {isEditing ? (Number(editForm.total_paid_leave_used) || 0) : currentEmployee.total_paid_leave_used} days
                  </span>
                </div>
              </div>
            </div>

            {/* Card 3: Working Hours vs Screen Time */}
            <div className={`p-4 rounded-2xl bg-slate-900/80 border space-y-3 ${isEditing ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Time Metrics</span>
                <Clock className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="space-y-2 text-xs">
                
                {/* Working Hours */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-cyan-400" /> Working Time</span>
                    <span className={`font-mono ${currentEmployee.working_hour_difference >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {currentEmployee.working_hour_difference >= 0 ? `+${currentEmployee.working_hour_difference}` : currentEmployee.working_hour_difference}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 mt-1.5 text-[10px]">
                    <span>Expected: {currentEmployee.expected_working_hours}h</span>
                    {!isEditing ? (
                      <span className="font-bold text-white">Actual: {currentEmployee.actual_working_hours}h</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Actual:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={editForm.actual_working_hours}
                          onChange={(e) => setEditForm({ ...editForm, actual_working_hours: e.target.value })}
                          className="w-16 px-1 py-0.5 bg-slate-900 border border-cyan-500/40 rounded text-right font-bold text-cyan-400"
                        />
                        <span>h</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Screen Time */}
                <div className="p-2 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div className="flex justify-between font-semibold text-slate-300 text-[11px]">
                    <span className="flex items-center gap-1"><Monitor className="w-3 h-3 text-violet-400" /> Screen Time</span>
                    <span className={`font-mono ${currentEmployee.screen_time_difference >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {currentEmployee.screen_time_difference >= 0 ? `+${currentEmployee.screen_time_difference}` : currentEmployee.screen_time_difference}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-400 mt-1.5 text-[10px]">
                    <span>Expected: {currentEmployee.expected_screen_time}h</span>
                    {!isEditing ? (
                      <span className="font-bold text-white">Actual: {currentEmployee.actual_screen_time}h</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400">Actual:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          value={editForm.actual_screen_time}
                          onChange={(e) => setEditForm({ ...editForm, actual_screen_time: e.target.value })}
                          className="w-16 px-1 py-0.5 bg-slate-900 border border-violet-500/40 rounded text-right font-bold text-violet-300"
                        />
                        <span>h</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between text-[10px] text-slate-400 pt-0.5">
                  <span>Avg Work/Day: {currentEmployee.avg_working_hours_per_present}h</span>
                  <span>Avg Screen/Day: {currentEmployee.avg_screen_time_per_present}h</span>
                </div>
              </div>
            </div>

            {/* Card 4: Salary Computation */}
            <div className={`p-4 rounded-2xl bg-slate-900/80 border space-y-3 ${isEditing ? 'border-indigo-500/50 ring-1 ring-indigo-500/30' : 'border-slate-800'}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Salary Computation</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="space-y-1.5 text-xs">
                
                {/* Monthly Base Salary */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Base Salary:</span>
                  {!isEditing ? (
                    <span className="font-semibold text-white">₹{Number(currentEmployee.monthly_salary).toLocaleString('en-IN')}</span>
                  ) : (
                    <input
                      type="number"
                      step="100"
                      min="0"
                      value={editForm.monthly_salary}
                      onChange={(e) => setEditForm({ ...editForm, monthly_salary: e.target.value })}
                      className="w-24 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-bold text-white"
                    />
                  )}
                </div>

                {/* Effective Payable Days */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Payable Days:</span>
                  {!isEditing ? (
                    <span className="font-semibold text-cyan-400">{currentEmployee.effective_payable_days} days</span>
                  ) : (
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      value={editForm.effective_payable_days}
                      onChange={(e) => setEditForm({ ...editForm, effective_payable_days: e.target.value })}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-cyan-500/40 rounded text-right font-bold text-cyan-400"
                    />
                  )}
                </div>

                {/* Per-Day Salary */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-slate-400">Per-Day Salary:</span>
                  {!isEditing ? (
                    <span className="font-mono text-slate-200">₹{Number(currentEmployee.per_day_salary).toLocaleString('en-IN')}</span>
                  ) : (
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.per_day_salary}
                      onChange={(e) => setEditForm({ ...editForm, per_day_salary: e.target.value })}
                      className="w-20 px-2 py-0.5 bg-slate-950 border border-slate-700 rounded text-right font-mono text-slate-200"
                    />
                  )}
                </div>

                {/* Salary Deduction */}
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800/80">
                  <span className="text-rose-400 font-medium">Salary Deduction:</span>
                  {!isEditing ? (
                    <span className="font-mono font-bold text-rose-400">-₹{Number(currentEmployee.salary_deduction).toLocaleString('en-IN')}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-rose-400 font-bold">-₹</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editForm.salary_deduction}
                        onChange={(e) => setEditForm({ ...editForm, salary_deduction: e.target.value })}
                        className="w-20 px-2 py-0.5 bg-slate-950 border border-rose-500/40 rounded text-right font-mono font-bold text-rose-400"
                      />
                    </div>
                  )}
                </div>

                {/* Salary Payable */}
                <div className="flex justify-between items-center py-1 bg-emerald-500/10 px-2 rounded-lg border border-emerald-500/20">
                  <span className="text-emerald-300 font-bold">Salary Payable:</span>
                  {!isEditing ? (
                    <span className="font-mono font-extrabold text-emerald-400 text-sm">₹{Number(currentEmployee.salary_payable).toLocaleString('en-IN')}</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-400 font-bold">₹</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editForm.salary_payable}
                        onChange={(e) => setEditForm({ ...editForm, salary_payable: e.target.value })}
                        className="w-24 px-2 py-0.5 bg-slate-950 border border-emerald-500 rounded text-right font-mono font-extrabold text-emerald-400 text-sm"
                      />
                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>

          {/* Adjustment Reason & Notes Input (in Edit Mode) */}
          {isEditing && (
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300">
                Rectification Reason / Audit Note (Required for HR/Finance records)
              </label>
              <input
                type="text"
                placeholder="e.g. Corrected missed biometric punch on Sep 5th and adjusted offline client meeting hours"
                value={editForm.reason || ''}
                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Daily Breakdown Table Header & Filter Tabs */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Daily Attendance, Working Hours &amp; Screen Time Log</span>
                  {isEditing && (
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Editable Mode
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-400">
                  {isEditing 
                    ? 'Directly adjust status, punch times, or hours for any specific date. Click "Sync From Daily Rows" above to aggregate into summary cards.'
                    : 'Day-by-day complete record of check-in, check-out, active screen time, and leave classifications.'}
                </p>
              </div>

              {/* Day Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setDayFilter('ALL')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Days ({currentEmployee.calendar_days})
                </button>
                <button
                  type="button"
                  onClick={() => setDayFilter('WORKING')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'WORKING' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Working Days ({currentEmployee.company_working_days})
                </button>
                <button
                  type="button"
                  onClick={() => setDayFilter('LEAVES_ABSENCE')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                    dayFilter === 'LEAVES_ABSENCE' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Leaves &amp; Absences
                </button>
              </div>
            </div>

            {/* Daily Table */}
            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-900/60">
              <div className="overflow-x-auto max-h-[44vh]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/90 text-[11px] font-extrabold text-slate-400 uppercase tracking-wider sticky top-0 z-10">
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
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredDays.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="text-center py-8 text-slate-500">No records matching the selected day filter.</td>
                      </tr>
                    ) : (
                      filteredDays.map((d, index) => {
                        // Find true index in editableDailyRows for mutation
                        const rawIndex = activeDailyRows.findIndex(r => r.date === d.date);

                        return (
                          <tr 
                            key={d.date} 
                            className={`hover:bg-slate-800/40 transition-colors ${
                              d.paid_unpaid === 'Unpaid' ? 'bg-rose-500/5' : ''
                            } ${isEditing && editForm.daily_overrides?.[d.date] ? 'bg-purple-950/20' : ''}`}
                          >
                            <td className="px-3.5 py-2.5 font-bold text-white whitespace-nowrap">
                              {d.date_formatted || d.date}
                            </td>
                            <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">
                              {d.day_name}
                            </td>
                            
                            {/* Day Type */}
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              {!isEditing ? (
                                getDayTypeBadge(d.day_type)
                              ) : (
                                <select
                                  value={d.day_type || 'Working Day'}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'day_type', e.target.value)}
                                  className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-indigo-400"
                                >
                                  <option value="Working Day">Working Day</option>
                                  <option value="Casual Leave">Casual Leave</option>
                                  <option value="Optional Leave">Optional Leave</option>
                                  <option value="Other Paid Leave">Other Paid Leave</option>
                                  <option value="Half Day">Half Day</option>
                                  <option value="Unpaid Absence">Unpaid Absence</option>
                                  <option value="SUNDAY">Sunday</option>
                                  <option value="SECOND_SATURDAY">2nd Saturday</option>
                                  <option value="COMPANY_HOLIDAY">Company Holiday</option>
                                </select>
                              )}
                            </td>

                            {/* Check In */}
                            <td className="px-3 py-2.5 font-mono text-[11px] text-slate-300">
                              {!isEditing ? (
                                d.check_in || '-'
                              ) : (
                                <input
                                  type="text"
                                  placeholder="09:30:00"
                                  value={d.check_in || ''}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'check_in', e.target.value)}
                                  className="w-20 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-[11px] text-slate-200"
                                />
                              )}
                            </td>

                            {/* Check Out */}
                            <td className="px-3 py-2.5 font-mono text-[11px]">
                              {!isEditing ? (
                                d.missing_checkout ? (
                                  <span className="text-rose-400 font-bold" title="Missing Check-out">Missing Checkout</span>
                                ) : (
                                  <span className="text-slate-300">{d.check_out || '-'}</span>
                                )
                              ) : (
                                <input
                                  type="text"
                                  placeholder="18:30:00"
                                  value={d.check_out || ''}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'check_out', e.target.value)}
                                  className="w-20 px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-[11px] text-slate-200"
                                />
                              )}
                            </td>

                            {/* Working Hours */}
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-cyan-400">
                              {!isEditing ? (
                                d.working_hours > 0 ? `${d.working_hours} hrs` : '-'
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={d.working_hours ?? ''}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'working_hours', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 bg-slate-950 border border-cyan-500/40 rounded text-right font-mono text-cyan-400"
                                />
                              )}
                            </td>

                            {/* Screen Time */}
                            <td className="px-3 py-2.5 text-right font-mono font-semibold text-violet-300">
                              {!isEditing ? (
                                d.missing_screentime ? (
                                  <span className="text-amber-400 font-medium text-[10px]" title="No screen activity recorded">No Track</span>
                                ) : d.screen_hours > 0 ? (
                                  `${d.screen_hours} hrs`
                                ) : (
                                  '-'
                                )
                              ) : (
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={d.screen_hours ?? ''}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'screen_hours', e.target.value)}
                                  className="w-16 px-1.5 py-0.5 bg-slate-950 border border-violet-500/40 rounded text-right font-mono text-violet-300"
                                />
                              )}
                            </td>

                            {/* Attendance Status */}
                            <td className="px-3.5 py-2.5 whitespace-nowrap">
                              {!isEditing ? (
                                getStatusBadge(d.attendance_status)
                              ) : (
                                <select
                                  value={d.attendance_status || 'Present'}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'attendance_status', e.target.value)}
                                  className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs focus:ring-1 focus:ring-emerald-400"
                                >
                                  <option value="Present">Present</option>
                                  <option value="Late Arrival">Late Arrival</option>
                                  <option value="WFH Present">WFH Present</option>
                                  <option value="Half Day">Half Day</option>
                                  <option value="Casual Leave">Casual Leave</option>
                                  <option value="Optional Leave">Optional Leave</option>
                                  <option value="Paid Leave">Paid Leave</option>
                                  <option value="Absent">Absent</option>
                                  <option value="Unpaid Leave">Unpaid Leave</option>
                                </select>
                              )}
                            </td>

                            {/* Leave Type */}
                            <td className="px-3.5 py-2.5 text-slate-300 whitespace-nowrap">
                              {d.leave_type !== '-' ? (
                                <span className="font-semibold text-indigo-300">{d.leave_type}</span>
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>

                            {/* Paid / Unpaid */}
                            <td className="px-3 py-2.5 text-center whitespace-nowrap">
                              {!isEditing ? (
                                <>
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
                                </>
                              ) : (
                                <select
                                  value={d.paid_unpaid || 'Paid'}
                                  onChange={(e) => handleDailyRowChange(rawIndex, 'paid_unpaid', e.target.value)}
                                  className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-1.5 py-1 text-xs"
                                >
                                  <option value="Paid">Paid</option>
                                  <option value="Unpaid">Unpaid</option>
                                  <option value="Half Paid">Half Paid</option>
                                  <option value="-">-</option>
                                </select>
                              )}
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between shrink-0">
          <div>
            {currentEmployee.is_adjusted && isManagement && !isEditing && (
              <button
                onClick={handleResetAdjustment}
                disabled={resetting}
                className="px-3.5 py-2 bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 text-xs font-semibold rounded-xl border border-slate-800 hover:border-rose-500/40 transition-colors flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{resetting ? 'Resetting...' : 'Reset to System Calculation'}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
                >
                  Discard Changes
                </button>
                <button
                  type="button"
                  onClick={handleSaveAdjustment}
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving Adjustments...' : 'Save & Update Payslip'}</span>
                </button>
              </>
            ) : (
              <>
                {isManagement && (
                  <button
                    onClick={startEditing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Edit Payslip</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  Close Report
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeMonthlyDetailModal;
