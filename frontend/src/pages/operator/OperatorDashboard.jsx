import React, { useState, useEffect } from 'react';
import { CalendarCheck, ShieldAlert, Users, Clock } from 'lucide-react';
import api from '../../services/api';

export const OperatorDashboard = () => {
  const [todaySummary, setTodaySummary] = useState(null);
  const [recentClockIns, setRecentClockIns] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [summaryRes, attendanceRes] = await Promise.all([
        api.get('/attendance/today_summary/'),
        api.get('/attendance/?limit=10')
      ]);
      setTodaySummary(summaryRes.data);
      setRecentClockIns(attendanceRes.data.results || attendanceRes.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight font-sans">Attendance Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Live Employee Shift Login/Logout Operations Summary</p>
        </div>

        <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-3">
          <CalendarCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">Today's Total Count</p>
            <p className="text-lg font-black text-emerald-400">{todaySummary?.total_recorded || 0} Staff Logged</p>
          </div>
        </div>
      </div>

      {/* Retirement Warning banner */}
      <div className="glass-panel p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-400 font-sans">Terminal Access Retired</h3>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">
            Biometric face and fingerprint readers are retired. All employees log shifts (Clock-In / Clock-Out) and track work items directly through their own workspaces.
          </p>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">Present Office</p>
            <p className="text-xl font-bold text-white mt-0.5">{todaySummary?.present_count || 0}</p>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">Remote WFH</p>
            <p className="text-xl font-bold text-white mt-0.5">{todaySummary?.wfh_count || 0}</p>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold font-sans">On Leave</p>
            <p className="text-xl font-bold text-white mt-0.5">{todaySummary?.leave_count || 0}</p>
          </div>
        </div>
      </div>

      {/* Live shifts list */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4">Recent Shift Logins</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Employee</th>
                <th className="p-3">Date</th>
                <th className="p-3">Clock-In</th>
                <th className="p-3">Clock-Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Work Mode</th>
                <th className="p-3">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentClockIns.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-500">No shift logins recorded today</td></tr>
              ) : (
                recentClockIns.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{a.employee_name} ({a.employee_id_code})</td>
                    <td className="p-3 text-slate-300">{a.date}</td>
                    <td className="p-3 text-slate-300">{a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 text-slate-300">{a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 font-bold text-slate-200">{a.working_hours} h</td>
                    <td className="p-3 text-indigo-400 font-semibold">{a.work_mode}</td>
                    <td className="p-3 text-slate-400">{a.attendance_method}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OperatorDashboard;
