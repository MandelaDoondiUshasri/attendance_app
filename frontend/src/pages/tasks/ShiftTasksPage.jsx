import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, Plus, Search, Filter, Download, Clock, User, 
  Building, CheckCircle2, AlertCircle, PlayCircle, Edit3, Trash2,
  Calendar, FileText, ArrowRight, Layers, Sparkles
} from 'lucide-react';
import api from '../../services/api';
import Modal from '../../components/common/Modal';
import StatusBadge from '../../components/common/StatusBadge';
import { useAuth } from '../../context/AuthContext';

export const ShiftTasksPage = () => {
  const { user } = useAuth();
  const isManagement = user?.role === 'CEO' || user?.role === 'HR';

  const [tasks, setTasks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [taskForm, setTaskForm] = useState({
    employee: '',
    date: new Date().toISOString().split('T')[0],
    title: '',
    description: '',
    planned_tasks: '',
    completed_tasks: '',
    blockers: '',
    hours_spent: '1.0',
    status: 'TODO'
  });

  const [editTaskForm, setEditTaskForm] = useState({
    id: null,
    employee_name: '',
    date: '',
    title: '',
    description: '',
    planned_tasks: '',
    completed_tasks: '',
    blockers: '',
    hours_spent: '0',
    status: 'TODO'
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedDate) params.date = selectedDate;
      if (selectedDept) params.department = selectedDept;
      if (selectedStatus) params.status = selectedStatus;
      if (searchTerm) params.search = searchTerm;

      const res = await api.get('/attendance/tasks/', { params });
      setTasks(res.data.results || res.data || []);
    } catch (e) {
      console.error("Error loading tasks:", e);
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
    fetchTasks();
  }, [selectedDate, selectedDept, selectedStatus, searchTerm]);

  // Handle Export CSV
  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (selectedDate) params.append('date', selectedDate);
    if (selectedDept) params.append('department', selectedDept);
    if (selectedStatus) params.append('status', selectedStatus);
    if (searchTerm) params.append('search', searchTerm);

    const token = localStorage.getItem('access_token');
    const exportUrl = `${api.defaults.baseURL}/attendance/tasks/export-csv/?${params.toString()}`;
    
    // Trigger download with auth header via fetch blob or direct link
    api.get(`/attendance/tasks/export-csv/?${params.toString()}`, { responseType: 'blob' })
      .then((response) => {
        const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
        const link = document.createElement('a');
        link.href = url;
        const dateStr = selectedDate || new Date().toISOString().split('T')[0];
        link.setAttribute('download', `shift_task_tracker_report_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      })
      .catch((err) => {
        console.error("Export error:", err);
        alert("Failed to generate CSV export. Please try again.");
      });
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        date: taskForm.date,
        title: taskForm.title.trim(),
        description: taskForm.description?.trim() || null,
        planned_tasks: taskForm.planned_tasks?.trim() || null,
        completed_tasks: taskForm.completed_tasks?.trim() || null,
        blockers: taskForm.blockers?.trim() || null,
        hours_spent: parseFloat(taskForm.hours_spent) || 0.0,
        status: taskForm.status
      };
      if (isManagement && taskForm.employee) {
        payload.employee = parseInt(taskForm.employee);
      }

      await api.post('/attendance/tasks/', payload);
      alert('Shift task logged successfully!');
      setIsAddModalOpen(false);
      setTaskForm({
        employee: '',
        date: new Date().toISOString().split('T')[0],
        title: '',
        description: '',
        planned_tasks: '',
        completed_tasks: '',
        blockers: '',
        hours_spent: '1.0',
        status: 'TODO'
      });
      fetchTasks();
    } catch (err) {
      console.error("Create task error:", err);
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to log task.');
    }
  };

  const handleOpenEdit = (task) => {
    setEditTaskForm({
      id: task.id,
      employee_name: task.employee_name,
      date: task.date,
      title: task.title,
      description: task.description || '',
      planned_tasks: task.planned_tasks || '',
      completed_tasks: task.completed_tasks || '',
      blockers: task.blockers || '',
      hours_spent: String(task.hours_spent || 0),
      status: task.status
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        date: editTaskForm.date,
        title: editTaskForm.title.trim(),
        description: editTaskForm.description?.trim() || null,
        planned_tasks: editTaskForm.planned_tasks?.trim() || null,
        completed_tasks: editTaskForm.completed_tasks?.trim() || null,
        blockers: editTaskForm.blockers?.trim() || null,
        hours_spent: parseFloat(editTaskForm.hours_spent) || 0.0,
        status: editTaskForm.status
      };

      await api.patch(`/attendance/tasks/${editTaskForm.id}/`, payload);
      alert('Task log updated successfully!');
      setIsEditModalOpen(false);
      fetchTasks();
    } catch (err) {
      console.error("Update task error:", err);
      alert(err.response?.data?.message || err.response?.data?.detail || 'Failed to update task.');
    }
  };

  const handleQuickStatusChange = async (taskId, newStatus) => {
    try {
      await api.patch(`/attendance/tasks/${taskId}/`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      alert('Failed to update task status.');
    }
  };

  const handleDeleteTask = async (taskId, title) => {
    if (!window.confirm(`Delete task "${title}"?`)) return;
    try {
      await api.delete(`/attendance/tasks/${taskId}/`);
      fetchTasks();
    } catch (err) {
      alert('Failed to delete task.');
    }
  };

  // Metrics computation
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const inProgressTasks = tasks.filter(t => t.status === 'IN_PROGRESS').length;
  const todoTasks = tasks.filter(t => t.status === 'TODO').length;
  const totalHoursLogged = tasks.reduce((sum, t) => sum + (parseFloat(t.hours_spent) || 0), 0);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <CheckSquare className="w-6 h-6 text-brand-400" />
            Shift Task Tracker & Daily Work Logs
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Audit employee daily planned deliverables, what was accomplished, and total shift working hours
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-all shadow-md active:scale-95"
            title="Download CSV report of shift tasks and hours worked"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export Shift Tasks CSV
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 active:scale-95"
          >
            <Plus className="w-4 h-4" /> Log Shift Task
          </button>
        </div>
      </div>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Tasks</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2">{totalTasks}</div>
          <div className="text-[10px] text-slate-500 mt-1">Logged for selected filter</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Completed Work</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2">{doneTasks}</div>
          <div className="text-[10px] text-emerald-500/80 mt-1 font-semibold">
            {totalTasks > 0 ? `${Math.round((doneTasks / totalTasks) * 100)}% completion rate` : '0%'}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">In Progress / Active</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <PlayCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2">{inProgressTasks}</div>
          <div className="text-[10px] text-slate-500 mt-1">{todoTasks} pending to start</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800 bg-slate-900/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Task Hours</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-cyan-400 mt-2 font-mono">{totalHoursLogged.toFixed(1)} hrs</div>
          <div className="text-[10px] text-slate-500 mt-1">Logged task duration</div>
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
            placeholder="Search by Employee ID, Name, Task Title, Deliverables..."
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

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500 font-semibold"
          >
            <option value="">All Statuses</option>
            <option value="TODO">To Do</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="DONE">Done / Completed</option>
          </select>
        </div>
      </div>

      {/* SHIFT TASKS & WORK LOGS TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/70 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Employee & Dept</th>
                <th className="p-3">Date & Shift Hours</th>
                <th className="p-3">Task Goal / Title</th>
                <th className="p-3">Planned Deliverables</th>
                <th className="p-3">Work Accomplished</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr><td colSpan="7" className="p-8 text-center text-slate-500">Loading shift tasks and logs...</td></tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-slate-500">
                    No shift task logs found for the selected criteria.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const att = task.attendance_info || {};
                  return (
                    <tr key={task.id} className="hover:bg-slate-900/40 transition-colors">
                      {/* Employee Info */}
                      <td className="p-3 font-semibold text-white">
                        <div className="font-bold text-slate-100">{task.employee_name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                          <span className="font-mono">{task.employee_id_code || 'EMP'}</span>
                          <span>•</span>
                          <span className="text-indigo-400">{task.department_name}</span>
                        </div>
                      </td>

                      {/* Date & Shift Attendance Hours */}
                      <td className="p-3 text-slate-300">
                        <div className="font-mono text-slate-200 font-bold">{task.date}</div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {att.total_hours_worked ? `${att.total_hours_worked}h worked` : '0h shift'}
                          </span>
                          <StatusBadge status={att.status || 'NOT_MARKED'} />
                        </div>
                        {att.check_in && (
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            {att.check_in} {att.check_out ? `- ${att.check_out}` : '(Active)'}
                          </div>
                        )}
                      </td>

                      {/* Task Goal */}
                      <td className="p-3">
                        <div className="font-bold text-slate-200">{task.title}</div>
                        {task.description && (
                          <div className="text-[10px] text-slate-400 mt-0.5 max-w-xs truncate">{task.description}</div>
                        )}
                        <div className="text-[10px] text-slate-500 font-mono mt-1">
                          Task Duration: <span className="font-bold text-slate-300">{task.hours_spent}h</span>
                        </div>
                      </td>

                      {/* Supposed / Planned Tasks */}
                      <td className="p-3 max-w-xs">
                        {task.planned_tasks ? (
                          <div className="p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-indigo-200 text-[11px] whitespace-pre-wrap leading-relaxed">
                            {task.planned_tasks}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px] italic">No plan specified</span>
                        )}
                      </td>

                      {/* What Did He Do (Completed) */}
                      <td className="p-3 max-w-xs">
                        {task.completed_tasks ? (
                          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-200 text-[11px] whitespace-pre-wrap leading-relaxed">
                            {task.completed_tasks}
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[10px] italic">Pending evening log</span>
                        )}
                        {task.blockers && (
                          <div className="mt-1.5 p-1.5 rounded-md bg-rose-950/40 border border-rose-500/20 text-rose-300 text-[10px]">
                            <span className="font-bold">Blocker: </span>{task.blockers}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          task.status === 'DONE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : task.status === 'IN_PROGRESS'
                            ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}>
                          {task.status === 'DONE' && <CheckCircle2 className="w-3 h-3" />}
                          {task.status === 'IN_PROGRESS' && <PlayCircle className="w-3 h-3" />}
                          {task.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(task)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 text-[11px] transition-all"
                            title="Edit task log"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-brand-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteTask(task.id, task.title)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg border border-rose-500/30 text-[11px] transition-all"
                            title="Delete task"
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

      {/* LOG / CREATE TASK MODAL */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Log Daily Shift Task & Deliverables">
        <form onSubmit={handleCreateTask} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          {isManagement && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Assign to Employee (Optional, defaults to Self)</label>
              <select
                value={taskForm.employee}
                onChange={(e) => setTaskForm({ ...taskForm, employee: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
              >
                <option value="">Current User Account</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_id})</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date</label>
              <input
                type="date"
                value={taskForm.date}
                onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={taskForm.status}
                onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
              >
                <option value="TODO">To Do (Planned)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done / Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title / Shift Goal</label>
            <input
              type="text"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              placeholder="e.g. Implement Client Dashboard Authentication & Backend APIs"
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-indigo-300 mb-1">
              📋 Planned Deliverables (Daily Target Objectives)
            </label>
            <textarea
              value={taskForm.planned_tasks}
              onChange={(e) => setTaskForm({ ...taskForm, planned_tasks: e.target.value })}
              rows={3}
              placeholder="1. Build registration API endpoints&#10;2. Refactor JWT auth flow&#10;3. Conduct code review"
              className="w-full p-2.5 bg-slate-900 border border-indigo-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300 mb-1">
              ✅ Work Accomplished (Actual Execution & Output)
            </label>
            <textarea
              value={taskForm.completed_tasks}
              onChange={(e) => setTaskForm({ ...taskForm, completed_tasks: e.target.value })}
              rows={3}
              placeholder="Completed registration API, implemented JWT refresh logic, unit tests written."
              className="w-full p-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hours Logged on Task</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={taskForm.hours_spent}
                onChange={(e) => setTaskForm({ ...taskForm, hours_spent: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1">Blockers / Challenges (Optional)</label>
              <input
                type="text"
                value={taskForm.blockers}
                onChange={(e) => setTaskForm({ ...taskForm, blockers: e.target.value })}
                placeholder="e.g. Waiting for 3rd-party API credentials"
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
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
              Save Shift Task Log
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT TASK MODAL */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Task Log: ${editTaskForm.title}`}>
        <form onSubmit={handleUpdateTask} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Date</label>
              <input
                type="date"
                value={editTaskForm.date}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={editTaskForm.status}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, status: e.target.value })}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-semibold"
              >
                <option value="TODO">To Do (Planned)</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DONE">Done / Completed</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Task Title / Shift Goal</label>
            <input
              type="text"
              value={editTaskForm.title}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-indigo-300 mb-1">
              📋 Planned Deliverables (Daily Target Objectives)
            </label>
            <textarea
              value={editTaskForm.planned_tasks}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, planned_tasks: e.target.value })}
              rows={3}
              placeholder="Morning plan..."
              className="w-full p-2.5 bg-slate-900 border border-indigo-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300 mb-1">
              ✅ Work Accomplished (Actual Execution & Output)
            </label>
            <textarea
              value={editTaskForm.completed_tasks}
              onChange={(e) => setEditTaskForm({ ...editTaskForm, completed_tasks: e.target.value })}
              rows={3}
              placeholder="Evening completion summary..."
              className="w-full p-2.5 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hours Logged on Task</label>
              <input
                type="number"
                step="0.25"
                min="0"
                max="24"
                value={editTaskForm.hours_spent}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, hours_spent: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-rose-300 mb-1">Blockers / Challenges</label>
              <input
                type="text"
                value={editTaskForm.blockers}
                onChange={(e) => setEditTaskForm({ ...editTaskForm, blockers: e.target.value })}
                placeholder="None"
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
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
              Update Task Log
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShiftTasksPage;
