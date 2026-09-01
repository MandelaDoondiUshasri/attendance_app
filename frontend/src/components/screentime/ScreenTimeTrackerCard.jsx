import React, { useState, useEffect } from 'react';
import { Clock, Monitor, Search, RefreshCw, UserCheck, ShieldCheck, Activity } from 'lucide-react';
import api from '../../services/api';

export const ScreenTimeTrackerCard = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchScreenTime = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.get('/loc/metrics/');
      setData(res.data.results || res.data || []);
    } catch (err) {
      console.error('Failed to load screen time data:', err);
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchScreenTime();
    const interval = setInterval(() => fetchScreenTime(), 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const filteredData = data.filter((emp) => {
    const term = searchTerm.toLowerCase();
    return (
      emp.full_name?.toLowerCase().includes(term) ||
      emp.employee_code?.toLowerCase().includes(term) ||
      emp.department?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 shadow-2xl relative overflow-hidden space-y-6">
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
              <Monitor className="w-5 h-5 text-indigo-400" />
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Employee Screen Time Analytics
            </h2>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            Real-time active workstation engagement and weekly utilization tracking.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-2 bg-black/40 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 w-44 sm:w-56 transition-all shadow-inner"
            />
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchScreenTime(true)}
            disabled={refreshing}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Refresh Screen Time"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Screen Time Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/5 bg-black/20 relative z-10">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3.5 pl-4">Employee</th>
              <th className="p-3.5">Department</th>
              <th className="p-3.5">Today's Screen Time</th>
              <th className="p-3.5">Weekly Screen Time</th>
              <th className="p-3.5 text-right pr-4">Workstation Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Loading screen time metrics...</span>
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">
                  No employee screen time records found.
                </td>
              </tr>
            ) : (
              filteredData.map((emp) => (
                <tr key={emp.employee_id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="p-3.5 pl-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm border border-white/10 overflow-hidden">
                        {emp.avatar ? (
                          <img src={emp.avatar} alt={emp.full_name} className="w-full h-full object-cover" />
                        ) : (
                          emp.full_name?.charAt(0) || 'E'
                        )}
                      </div>
                      <div>
                        <span className="font-bold text-white block text-xs">{emp.full_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono font-medium">{emp.employee_code}</span>
                      </div>
                    </div>
                  </td>

                  <td className="p-3.5 text-slate-300 font-medium">
                    {emp.department || 'General'}
                  </td>

                  <td className="p-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-emerald-400 text-xs">
                        {emp.today_screen_time}
                      </span>
                    </div>
                  </td>

                  <td className="p-3.5">
                    <span className="font-mono font-bold text-indigo-300 text-xs">
                      {emp.weekly_screen_time}
                    </span>
                  </td>

                  <td className="p-3.5 text-right pr-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      emp.is_online
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${emp.is_online ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                      {emp.is_online ? 'Active Now' : 'Idle / Away'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScreenTimeTrackerCard;
