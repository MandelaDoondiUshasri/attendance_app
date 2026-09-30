import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, Filter, Phone, Mail, Edit2,
  Trash2, CheckCircle, XCircle, ShieldCheck, Eye,
  ArrowUpDown, RefreshCw, Sparkles, AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';
import LoadingState from '../../components/common/states/LoadingState';
import ErrorState from '../../components/common/states/ErrorState';
import EmptyState from '../../components/common/states/EmptyState';

export const MaintenanceWorkersPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Detail Modal
  const [viewWorker, setViewWorker] = useState(null);

  // Edit Modal
  const [editModal, setEditModal] = useState({
    isOpen: false,
    worker: null,
    full_name: '',
    phone: '',
    designation: '',
    shift: 'Morning',
    employment_status: 'ACTIVE',
    emergency_contact: '',
    submitting: false
  });

  const fetchWorkers = async () => {
    try {
      setError(null);
      const [workersRes, desgRes] = await Promise.all([
        api.get('/maintenance/workers/'),
        api.get('/employees/designations/')
      ]);
      setWorkers(workersRes.data.results || workersRes.data || []);
      const desgList = desgRes.data.results || desgRes.data || [];
      // Filter designations for Maintenance if applicable
      setDesignations(desgList);
    } catch (err) {
      console.error('Failed to load maintenance workers:', err);
      setError('Unable to load Maintenance workers list. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWorkers();
  };

  const handleToggleStatus = async (worker) => {
    const newStatus = worker.employment_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await api.patch(`/maintenance/workers/${worker.id}/`, {
        employment_status: newStatus
      });
      addToast(`Worker status updated to ${newStatus}`, 'success');
      fetchWorkers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to update status', 'error');
    }
  };

  const openEditModal = (worker) => {
    setEditModal({
      isOpen: true,
      worker,
      full_name: worker.full_name || '',
      phone: worker.phone || '',
      designation: worker.designation || '',
      designation_title: worker.designation_title || 'Worker',
      shift: worker.shift || 'Morning',
      employment_status: worker.employment_status || 'ACTIVE',
      emergency_contact: worker.emergency_contact || '',
      submitting: false
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editModal.worker) return;
    setEditModal(prev => ({ ...prev, submitting: true }));

    try {
      await api.patch(`/maintenance/workers/${editModal.worker.id}/`, {
        full_name: editModal.full_name,
        phone: editModal.phone,
        designation: editModal.designation || null,
        shift: editModal.shift,
        employment_status: editModal.employment_status,
        emergency_contact: editModal.emergency_contact
      });
      addToast(`Worker ${editModal.full_name} updated successfully.`, 'success');
      setEditModal(prev => ({ ...prev, isOpen: false }));
      fetchWorkers();
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save changes.', 'error');
    } finally {
      setEditModal(prev => ({ ...prev, submitting: false }));
    }
  };

  if (loading) return <LoadingState type="full" text="Loading Maintenance Workers..." />;
  if (error) return <ErrorState message={error} onRetry={fetchWorkers} />;

  const filteredWorkers = workers.filter(w => {
    if (shiftFilter !== 'ALL' && w.shift !== shiftFilter) return false;
    if (statusFilter !== 'ALL' && w.employment_status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.employee_id?.toLowerCase().includes(q) ||
      w.designation_title?.toLowerCase().includes(q) ||
      w.phone?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/25 mb-1">
            <Users className="w-3.5 h-3.5" />
            MAINTENANCE ROSTER
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Maintenance Workers
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Manage field technicians, electricians, plumbers, and maintenance workforce.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] transition-all"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => navigate('/maintenance/workers/add')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs tracking-wide shadow-lg shadow-brand-500/20 transition-all hover:scale-[1.02]"
          >
            <Plus className="w-4 h-4" />
            Add Maintenance Worker
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="p-4 rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by worker name, ID, phone..."
            className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Shift Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Shift:</span>
            <select
              value={shiftFilter}
              onChange={e => setShiftFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Shifts</option>
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
              <option value="Night">Night</option>
              <option value="General">General</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-mono pl-2">
            Showing {filteredWorkers.length} of {workers.length}
          </span>
        </div>
      </div>

      {/* WORKERS TABLE */}
      <div className="rounded-2xl bg-[#0B0F19] border border-white/[0.08] shadow-xl overflow-hidden">
        {filteredWorkers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Workers Match Criteria"
              description="Try adjusting your filters or search terms, or add a new worker."
              actionText="Add Worker"
              onAction={() => navigate('/maintenance/workers/add')}
            />
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.01] text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Worker ID</th>
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Phone</th>
                  <th className="py-3.5 px-4">Designation</th>
                  <th className="py-3.5 px-4">Shift</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Today's Attendance</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredWorkers.map(w => {
                  const todayAtt = w.today_attendance || {};
                  const isAct = w.employment_status === 'ACTIVE';

                  return (
                    <tr key={w.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                        {w.employee_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-100">{w.full_name}</div>
                        <div className="text-[10px] text-slate-500">{w.email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-mono">
                        {w.phone || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        <span className="font-medium">{w.designation_title || 'Maintenance Worker'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {w.shift || 'Morning'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={w.employment_status || 'ACTIVE'} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={todayAtt.status || 'NOT_MARKED'} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => setViewWorker(w)}
                            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors"
                            title="View Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(w)}
                            className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-colors"
                            title="Edit Worker Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(w)}
                            className={`p-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                              isAct
                                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/20'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/20'
                            }`}
                            title={isAct ? 'Deactivate Worker' : 'Activate Worker'}
                          >
                            {isAct ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* VIEW WORKER PROFILE MODAL */}
      <Modal
        isOpen={!!viewWorker}
        onClose={() => setViewWorker(null)}
        title={`Worker Profile: ${viewWorker?.full_name || ''}`}
      >
        {viewWorker && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-4 pb-3 border-b border-slate-800">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
                {viewWorker.full_name ? viewWorker.full_name[0] : 'W'}
              </div>
              <div>
                <h4 className="text-base font-bold text-white">{viewWorker.full_name}</h4>
                <p className="text-slate-400">{viewWorker.designation_title} • {viewWorker.employee_id}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={viewWorker.employment_status} />
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                    Shift: {viewWorker.shift || 'Morning'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Email</span>
                <span className="text-slate-200">{viewWorker.email || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Phone</span>
                <span className="text-slate-200">{viewWorker.phone || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Department</span>
                <span className="text-cyan-400 font-semibold">{viewWorker.department_name || 'Maintenance'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Date of Joining</span>
                <span className="text-slate-200">{viewWorker.joining_date || 'N/A'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Emergency Contact</span>
                <span className="text-slate-200">{viewWorker.emergency_contact || 'None'}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-slate-500 font-semibold block uppercase text-[10px]">Gender</span>
                <span className="text-slate-200">{viewWorker.gender || 'Not specified'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setViewWorker(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT WORKER MODAL */}
      <Modal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
        title={`Edit Worker: ${editModal.worker?.employee_id || ''}`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editModal.full_name}
              onChange={e => setEditModal(prev => ({ ...prev, full_name: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Phone Number</label>
              <input
                type="text"
                value={editModal.phone}
                onChange={e => setEditModal(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Shift</label>
              <select
                value={editModal.shift}
                onChange={e => setEditModal(prev => ({ ...prev, shift: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
                <option value="General">General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Designation (Locked)</label>
              <div className="relative">
                <input
                  type="text"
                  disabled
                  value={editModal.designation_title || 'Worker'}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 font-bold cursor-not-allowed select-none text-xs"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-mono">
                  FIXED
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Employment Status</label>
              <select
                value={editModal.employment_status}
                onChange={e => setEditModal(prev => ({ ...prev, employment_status: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Emergency Contact</label>
            <input
              type="text"
              value={editModal.emergency_contact}
              onChange={e => setEditModal(prev => ({ ...prev, emergency_contact: e.target.value }))}
              placeholder="Name & phone number"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
              className="px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editModal.submitting}
              className="px-5 py-2 rounded-xl font-bold bg-brand-600 hover:bg-brand-500 text-white shadow-md"
            >
              {editModal.submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MaintenanceWorkersPage;
