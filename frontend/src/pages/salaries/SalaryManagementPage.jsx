import React, { useState, useEffect, useRef } from 'react';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, ShieldAlert,
  Calendar, AlertTriangle, CheckCircle, ChevronRight, Sliders,
  HelpCircle, UserX, ArrowUpRight, ArrowDownRight, Award,
  FileText, Download, Eye, CheckCircle2, RefreshCw, Filter,
  Search, Users, Send, AlertOctagon, RotateCcw,
  Building2, MapPin, Mail, Phone, Upload, X, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import { useAuth, getMediaUrl } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import PermissionDenied from '../../components/common/states/PermissionDenied';
import FormError from '../../components/common/states/FormError';

export const SalaryManagementPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Active Tab: 'payslips' | 'payroll_roster'
  const [activeTab, setActiveTab] = useState('payslips');

  // Payslips Management State
  const [payslips, setPayslips] = useState([]);
  const [loadingPayslips, setLoadingPayslips] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action Targets
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPayslip, setPreviewPayslip] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState(null);
  const [releasing, setReleasing] = useState(false);

  const [bulkReleaseModalOpen, setBulkReleaseModalOpen] = useState(false);
  const [bulkReleasing, setBulkReleasing] = useState(false);

  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revoking, setRevoking] = useState(false);

  // Branding Modal State (Dynamic Payslip Branding)
  const { refreshCompanySettings } = useAuth();
  const [brandingModalOpen, setBrandingModalOpen] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    company_name: '',
    company_tagline: '',
    company_address: '',
    contact_email: '',
    contact_phone: ''
  });
  const [brandingLogoFile, setBrandingLogoFile] = useState(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState(null);
  const [brandingRemoveLogo, setBrandingRemoveLogo] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const brandingFileInputRef = useRef(null);

  const openCompanyBrandingModal = async () => {
    try {
      const res = await api.get('/core/settings/');
      const s = res.data || {};
      setBrandingForm({
        company_name: s.company_name || 'FRG Enterprise',
        company_tagline: s.company_tagline || 'Secure Enterprise Workspace Portal',
        company_address: s.company_address || 'Plot No. 42, Hitech City, Hyderabad, Telangana - 500081',
        contact_email: s.contact_email || 'hr@frgenterprise.com',
        contact_phone: s.contact_phone || '+91 40 1234 5678'
      });
      if (s.company_logo) {
        setBrandingLogoPreview(getMediaUrl(s.company_logo));
      } else {
        setBrandingLogoPreview(null);
      }
      setBrandingLogoFile(null);
      setBrandingRemoveLogo(false);
      setBrandingModalOpen(true);
    } catch (err) {
      console.error(err);
      addToast('Failed to load company details.', 'error');
    }
  };

  const handleBrandingLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        addToast('Logo image must be less than 5MB', 'error');
        return;
      }
      setBrandingLogoFile(file);
      setBrandingLogoPreview(URL.createObjectURL(file));
      setBrandingRemoveLogo(false);
    }
  };

  const handleRemoveBrandingLogo = () => {
    setBrandingLogoFile(null);
    setBrandingLogoPreview(null);
    setBrandingRemoveLogo(true);
    if (brandingFileInputRef.current) brandingFileInputRef.current.value = '';
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    try {
      setBrandingSaving(true);
      const formData = new FormData();
      formData.append('company_name', brandingForm.company_name || 'FRG Enterprise');
      formData.append('company_tagline', brandingForm.company_tagline || '');
      formData.append('company_address', brandingForm.company_address || '');
      formData.append('contact_email', brandingForm.contact_email || '');
      formData.append('contact_phone', brandingForm.contact_phone || '');
      if (brandingLogoFile) {
        formData.append('company_logo', brandingLogoFile);
      } else if (brandingRemoveLogo) {
        formData.append('remove_logo', 'true');
      }

      await api.patch('/core/settings/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      addToast('Company branding & payslip details updated! All payslips now reflect the new details.', 'success');
      setBrandingModalOpen(false);
      if (refreshCompanySettings) await refreshCompanySettings();
      fetchPayslips();
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.message || 'Failed to update company details.', 'error');
    } finally {
      setBrandingSaving(false);
    }
  };

  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [generatingId, setGeneratingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Existing Payroll Roster Data State
  const [payrollData, setPayrollData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [payrollError, setPayrollError] = useState(null);

  // Salary Adjustment Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [adjFormErrors, setAdjFormErrors] = useState({});
  const [adjForm, setAdjForm] = useState({
    type: 'INCREMENT',
    amount: '',
    reason: '',
    effective_date: new Date().toISOString().split('T')[0],
    confirmed: false
  });
  const [adjLoading, setAdjLoading] = useState(false);

  const isCEO = ['CEO', 'SYSTEM_ADMIN'].includes(user?.role);
  const isHR = ['HR', 'CEO', 'SYSTEM_ADMIN'].includes(user?.role);

  // Fetch Departments
  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await api.get('/employees/departments/');
        const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
        setDepartments(data);
      } catch (e) {
        // non-critical
      }
    };
    fetchDepts();
  }, []);

  // Fetch Payslips for CEO/HR
  const fetchPayslips = async () => {
    if (!isHR) return;
    try {
      setLoadingPayslips(true);
      let url = `/salaries/payslips/?year=${selectedYear}&month=${selectedMonth}`;
      if (selectedDept) url += `&department=${selectedDept}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery.trim())}`;

      const res = await api.get(url);
      const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      setPayslips(data);
    } catch (e) {
      console.error('Error loading payslips:', e);
      addToast('Unable to load monthly payslips.', 'error');
    } finally {
      setLoadingPayslips(false);
    }
  };

  // Fetch Existing Payroll Engine Roster
  const fetchPayrollAndHistory = async () => {
    if (!isCEO) return;
    try {
      setLoadingPayroll(true);
      setPayrollError(null);
      const [payRes, histRes] = await Promise.all([
        api.get(`/salaries/payroll/?month=${selectedMonth}&year=${selectedYear}`),
        api.get('/salaries/history/')
      ]);
      setPayrollData(payRes.data);
      setHistory(histRes.data?.results || histRes.data || []);
    } catch (e) {
      console.error('Error fetching payroll records:', e);
      setPayrollError('Unable to load payroll financial records.');
    } finally {
      setLoadingPayroll(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'payslips') {
      fetchPayslips();
    } else {
      fetchPayrollAndHistory();
    }
  }, [selectedMonth, selectedYear, selectedDept, selectedStatus, activeTab]);

  // Handle single payslip generation
  const handleGenerateSingle = async (employeeId, forceVersion = false) => {
    try {
      setGeneratingId(employeeId);
      await api.post('/salaries/payslips/generate/', {
        employee_id: employeeId,
        year: selectedYear,
        month: selectedMonth,
        force_version: forceVersion
      });
      addToast('Payslip generated and PDF built successfully!', 'success');
      fetchPayslips();
    } catch (e) {
      console.error('Generate error:', e);
      addToast(e.response?.data?.error || 'Failed to generate payslip.', 'error');
    } finally {
      setGeneratingId(null);
    }
  };

  // Handle bulk payslip generation
  const handleBulkGenerate = async () => {
    try {
      setBulkGenerating(true);
      const payload = {
        year: selectedYear,
        month: selectedMonth,
      };
      if (selectedDept) payload.department_id = selectedDept;

      const res = await api.post('/salaries/payslips/bulk-generate/', payload);
      addToast(res.data?.message || 'Bulk generation completed!', 'success');
      fetchPayslips();
    } catch (e) {
      console.error('Bulk generate error:', e);
      addToast(e.response?.data?.error || 'Failed to bulk generate payslips.', 'error');
    } finally {
      setBulkGenerating(false);
    }
  };

  // Handle verify
  const handleVerify = async (payslipId) => {
    try {
      setVerifyingId(payslipId);
      await api.post(`/salaries/payslips/${payslipId}/verify/`);
      addToast('Payslip marked as VERIFIED and ready for release.', 'success');
      fetchPayslips();
    } catch (e) {
      console.error('Verify error:', e);
      addToast(e.response?.data?.error || 'Failed to verify payslip.', 'error');
    } finally {
      setVerifyingId(null);
    }
  };

  // Open Release Confirmation
  const openReleaseModal = (payslip) => {
    setReleaseTarget(payslip);
    setReleaseModalOpen(true);
  };

  // Confirm Single Release
  const handleConfirmRelease = async () => {
    if (!releaseTarget) return;
    try {
      setReleasing(true);
      await api.post(`/salaries/payslips/${releaseTarget.id}/release/`);
      addToast(`Payslip for ${releaseTarget.employee_name} released to dashboard!`, 'success');
      setReleaseModalOpen(false);
      setReleaseTarget(null);
      fetchPayslips();
    } catch (e) {
      console.error('Release error:', e);
      addToast(e.response?.data?.error || 'Failed to release payslip.', 'error');
    } finally {
      setReleasing(false);
    }
  };

  // Confirm Bulk Release
  const handleConfirmBulkRelease = async () => {
    try {
      setBulkReleasing(true);
      const res = await api.post('/salaries/payslips/bulk-release/', {
        year: selectedYear,
        month: selectedMonth
      });
      addToast(res.data?.message || 'Verified payslips successfully released!', 'success');
      setBulkReleaseModalOpen(false);
      fetchPayslips();
    } catch (e) {
      console.error('Bulk release error:', e);
      addToast(e.response?.data?.error || 'Failed to bulk release verified payslips.', 'error');
    } finally {
      setBulkReleasing(false);
    }
  };

  // Open Revoke Modal
  const openRevokeModal = (payslip) => {
    setRevokeTarget(payslip);
    setRevokeReason('');
    setRevokeModalOpen(true);
  };

  // Confirm Revoke
  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    if (!revokeReason.trim()) {
      addToast('A reason is mandatory to revoke a released payslip.', 'error');
      return;
    }
    try {
      setRevoking(true);
      await api.post(`/salaries/payslips/${revokeTarget.id}/revoke/`, {
        reason: revokeReason.trim()
      });
      addToast(`Payslip ${revokeTarget.payslip_reference} has been REVOKED and unreleased.`, 'success');
      setRevokeModalOpen(false);
      setRevokeTarget(null);
      fetchPayslips();
    } catch (e) {
      console.error('Revoke error:', e);
      addToast(e.response?.data?.error || 'Failed to revoke payslip.', 'error');
    } finally {
      setRevoking(false);
    }
  };

  // Handle Preview
  const handlePreview = async (payslip) => {
    try {
      setPreviewPayslip(payslip);
      setPreviewLoading(true);
      setPreviewModalOpen(true);
      const res = await api.get(`/salaries/payslips/${payslip.id}/download/?inline=true`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewPdfUrl(blobUrl);
    } catch (e) {
      console.error('Preview error:', e);
      addToast('Failed to load payslip preview.', 'error');
      setPreviewModalOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreviewModal = () => {
    if (previewPdfUrl) {
      window.URL.revokeObjectURL(previewPdfUrl);
      setPreviewPdfUrl(null);
    }
    setPreviewModalOpen(false);
    setPreviewPayslip(null);
  };

  // Handle Download
  const handleDownload = async (payslip) => {
    try {
      setDownloadingId(payslip.id);
      const res = await api.get(`/salaries/payslips/${payslip.id}/download/`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${payslip.payslip_reference || 'Payslip'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      addToast(`Payslip ${payslip.payslip_reference} downloaded.`, 'success');
    } catch (e) {
      console.error('Download error:', e);
      addToast('Failed to download PDF.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  // Handle Manual Payslip Email Dispatch
  const [sendingEmailId, setSendingEmailId] = useState(null);
  const [bulkSendingEmail, setBulkSendingEmail] = useState(false);

  const handleSendSingleEmail = async (payslip) => {
    try {
      setSendingEmailId(payslip.id);
      const res = await api.post(`/salaries/payslips/${payslip.id}/send-email/`);
      addToast(res.data?.message || 'Official payslip email alert dispatched to employee!', 'success');
    } catch (e) {
      console.error(e);
      addToast(e.response?.data?.error || 'Failed to dispatch email alert.', 'error');
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleSendBulkEmailAlerts = async () => {
    try {
      setBulkSendingEmail(true);
      const res = await api.post('/salaries/payslips/send-bulk-email-alerts/', {
        year: selectedYear,
        month: selectedMonth
      });
      addToast(res.data?.message || 'Email alerts successfully dispatched to all released employees!', 'success');
    } catch (e) {
      console.error(e);
      addToast(e.response?.data?.error || 'Failed to dispatch bulk email alerts.', 'error');
    } finally {
      setBulkSendingEmail(false);
    }
  };

  // Handle Salary Increment/Decrement for CEO
  const openAdjustmentModal = (emp) => {
    setSelectedEmp(emp);
    setAdjFormErrors({});
    setAdjForm({
      type: 'INCREMENT',
      amount: '',
      reason: '',
      effective_date: new Date().toISOString().split('T')[0],
      confirmed: false
    });
    setIsAdjModalOpen(true);
  };

  const handleSalaryAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedEmp) return;

    const errors = {};
    if (!adjForm.amount || parseFloat(adjForm.amount) <= 0) {
      errors.amount = 'Please enter a valid positive adjustment amount.';
    }
    if (!adjForm.reason?.trim()) {
      errors.reason = 'Please enter a justification for this salary change.';
    }
    if (!adjForm.confirmed) {
      errors.confirmed = 'You must confirm and authorize this compensation adjustment.';
    }

    if (Object.keys(errors).length > 0) {
      setAdjFormErrors(errors);
      return;
    }

    setAdjLoading(true);
    try {
      const endpoint = adjForm.type === 'INCREMENT' ? '/salaries/increment/' : '/salaries/decrement/';
      await api.post(endpoint, {
        employee_id: selectedEmp.employee_id,
        amount: parseFloat(adjForm.amount),
        reason: adjForm.reason.trim(),
        effective_date: adjForm.effective_date,
        confirmed: true
      });

      addToast(`Successfully applied salary ${adjForm.type.toLowerCase()} for ${selectedEmp.full_name}!`, 'success');
      setIsAdjModalOpen(false);
      setAdjFormErrors({});
      fetchPayrollAndHistory();
    } catch (err) {
      addToast(err.response?.data?.error || err.response?.data?.message || 'Failed to update salary', 'error');
    } finally {
      setAdjLoading(false);
    }
  };

  if (!isHR) {
    return <PermissionDenied />;
  }

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const getMonthName = (m) => {
    const found = months.find((item) => item.value === m);
    return found ? found.label : `Month ${m}`;
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'RELEASED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3" /> Released
          </span>
        );
      case 'VERIFIED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 w-max">
            <Award className="w-3 h-3" /> Verified
          </span>
        );
      case 'GENERATED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 w-max">
            <Clock className="w-3 h-3" /> Generated
          </span>
        );
      case 'REVOKED':
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max">
            <RotateCcw className="w-3 h-3" /> Revoked
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-full bg-slate-700/50 text-slate-300 border border-slate-700 flex items-center gap-1 w-max">
            {status || 'Draft'}
          </span>
        );
    }
  };

  // Counts
  const verifiedCount = payslips.filter((p) => p.status === 'VERIFIED').length;
  const releasedCount = payslips.filter((p) => p.status === 'RELEASED').length;
  const totalNetDisbursed = payslips
    .filter((p) => p.status === 'RELEASED')
    .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER & TOP CONTROLS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <DollarSign className="w-7 h-7 text-emerald-400" /> Payroll & Payslip Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Authoritative compensation governance: generate, verify, release official monthly PDF payslips & manage executive salary tiers
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openCompanyBrandingModal}
            className="px-3 py-1.5 bg-gradient-to-r from-indigo-600/30 to-violet-600/30 hover:from-indigo-600/50 hover:to-violet-600/50 text-indigo-200 hover:text-white border border-indigo-500/40 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Configure company name, address, contact, and logo dynamically reflected on all payslips"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Payslip Company Branding</span>
          </button>

          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 focus:outline-none"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              onClick={() => { if (activeTab === 'payslips') fetchPayslips(); else fetchPayrollAndHistory(); }}
              title="Refresh"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('payslips')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === 'payslips'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
          }`}
        >
          <FileText className="w-4 h-4 text-emerald-400" /> Payslip Release Management
        </button>

        {isCEO && (
          <button
            onClick={() => setActiveTab('payroll_roster')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'payroll_roster'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
            }`}
          >
            <Sliders className="w-4 h-4 text-indigo-400" /> Executive Compensation & Salary Tiers
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAYSLIP RELEASE MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === 'payslips' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                <span>Total Payslips</span>
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="text-2xl font-black text-white font-mono">{payslips.length}</div>
              <div className="text-[10px] text-slate-500 mt-1">Generated for {getMonthName(selectedMonth)} {selectedYear}</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5">
              <div className="text-[11px] font-semibold text-indigo-300 mb-1 flex items-center justify-between">
                <span>Verified (Pending Release)</span>
                <Award className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-black text-indigo-300 font-mono">{verifiedCount}</div>
              <div className="text-[10px] text-indigo-300/70 mt-1">Audited & ready for release</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[11px] font-semibold text-emerald-300 mb-1 flex items-center justify-between">
                <span>Released to Staff</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{releasedCount}</div>
              <div className="text-[10px] text-emerald-300/70 mt-1">Visible on employee dashboards</div>
            </div>

            <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
              <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center justify-between">
                <span>Released Net Disbursed</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl font-black text-white font-mono">
                ₹{totalNetDisbursed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">Total official released payroll</div>
            </div>
          </div>

          {/* FILTER & BULK ACTIONS BAR */}
          <div className="p-4 rounded-2xl glass-panel border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search employee / reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') fetchPayslips(); }}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Department */}
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-700 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="GENERATED">Generated</option>
                <option value="VERIFIED">Verified</option>
                <option value="RELEASED">Released</option>
                <option value="REVOKED">Revoked</option>
              </select>

              <button
                onClick={fetchPayslips}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
              >
                Filter
              </button>
            </div>

            {/* Bulk Action Buttons */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={handleBulkGenerate}
                disabled={bulkGenerating}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {bulkGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                )}
                Generate All ({getMonthName(selectedMonth)})
              </button>

              <button
                onClick={() => setBulkReleaseModalOpen(true)}
                disabled={verifiedCount === 0}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all flex items-center gap-1.5 shadow-md disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" /> Release All Verified ({verifiedCount})
              </button>

              {releasedCount > 0 && (
                <button
                  type="button"
                  onClick={handleSendBulkEmailAlerts}
                  disabled={bulkSendingEmail}
                  className="px-3.5 py-1.5 text-xs font-bold text-indigo-200 hover:text-white bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 rounded-xl transition-all flex items-center gap-1.5 shadow-md disabled:opacity-40 cursor-pointer"
                  title="Dispatch payslip email alerts with attached PDF to all released employees"
                >
                  {bulkSendingEmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                  )}
                  Email All Released ({releasedCount})
                </button>
              )}
            </div>
          </div>

          {/* PAYSLIPS MANAGEMENT TABLE */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-400" />
              Monthly Payslips Roster • {getMonthName(selectedMonth)} {selectedYear}
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Gross Salary</th>
                    <th className="p-3">Attendance</th>
                    <th className="p-3">LOP (Days/Cut)</th>
                    <th className="p-3 text-emerald-400">Net Salary</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Released Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingPayslips ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-slate-500">
                        <LoadingState type="component" message="Loading payslips list..." />
                      </td>
                    </tr>
                  ) : payslips.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-10 text-center text-slate-500">
                        <div className="max-w-md mx-auto space-y-2">
                          <p className="font-semibold text-slate-300">No payslips found for this period.</p>
                          <p className="text-[11px] text-slate-400">
                            Click <strong>"Generate All"</strong> above to compute monthly payroll and create payslips for eligible employees.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    payslips.map((p) => {
                      const netSal = parseFloat(p.net_salary || 0);
                      const grossSal = parseFloat(p.gross_salary || p.monthly_salary || 0);
                      const lopDeduction = parseFloat(p.lop_deduction || 0);

                      return (
                        <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="p-3 font-semibold text-white">
                            <div>{p.employee_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {p.employee_id_code} • {p.department_name}
                            </div>
                          </td>

                          <td className="p-3 font-mono text-slate-300">
                            <div>{p.payslip_reference}</div>
                            {p.version > 1 && (
                              <span className="text-[9px] font-bold text-indigo-400">Rev {p.version}</span>
                            )}
                          </td>

                          <td className="p-3 font-mono font-bold text-slate-300">
                            ₹{grossSal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="p-3 text-slate-300">
                            <div>{p.present_days} / {p.company_working_days} Days</div>
                            <div className="text-[10px] text-slate-400">CL: {p.casual_leave_days || 0}d</div>
                          </td>

                          <td className="p-3">
                            <div className={`font-semibold ${parseFloat(p.lop_days) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                              {p.lop_days || 0} Days
                            </div>
                            {lopDeduction > 0 && (
                              <div className="text-[10px] text-rose-400 font-mono">
                                -₹{lopDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                            )}
                          </td>

                          <td className="p-3 font-mono font-black text-emerald-400 text-sm">
                            ₹{netSal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          <td className="p-3">
                            {renderStatusBadge(p.status)}
                          </td>

                          <td className="p-3 text-[11px] text-slate-400">
                            {p.released_at ? (
                              <div>
                                <div>{new Date(p.released_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</div>
                                <div className="text-[9px] text-slate-400 truncate max-w-[100px]">{p.released_by_name}</div>
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Preview Action */}
                              <button
                                onClick={() => handlePreview(p)}
                                title="Preview Payslip & PDF"
                                className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              </button>

                              {/* Verify Action (for GENERATED) */}
                              {p.status === 'GENERATED' && (
                                <button
                                  onClick={() => handleVerify(p.id)}
                                  disabled={verifyingId === p.id}
                                  title="Mark as Verified"
                                  className="px-2 py-1 text-[11px] font-bold text-indigo-300 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  {verifyingId === p.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Award className="w-3 h-3" />}
                                  Verify
                                </button>
                              )}

                              {/* Release Action (for VERIFIED or GENERATED) */}
                              {(p.status === 'VERIFIED' || p.status === 'GENERATED') && (
                                <button
                                  onClick={() => openReleaseModal(p)}
                                  title="Release to Employee Dashboard"
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                                >
                                  <Send className="w-3 h-3" />
                                  Release
                                </button>
                              )}

                              {/* Download PDF Action */}
                              <button
                                onClick={() => handleDownload(p)}
                                disabled={downloadingId === p.id}
                                title="Download PDF"
                                className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                              >
                                {downloadingId === p.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                              </button>

                              {/* Email Alert Action (for RELEASED) */}
                              {p.status === 'RELEASED' && (
                                <button
                                  type="button"
                                  onClick={() => handleSendSingleEmail(p)}
                                  disabled={sendingEmailId === p.id}
                                  title="Send / Resend Email Alert with PDF attachment to employee"
                                  className="p-1.5 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/25 border border-indigo-500/30 rounded-lg transition-colors cursor-pointer"
                                >
                                  {sendingEmailId === p.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                  ) : (
                                    <Mail className="w-3.5 h-3.5 text-indigo-400" />
                                  )}
                                </button>
                              )}

                              {/* Revoke Action (for RELEASED) */}
                              {p.status === 'RELEASED' && (
                                <button
                                  onClick={() => openRevokeModal(p)}
                                  title="Revoke / Unrelease"
                                  className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-lg transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Regenerate Action (for REVOKED) */}
                              {p.status === 'REVOKED' && (
                                <button
                                  onClick={() => handleGenerateSingle(p.employee, true)}
                                  disabled={generatingId === p.employee}
                                  title="Regenerate New Revision"
                                  className="px-2 py-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <RefreshCw className={`w-3 h-3 ${generatingId === p.employee ? 'animate-spin' : ''}`} />
                                  Re-generate
                                </button>
                              )}
                            </div>
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
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PAYROLL & COMPENSATION ROSTER (EXISTING TABLE) */}
      {/* ========================================================================= */}
      {activeTab === 'payroll_roster' && isCEO && (
        <div className="space-y-6">
          {/* POLICY REMINDER BANNER */}
          <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-indigo-200">
            <div className="flex items-center gap-3">
              <Award className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>
                <strong>Company Policy Enforced:</strong> 1 Sick Leave & 1 Casual Leave & 4 WFH allowed free/month. Any leaves exceeding these thresholds (&gt;1 SL, &gt;1 CL, &gt;4 WFH) or shift deficits are automatically deducted at standard daily compensation rates.
              </span>
            </div>
          </div>

          {/* MONTHLY PAYROLL BREAKDOWN TABLE */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" /> Monthly Payroll & Salary Deductions Roster
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Base Salary</th>
                    <th className="p-3">Sick Leave (1 Free)</th>
                    <th className="p-3">Casual Leave (1 Free)</th>
                    <th className="p-3">WFH (4 Free)</th>
                    <th className="p-3">Half-Day/Absence</th>
                    <th className="p-3 text-rose-400">Total Deductions</th>
                    <th className="p-3 text-emerald-400">Net Payable</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loadingPayroll ? (
                    <tr><td colSpan="9" className="p-6 text-center text-slate-500">Calculating monthly payroll records...</td></tr>
                  ) : !payrollData?.records?.length ? (
                    <tr><td colSpan="9" className="p-6 text-center text-slate-500">No employee records found.</td></tr>
                  ) : (
                    payrollData.records.map((r) => (
                      <tr key={r.employee_id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="p-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span>{r.full_name}</span>
                            {r.is_half_day && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded">HALF DAY</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{r.employee_code} • {r.department}</div>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-200">
                          ₹{parseFloat(r.base_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{r.sick_leaves_taken} days</span>
                            {r.excess_sick_leaves > 0 ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                                +{r.excess_sick_leaves} excess (-₹{r.sick_leave_deduction})
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400">✓ Free</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{r.casual_leaves_taken} days</span>
                            {r.excess_casual_leaves > 0 ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                                +{r.excess_casual_leaves} excess (-₹{r.casual_leave_deduction})
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400">✓ Free</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">{r.wfh_days_taken} days</span>
                            {r.excess_wfh_days > 0 ? (
                              <span className="px-1.5 py-0.5 text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded">
                                +{r.excess_wfh_days} excess (-₹{r.wfh_deduction})
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-400">✓ Free</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-300">
                          {r.half_days_count > 0 || r.absent_days_count > 0 ? (
                            <div className="text-[11px] font-mono text-amber-400">
                              {r.half_days_count > 0 && `${r.half_days_count} HD `}
                              {r.absent_days_count > 0 && `${r.absent_days_count} Absent`}
                            </div>
                          ) : r.is_half_day ? (
                            <span className="text-[10px] text-emerald-400 font-medium">✓ Half-Day Shift</span>
                          ) : (
                            <span className="text-[10px] text-slate-500">None</span>
                          )}
                        </td>
                        <td className="p-3 font-mono font-bold text-rose-400 text-sm">
                          {parseFloat(r.total_deduction) > 0 ? (
                            `-₹${parseFloat(r.total_deduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          ) : (
                            '₹0.00'
                          )}
                        </td>
                        <td className="p-3 font-mono font-black text-emerald-400 text-sm">
                          ₹{parseFloat(r.net_payable_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => openAdjustmentModal(r)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 font-bold border border-slate-700 transition-all text-xs"
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. SINGLE RELEASE CONFIRMATION MODAL */}
      <Modal
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        title="Release Payslip to Employee Dashboard?"
        size="md"
      >
        {releaseTarget && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Employee:</span>
                <span className="font-bold text-white">{releaseTarget.employee_name} ({releaseTarget.employee_id_code})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payroll Period:</span>
                <span className="font-bold text-white">{getMonthName(releaseTarget.month)} {releaseTarget.year}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="font-mono text-slate-300">{releaseTarget.payslip_reference}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2">
                <span className="text-slate-400">Net Disbursable Salary:</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  ₹{parseFloat(releaseTarget.net_salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Once released, this official PDF payslip will immediately become visible to the employee in their workspace dashboard and an in-app notification will be triggered.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReleaseModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRelease}
                disabled={releasing}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {releasing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Release Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 2. BULK RELEASE CONFIRMATION MODAL */}
      <Modal
        isOpen={bulkReleaseModalOpen}
        onClose={() => setBulkReleaseModalOpen(false)}
        title="Authorize Bulk Release of Verified Payslips?"
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200">
            <p className="font-bold mb-1">Release Summary:</p>
            <p>
              You are about to release <strong>{verifiedCount} verified payslip(s)</strong> for <strong>{getMonthName(selectedMonth)} {selectedYear}</strong>.
            </p>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            All verified employees will immediately receive access to view and download their official PDF payslips from their employee dashboards. Unverified or draft records will remain withheld.
          </p>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setBulkReleaseModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmBulkRelease}
              disabled={bulkReleasing}
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkReleasing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Authorize & Release All Verified
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. REVOKE CONFIRMATION MODAL */}
      <Modal
        isOpen={revokeModalOpen}
        onClose={() => setRevokeModalOpen(false)}
        title="Revoke / Withhold Released Payslip"
        size="md"
      >
        {revokeTarget && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-start gap-2.5">
              <AlertOctagon className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong>Warning:</strong> Revoking will immediately remove this payslip from <strong>{revokeTarget.employee_name}'s</strong> dashboard. The employee will no longer be able to view or download it until re-verified and re-released.
              </div>
            </div>

            <div>
              <label htmlFor="revoke-reason" className="block text-xs font-semibold text-slate-300 mb-1">
                Reason for Revocation <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="e.g. Leave adjustment correction required, overtime rectification, incorrect base salary..."
                rows={3}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white resize-none focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRevokeModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevoke}
                disabled={revoking || !revokeReason.trim()}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition-all shadow-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {revoking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Revoke Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 4. PDF PREVIEW MODAL */}
      <Modal
        isOpen={previewModalOpen}
        onClose={closePreviewModal}
        title={
          previewPayslip
            ? `Payslip Preview • ${previewPayslip.employee_name} (${previewPayslip.payslip_reference})`
            : 'Official Payslip Preview'
        }
        size="2xl"
      >
        <div className="space-y-4">
          {previewLoading ? (
            <div className="h-[600px] flex items-center justify-center">
              <LoadingState type="component" message="Loading high-resolution payslip document..." />
            </div>
          ) : previewPdfUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span>Official system-generated corporate document</span>
                {previewPayslip && (
                  <button
                    onClick={() => handleDownload(previewPayslip)}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300"
                  >
                    <Download className="w-3.5 h-3.5" /> Download PDF File
                  </button>
                )}
              </div>
              <div className="w-full h-[620px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                <iframe
                  src={`${previewPdfUrl}#toolbar=0`}
                  title="Payslip PDF Preview"
                  className="w-full h-full border-none"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">
              Failed to load payslip preview document.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={closePreviewModal}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Close Preview
            </button>
            {previewPayslip && (
              <button
                onClick={() => handleDownload(previewPayslip)}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* 5. SALARY INCREMENT/DECREMENT MODAL (CEO ONLY) */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title={`Executive Salary Adjustment: ${selectedEmp?.full_name || ''}`}
        size="md"
      >
        <form onSubmit={handleSalaryAdjustment} className="space-y-4">
          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Current Base Salary:</span>
            <span className="font-mono font-bold text-white text-sm">
              ₹{selectedEmp ? parseFloat(selectedEmp.base_salary).toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Adjustment Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: 'INCREMENT' })}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  adjForm.type === 'INCREMENT'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" /> Increment (+)
              </button>
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: 'DECREMENT' })}
                className={`p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                  adjForm.type === 'DECREMENT'
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-md'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}
              >
                <ArrowDownRight className="w-4 h-4" /> Decrement (-)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="adj-amount" className="block text-xs font-semibold text-slate-300 mb-1">
              Adjustment Amount (₹) <span className="text-rose-400">*</span>
            </label>
            <input
              id="adj-amount"
              type="number"
              value={adjForm.amount}
              onChange={(e) => {
                setAdjForm({ ...adjForm, amount: e.target.value });
                if (adjFormErrors.amount) setAdjFormErrors({ ...adjFormErrors, amount: null });
              }}
              placeholder="e.g. 5000"
              min="1"
              className={`w-full p-2.5 bg-slate-900 border ${
                adjFormErrors.amount ? 'border-rose-500' : 'border-slate-800'
              } rounded-xl text-xs text-white focus:outline-none focus:border-brand-500`}
            />
            <FormError message={adjFormErrors.amount} id="adj-amount-error" />
          </div>

          <div>
            <label htmlFor="adj-reason" className="block text-xs font-semibold text-slate-300 mb-1">
              Reason for Executive Adjustment <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="adj-reason"
              value={adjForm.reason}
              onChange={(e) => {
                setAdjForm({ ...adjForm, reason: e.target.value });
                if (adjFormErrors.reason) setAdjFormErrors({ ...adjFormErrors, reason: null });
              }}
              placeholder="e.g. Performance appraisal increment, promotion, structural adjustment..."
              rows={3}
              className={`w-full p-2.5 bg-slate-900 border ${
                adjFormErrors.reason ? 'border-rose-500' : 'border-slate-800'
              } rounded-xl text-xs text-white resize-none focus:outline-none focus:border-brand-500`}
            />
            <FormError message={adjFormErrors.reason} id="adj-reason-error" />
          </div>

          <div>
            <label htmlFor="adj-date" className="block text-xs font-semibold text-slate-300 mb-1">Effective Date</label>
            <input
              id="adj-date"
              type="date"
              value={adjForm.effective_date}
              onChange={(e) => setAdjForm({ ...adjForm, effective_date: e.target.value })}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={adjForm.confirmed}
                onChange={(e) => {
                  setAdjForm({ ...adjForm, confirmed: e.target.checked });
                  if (adjFormErrors.confirmed) setAdjFormErrors({ ...adjFormErrors, confirmed: null });
                }}
                className="w-4 h-4 mt-0.5 rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-[11px] text-slate-300 leading-snug">
                I hereby authorize this executive salary change as CEO. This adjustment will permanently update employee payroll records and write an immutable audit log.
              </span>
            </label>
            <FormError message={adjFormErrors.confirmed} id="adj-confirm-error" />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjLoading}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              {adjLoading ? (
                <LoadingState type="button" text="Authorizing..." />
              ) : (
                'Authorize & Apply'
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL: PAYSLIP COMPANY BRANDING & LOGO */}
      {/* ========================================================================= */}
      <Modal
        isOpen={brandingModalOpen}
        onClose={() => setBrandingModalOpen(false)}
        title="Payslip Company Branding & Header Details"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSaveBranding} className="space-y-5">
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 text-xs text-indigo-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-white">Dynamic Payslip Invalidation & Live Generation</p>
              <p className="text-slate-300 mt-0.5">
                Saving these details immediately updates the company branding on all employee payslips.
                Existing and future payslip PDFs will dynamically render with the new logo and contact details.
              </p>
            </div>
          </div>

          {/* REAL-TIME PAYSLIP PREVIEW BOX */}
          <div className="border border-slate-700 rounded-xl p-4 bg-slate-950/70">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Live Payslip Header Preview</span>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Dynamic Sync
              </span>
            </div>

            {/* Simulated Paper Header */}
            <div className="bg-white rounded-lg p-4 text-slate-800 shadow-md border border-slate-200">
              <div className="flex items-start justify-between gap-4">
                {/* Left Brand Stack */}
                <div className="flex items-center gap-3">
                  {brandingLogoPreview ? (
                    <img
                      src={brandingLogoPreview}
                      alt="Logo preview"
                      className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
                      {(brandingForm.company_name || 'FRG').trim().slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                      {brandingForm.company_name || 'YOUR COMPANY NAME'}
                    </h2>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5 max-w-xs">
                      {brandingForm.company_address || 'Registered Office Address, City, State - PIN'}
                    </p>
                    <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                      {brandingForm.contact_email || 'hr@company.com'}
                      {brandingForm.contact_phone && ` | ${brandingForm.contact_phone}`}
                    </p>
                  </div>
                </div>

                {/* Right Statement Title */}
                <div className="text-right">
                  <h3 className="text-xs font-black text-indigo-600 tracking-wide uppercase">
                    Salary Statement / Payslip
                  </h3>
                  <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                    Pay Period: {getMonthName(selectedMonth)} {selectedYear}
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    Ref ID: PAY-{selectedYear}-{String(selectedMonth).padStart(2, '0')}-EMP-0001
                  </div>
                  <div className="text-[9px] font-bold text-emerald-600 font-mono">
                    Status: GENERATED
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t-2 border-indigo-500/80"></div>
            </div>
          </div>

          {/* EDIT FORM INPUTS */}
          <div className="space-y-4">
            {/* Logo Upload Section */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Company Logo (Rendered on Left of Company Name)
              </label>
              <div className="flex items-center gap-4 p-3 bg-slate-900/60 rounded-xl border border-slate-800">
                {brandingLogoPreview ? (
                  <div className="relative group">
                    <img
                      src={brandingLogoPreview}
                      alt="Logo preview"
                      className="w-14 h-14 rounded-xl object-contain bg-white border border-slate-700 p-1 shadow-md"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveBrandingLogo}
                      title="Remove Logo"
                      className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 hover:bg-rose-500 text-white rounded-full shadow-lg transition-transform hover:scale-110"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 bg-slate-800/40">
                    <Building2 className="w-6 h-6" />
                  </div>
                )}

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <input
                      ref={brandingFileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleBrandingLogoSelect}
                      className="hidden"
                      id="branding-logo-input"
                    />
                    <label
                      htmlFor="branding-logo-input"
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                      {brandingLogoPreview ? 'Change Logo' : 'Upload Logo'}
                    </label>

                    {brandingLogoPreview && (
                      <button
                        type="button"
                        onClick={handleRemoveBrandingLogo}
                        className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                      >
                        Remove Logo
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    PNG, JPG, or SVG recommended. Rendered on the left side of the company name in payslip PDFs.
                  </p>
                </div>
              </div>
            </div>

            {/* Grid for Name & Tagline */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company Name <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={brandingForm.company_name}
                    onChange={(e) => setBrandingForm({ ...brandingForm, company_name: e.target.value })}
                    placeholder="e.g. FRG Enterprise"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Company Tagline / Subtitle</label>
                <input
                  type="text"
                  value={brandingForm.company_tagline}
                  onChange={(e) => setBrandingForm({ ...brandingForm, company_tagline: e.target.value })}
                  placeholder="e.g. Secure Enterprise Workspace Portal"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Registered Company Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <textarea
                  rows={2}
                  required
                  value={brandingForm.company_address}
                  onChange={(e) => setBrandingForm({ ...brandingForm, company_address: e.target.value })}
                  placeholder="e.g. Plot No. 42, Hitech City, Hyderabad, Telangana - 500081"
                  className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Appears directly beneath the company name on payslip PDFs.</p>
            </div>

            {/* Email & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">HR / Payroll Contact Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={brandingForm.contact_email}
                    onChange={(e) => setBrandingForm({ ...brandingForm, contact_email: e.target.value })}
                    placeholder="hr@company.com"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone / Support</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={brandingForm.contact_phone}
                    onChange={(e) => setBrandingForm({ ...brandingForm, contact_phone: e.target.value })}
                    placeholder="+91 40 1234 5678"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setBrandingModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={brandingSaving}
              className="px-5 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {brandingSaving ? (
                <LoadingState type="button" text="Updating Payslips..." />
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Save & Update All Payslips</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SalaryManagementPage;
