import React, { useState, useEffect } from 'react';
import {
  FileText, Download, FileSpreadsheet, RefreshCw,
  Filter, Calendar, ShieldCheck, AlertCircle, Sparkles,
  Info, CheckCircle, Database
} from 'lucide-react';
import api from '../../../services/api';

const REPORT_TYPES = [
  { id: 'monthly_pf_summary', name: '1. Monthly PF Contribution Summary Report', desc: 'Consolidated A/C 1, 10, 21 & 2 remittances' },
  { id: 'employee_wise_pf', name: '2. Employee-wise PF Deduction Report', desc: 'Itemized member wages & 12% deductions' },
  { id: 'employer_contribution', name: '3. Employer Statutory Contribution Report', desc: 'EPF 3.67%, EPS 8.33%, EDLI 0.50% & Admin' },
  { id: 'eps_report', name: '4. EPS Pension Contribution Report', desc: 'Pensionable wages & 8.33% EPS allocations' },
  { id: 'edli_report', name: '5. EDLI Insurance Contribution Report', desc: 'Deposit-linked insurance 0.50% allocation' },
  { id: 'pf_eligibility_audit', name: '6. PF Eligibility & Exclusion Audit Report', desc: 'Statutory coverage rationale & exclusion audit' },
  { id: 'pf_reconciliation', name: '7. PF Wage Reconciliation & Variance Report', desc: 'Gross vs PF wage variance & LOP analysis' },
  { id: 'september_2026_transition', name: '8. September 2026 Split Transition Report', desc: 'Two-period pro-rata audit under S.O. 5109(E)' },
  { id: 'annual_pf_statement', name: '9. Annual PF Contribution Statement', desc: '12-month consolidated financial year summary' }
];

export const PFReportsTab = ({
  selectedMonth,
  selectedYear,
  addToast
}) => {
  const [selectedReport, setSelectedReport] = useState('monthly_pf_summary');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/salaries/pf/reports/?report_type=${selectedReport}&year=${selectedYear}&month=${selectedMonth}&format=json`);
      setReportData(res.data);
    } catch (err) {
      console.error('Failed to load PF report:', err);
      addToast?.('Unable to load statutory report data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReport, selectedMonth, selectedYear]);

  const handleDownload = async (format) => {
    try {
      setExportingFormat(format);
      const url = `/salaries/pf/reports/?report_type=${selectedReport}&year=${selectedYear}&month=${selectedMonth}&format=${format}`;
      
      const response = await api.get(url, {
        responseType: 'blob'
      });

      // Derive filename
      let extension = 'csv';
      if (format === 'excel') extension = 'xlsx';
      if (format === 'ecr') extension = 'txt';

      const filename = `EPF_${selectedReport}_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.${extension}`;

      const blob = new Blob([response.data], {
        type: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : format === 'ecr'
          ? 'text/plain'
          : 'text/csv'
      });

      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      addToast?.(`Exported ${filename} successfully!`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      addToast?.(`Failed to download ${format.toUpperCase()} report.`, 'error');
    } finally {
      setExportingFormat(null);
    }
  };

  const records = reportData?.records || reportData?.items || [];
  const totals = reportData?.totals || {};

  return (
    <div className="space-y-6">
      {/* HEADER & REPORT SELECTOR */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              EPFO Statutory Compliance & Reconciliation Reports
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive compliance audits, account reconciliations, and ECR exports under 2026 rules.
            </p>
          </div>

          {/* EXPORT ACTION BUTTONS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleDownload('ecr')}
              disabled={exportingFormat !== null}
              className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-amber-950/40 transition-all disabled:opacity-50"
              title="Official single ECR text file for EPFO Unified Portal upload"
            >
              <Database className="w-3.5 h-3.5" />
              {exportingFormat === 'ecr' ? 'Generating ECR...' : 'Download ECR (.txt)'}
            </button>

            <button
              onClick={() => handleDownload('excel')}
              disabled={exportingFormat !== null}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50"
              title="Download formatted Excel spreadsheet"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              {exportingFormat === 'excel' ? 'Exporting...' : 'Export Excel (.xlsx)'}
            </button>

            <button
              onClick={() => handleDownload('csv')}
              disabled={exportingFormat !== null}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {exportingFormat === 'csv' ? 'Exporting...' : 'CSV'}
            </button>

            <button
              onClick={fetchReport}
              title="Refresh"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* REPORT TYPE DROPDOWN & TABS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
          {REPORT_TYPES.map((rep) => (
            <button
              key={rep.id}
              onClick={() => setSelectedReport(rep.id)}
              className={`p-2.5 rounded-xl text-left transition-all border ${
                selectedReport === rep.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="text-xs font-bold leading-tight">{rep.name}</div>
              <div className="text-[10px] text-slate-400 mt-0.5 truncate">{rep.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* STATUTORY COMPLIANCE DISCLAIMER */}
      <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-300 leading-relaxed">
          <strong className="text-white">Statutory Notice:</strong> This document is an internal statutory reconciliation report generated for establishment payroll records. Official electronic filing requires submission of the generated ECR file on the EPFO Unified Portal.
        </p>
      </div>

      {/* REPORT DATA PREVIEW TABLE */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/40">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              {REPORT_TYPES.find((r) => r.id === selectedReport)?.name}
            </h4>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Period: {selectedMonth}/{selectedYear} • {records.length} Records Loaded
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          {loading ? (
            <div className="py-16 text-center text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
              Compiling compliance records...
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
              No records available for the selected period. Process monthly payroll first.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/90 text-slate-400 font-semibold sticky top-0 border-b border-slate-700">
                <tr>
                  {Object.keys(records[0]).map((colKey) => (
                    <th key={colKey} className="py-2.5 px-3 whitespace-nowrap capitalize">
                      {colKey.replace(/_/g, ' ')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                {records.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    {Object.entries(row).map(([key, val], cIdx) => {
                      const isNumeric = typeof val === 'number' || (!isNaN(val) && val !== '' && !val?.includes?.('-') && key.includes('amount') || key.includes('wage') || key.includes('pf') || key.includes('eps') || key.includes('edli') || key.includes('salary'));
                      return (
                        <td
                          key={cIdx}
                          className={`py-2 px-3 whitespace-nowrap ${
                            isNumeric ? 'text-right font-mono' : ''
                          }`}
                        >
                          {typeof val === 'boolean'
                            ? val ? 'YES' : 'NO'
                            : isNumeric && typeof val === 'number'
                            ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : String(val ?? '')}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default PFReportsTab;

