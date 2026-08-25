import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, Download, Clock, User, 
  Building, CheckCircle2, AlertCircle, PlayCircle, Edit3, Trash2,
  Calendar, FileText, ArrowRight, Layers, Sparkles, FileSpreadsheet
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export const ShiftTrackerPage = () => {
  const { user } = useAuth();
  const isManagement = user?.role === 'CEO' || user?.role === 'HR';

  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [reportForm, setReportForm] = useState({
    employee: '',
    date: new Date().toISOString().split('T')[0],
    report_content: ''
  });

  const [editReportForm, setEditReportForm] = useState({
    id: null,
    employee_name: '',
    date: '',
    report_content: ''
  });

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedDept) params.department = selectedDept;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/attendance/shift-reports/', { params });
      setReports(res.data.results || res.data || []);
    } catch (e) {
      console.error("Error loading reports:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      if (isManagement) {
        const [deptRes, empRes] = await Promise.all([
          api.get('/employees/departments/'),
          api.get('/employees/')
        ]);
        setDepartments(deptRes.data.results || deptRes.data || []);
        setEmployees(empRes.data.results || empRes.data || []);
      }
    } catch (e) {
      console.error("Error fetching metadata:", e);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [isManagement]);

  useEffect(() => {
    fetchReports();
  }, [selectedDate, selectedDept, searchTerm]);


  const handleCreateReport = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        date: reportForm.date,
        report_content: reportForm.report_content.trim()
      };
      if (isManagement && reportForm.employee) {
        payload.employee = parseInt(reportForm.employee);
      }

      await api.post('/attendance/shift-reports/', payload);
      alert('Shift report submitted successfully!');
      setIsAddModalOpen(false);
      setReportForm({
        employee: '',
        date: new Date().toISOString().split('T')[0],
        report_content: ''
      });
      fetchReports();
    } catch (err) {
      console.error("Create report error:", err);
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to submit report.');
    }
  };

  const handleOpenEdit = (report) => {
    setEditReportForm({
      id: report.id,
      employee_name: report.employee_name,
      date: report.date,
      report_content: report.report_content || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateReport = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        date: editReportForm.date,
        report_content: editReportForm.report_content.trim()
      };

      await api.patch(`/attendance/shift-reports/${editReportForm.id}/`, payload);
      alert('Report updated successfully!');
      setIsEditModalOpen(false);
      fetchReports();
    } catch (err) {
      console.error("Update report error:", err);
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to update report.');
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm(`Delete this shift report?`)) return;
    try {
      await api.delete(`/attendance/shift-reports/${reportId}/`);
      fetchReports();
    } catch (err) {
      alert('Failed to delete report.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedDept) params.department = selectedDept;
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/attendance/shift-reports/export-excel/', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Daily_Shift_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Excel export error:", err);
      alert('Failed to export Excel report.');
    }
  };

  const handleExportCSV = async () => {
    try {
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedDept) params.department = selectedDept;
      if (searchTerm) params.search = searchTerm;

      const response = await api.get('/attendance/shift-reports/export-csv/', {
        params,
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Daily_Shift_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export error:", err);
      alert('Failed to export CSV report.');
    }
  };

  const totalReports = reports.length;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-brand-400" />
            Daily Shift Tracker
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Submit and review daily work reports of all employees
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 font-bold text-xs rounded-xl border border-emerald-500/30 flex items-center gap-2 transition-all shadow-md active:scale-95 hover:border-emerald-400/50"
            title="Download beautifully organized Microsoft Excel (.xlsx) report"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Export Excel
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            title="Download CSV raw file"
          >
            <Download className="w-4 h-4 text-slate-400" /> CSV
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Submit Report
          </button>
        </div>
      </div>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Reports</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">{totalReports}</div>
          <div className="text-[10px] text-slate-500 mt-1">Submitted for selected filter</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Employee ID, Name, or Report Content..."
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 border border-slate-800 rounded-xl">
            <Calendar className="w-3.5 h-3.5 text-brand-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none font-mono"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="text-[10px] text-slate-500 hover:text-slate-300 font-bold ml-1"
                title="Clear date filter to view all dates"
              >
                Clear
              </button>
            )}
          </div>

          {/* Department Filter (Management only) */}
          {isManagement && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* SHIFT REPORTS TABLE */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800">
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <table className="w-full text-left text-xs min-w-[850px]">
            <thead className="bg-slate-900/70 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3 w-1/4">Employee & Date</th>
                <th className="p-3 w-1/6">Attendance Status</th>
                <th className="p-3 w-1/2">Daily Work Report</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan="4" className="p-8 text-center text-slate-500">Loading shift reports...</td></tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-slate-500">
                    No shift reports found for the selected criteria.
                  </td>
                </tr>
              ) : (
                reports.map((report) => {
                  const att = report.attendance_info || {};
                  return (
                    <tr key={report.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Employee Info & Date */}
                      <td className="p-3">
                        <div className="font-bold text-slate-100">{report.employee_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-mono">{report.employee_id_code || 'EMP'}</span>
                          <span>•</span>
                          <span className="text-indigo-400">{report.department_name}</span>
                        </div>
                        <div className="font-mono text-slate-300 font-bold mt-2">{report.date}</div>
                      </td>

                      {/* Attendance Status */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge status={att.status || 'NOT_MARKED'} />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {att.total_hours_worked ? `${att.total_hours_worked}h worked` : '0h shift'}
                          </span>
                        </div>
                        {att.check_in && (
                          <div className="text-[9px] text-slate-500 font-mono mt-1">
                            {att.check_in} {att.check_out ? `- ${att.check_out}` : '(Active)'}
                          </div>
                        )}
                      </td>

                      {/* Work Report Content */}
                      <td className="p-3">
                        {report.report_content ? (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-300 text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                            {report.report_content}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px] italic">No report content provided.</span>
                        )}
                        <div className="text-[9px] text-slate-600 font-mono mt-1">
                          Submitted at: {new Date(report.created_at).toLocaleString()}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(report)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-[11px] transition-all"
                            title="Edit report"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteReport(report.id)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 text-[11px] transition-all"
                            title="Delete report"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* LOG / CREATE REPORT MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Submit Daily Work Report">
        <form onSubmit={handleCreateReport} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {isManagement && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Employee (Optional, defaults to Self)</label>
              <select
                value={reportForm.employee}
                onChange={(e) => setReportForm({ ...reportForm, employee: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
              >
                <option value="">Current User Account</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
            <input
              type="date"
              value={reportForm.date}
              onChange={(e) => setReportForm({ ...reportForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-300 mb-1">
              📝 Daily Work Report
            </label>
            <textarea
              value={reportForm.report_content}
              onChange={(e) => setReportForm({ ...reportForm, report_content: e.target.value })}
              rows={8}
              required
              placeholder="Please provide a detailed report of what you worked on today, any blockers faced, and deliverables accomplished."
              className="w-full p-3 bg-slate-900 border border-brand-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-mono resize-y"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg"
            >
              Submit Report
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT REPORT MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Work Report`}>
        <form onSubmit={handleUpdateReport} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Date</label>
            <input
              type="date"
              value={editReportForm.date}
              onChange={(e) => setEditReportForm({ ...editReportForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-300 mb-1">
              📝 Daily Work Report
            </label>
            <textarea
              value={editReportForm.report_content}
              onChange={(e) => setEditReportForm({ ...editReportForm, report_content: e.target.value })}
              rows={8}
              required
              placeholder="Update your daily report..."
              className="w-full p-3 bg-slate-900 border border-brand-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 font-mono resize-y"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl shadow-lg"
            >
              Update Report
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShiftTrackerPage;
