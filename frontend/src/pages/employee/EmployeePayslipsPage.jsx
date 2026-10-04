import React, { useState, useEffect } from 'react';
import {
  FileText, Download, Eye, Calendar, DollarSign,
  CheckCircle2, AlertCircle, RefreshCw, X, ShieldCheck,
  TrendingDown, Award, Clock
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import LoadingState from '../../components/common/states/LoadingState';
import Modal from '../../components/common/Modal';

export const EmployeePayslipsPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();

  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('');

  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState(null);

  // PDF Preview State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const [previewPayslip, setPreviewPayslip] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const months = [
    { value: '', label: 'All Months' },
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

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      let url = `/salaries/my-payslips/?year=${selectedYear}`;
      if (selectedMonth) {
        url += `&month=${selectedMonth}`;
      }
      const res = await api.get(url);
      const data = res.data?.results || (Array.isArray(res.data) ? res.data : []);
      setPayslips(data);
    } catch (err) {
      console.error('Error fetching employee payslips:', err);
      addToast('Unable to load payslips. Please check connection.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayslips();
  }, [selectedYear, selectedMonth]);

  const handleDownload = async (payslip) => {
    try {
      setDownloadingId(payslip.id);
      const res = await api.get(`/salaries/my-payslips/${payslip.id}/download/`, {
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
      addToast(`Payslip ${payslip.payslip_reference} downloaded successfully.`, 'success');
    } catch (err) {
      console.error('Download error:', err);
      addToast('Failed to download payslip PDF. Please try again.', 'error');
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePreview = async (payslip) => {
    try {
      setPreviewPayslip(payslip);
      setPreviewLoading(true);
      setPreviewModalOpen(true);
      const res = await api.get(`/salaries/my-payslips/${payslip.id}/download/?inline=true`, {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);
      setPreviewPdfUrl(blobUrl);
    } catch (err) {
      console.error('Preview error:', err);
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

  const getMonthName = (m) => {
    const found = months.find((item) => item.value === m);
    return found ? found.label : `Month ${m}`;
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* HEADER & FILTERS */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-7 h-7 text-emerald-400" /> My Payslips
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Access, view, and securely download your official monthly payslips and compensation statements
          </p>
        </div>

        {/* Date Filter Controls */}
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value ? parseInt(e.target.value) : '')}
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
            onClick={fetchPayslips}
            title="Refresh list"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CONFIDENTIAL NOTICE BANNER */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-200">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>
            <strong>Official Enterprise Payroll Records:</strong> Only finalized payslips officially authorized and released by HR & Executive Management appear here. All salary records are strictly confidential and encrypted.
          </span>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="py-16 text-center">
          <LoadingState type="page" message="Loading your official payslips..." />
        </div>
      ) : payslips.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
            <FileText className="w-8 h-8 text-slate-500" />
          </div>
          <h3 className="text-base font-bold text-white mb-1">No payslips have been released yet</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
            There are no released payslips for the selected period ({selectedMonth ? getMonthName(selectedMonth) : 'All Months'} {selectedYear}).
            Once authorized by HR/CEO, your official PDF will immediately appear here.
          </p>
          {(selectedMonth || selectedYear !== currentDate.getFullYear()) && (
            <button
              onClick={() => { setSelectedMonth(''); setSelectedYear(currentDate.getFullYear()); }}
              className="px-4 py-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-colors"
            >
              Reset Filters to Current Year
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* PAYSLIP CARDS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {payslips.map((p) => {
              const netSal = parseFloat(p.net_salary || 0);
              const grossSal = parseFloat(p.gross_salary || p.monthly_salary || 0);
              const deductions = parseFloat(p.total_deductions || 0);
              const lopDeduction = parseFloat(p.lop_deduction || 0);

              return (
                <div
                  key={p.id}
                  className="glass-panel p-5 rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top Row: Month, Year, Status Badge */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <div className="text-base font-extrabold text-white flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          {getMonthName(p.month)} {p.year}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {p.payslip_reference}
                          {p.version > 1 && (
                            <span className="ml-1.5 px-1.5 py-0.2 text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded">
                              Rev {p.version}
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Released
                      </span>
                    </div>

                    {/* Net Salary Highlight */}
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border border-emerald-500/20 mb-3.5">
                      <div className="text-[10px] uppercase font-bold text-emerald-300/80 tracking-wider">
                        Net Disbursable Salary
                      </div>
                      <div className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                        ₹{netSal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center justify-between">
                        <span>Gross: ₹{grossSal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        {deductions > 0 && (
                          <span className="text-rose-400 font-medium">
                            Deductions: -₹{deductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Attendance & Leave Breakdown Badges */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-4">
                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Working / Present</span>
                        <span className="font-bold text-slate-200">
                          {p.present_days} / {p.company_working_days} Days
                        </span>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Casual Leave (CL)</span>
                        <span className="font-bold text-slate-200">
                          {p.casual_leave_days || 0} Days Paid
                        </span>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">Loss of Pay (LOP)</span>
                        <span className={`font-bold ${parseFloat(p.lop_days) > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                          {p.lop_days || 0} Days
                        </span>
                      </div>
                      <div className="bg-slate-800/60 p-2 rounded-lg border border-slate-800">
                        <span className="text-slate-400 block text-[9px] uppercase font-semibold">LOP Deduction</span>
                        <span className={`font-bold font-mono ${lopDeduction > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                          {lopDeduction > 0 ? `-₹${lopDeduction.toFixed(2)}` : '₹0.00'}
                        </span>
                      </div>
                    </div>

                    {/* Release Audit Metadata */}
                    <div className="text-[10px] text-slate-400 mb-4 flex items-center justify-between border-t border-slate-800/80 pt-2.5">
                      <span>Released: {p.released_at ? new Date(p.released_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Official'}</span>
                      {p.released_by_name && (
                        <span>By {p.released_by_name}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80">
                    <button
                      onClick={() => handlePreview(p)}
                      className="flex-1 py-2 px-3 text-xs font-bold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-400" /> View PDF
                    </button>
                    <button
                      onClick={() => handleDownload(p)}
                      disabled={downloadingId === p.id}
                      className="flex-1 py-2 px-3 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                    >
                      {downloadingId === p.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      <Modal
        isOpen={previewModalOpen}
        onClose={closePreviewModal}
        title={
          previewPayslip
            ? `Payslip Preview • ${getMonthName(previewPayslip.month)} ${previewPayslip.year} (${previewPayslip.payslip_reference})`
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
                <span>Displaying official authorized corporate payslip</span>
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
    </div>
  );
};

export default EmployeePayslipsPage;
