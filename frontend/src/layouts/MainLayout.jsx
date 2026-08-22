import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationDropdown from '../components/common/NotificationDropdown';
import {
  LayoutDashboard, Users, CalendarCheck, FileText, Home,
  DollarSign, BarChart3, ShieldCheck, Settings, LogOut, Menu, X, User,
  Clock, Activity, Wifi
} from 'lucide-react';

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time ticking digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const role = user?.role || 'EMPLOYEE';

  const getNavItems = () => {
    switch (role) {
      case 'CEO':
        return [
          { label: 'Executive Dashboard', path: '/ceo/dashboard', icon: LayoutDashboard },
          { label: 'Employees & Rosters', path: '/employees', icon: Users },
          { label: 'Live Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'Leave Governance', path: '/leaves', icon: FileText },
          { label: 'WFH Approvals', path: '/wfh', icon: Home },
          { label: 'Salary Control', path: '/salaries', icon: DollarSign },
          { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
          { label: 'System Audit Logs', path: '/audit', icon: ShieldCheck },
          { label: 'Enterprise Settings', path: '/settings', icon: Settings },
        ];
      case 'HR':
        return [
          { label: 'HR Operations', path: '/hr/dashboard', icon: LayoutDashboard },
          { label: 'Employees Roster', path: '/employees', icon: Users },
          { label: 'Live Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'Leave Requests', path: '/leaves', icon: FileText },
          { label: 'WFH Queue', path: '/wfh', icon: Home },
          { label: 'Reports & Exports', path: '/reports', icon: BarChart3 },
        ];
      case 'ATTENDANCE_OPERATOR':
        return [
          { label: 'Biometric Terminal', path: '/operator/dashboard', icon: CalendarCheck },
          { label: "Today's Check-ins", path: '/attendance', icon: FileText },
        ];
      case 'EMPLOYEE':
      default:
        return [
          { label: 'My Workspace', path: '/employee/dashboard', icon: LayoutDashboard },
          { label: 'My Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'Leave Applications', path: '/leaves', icon: FileText },
          { label: 'Remote WFH Check-in', path: '/wfh', icon: Home },
          { label: 'Salary & Compensation', path: '/salaries', icon: DollarSign },
        ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-panel border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/25 ring-1 ring-white/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base tracking-tight text-white">FRG HR</h1>
                <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">LIVE</span>
              </div>
              <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-semibold">Enterprise Core</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Role Badge Card */}
        <div className="px-4 py-3.5 border-b border-slate-800/50 bg-slate-900/40">
          <div className="glass-card p-3 rounded-xl flex items-center gap-3 border border-slate-800/90">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center text-brand-400 font-extrabold text-sm shadow-inner">
              {user?.first_name ? user.first_name[0] : 'U'}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-bold text-white truncate">{user?.first_name || 'Enterprise'} {user?.last_name || 'User'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 tracking-wider">
                  {role.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30 font-bold border border-brand-400/30'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Real-time Connection Status Footer */}
        <div className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-medium text-emerald-400">Connected</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">v1.2.0-prod</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Real-Time Navigation Bar */}
        <header className="h-16 glass-panel border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Live Real-Time Clock with seconds */}
            <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900/70 border border-slate-800 text-xs font-mono text-slate-300 shadow-inner">
              <Clock className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>
                {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                {' • '}
                <span className="font-bold text-white">
                  {currentTime.toLocaleTimeString('en-US', { hour12: true })}
                </span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Operational Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Engine Online</span>
            </div>

            <NotificationDropdown />

            <div className="h-5 w-px bg-slate-800"></div>

            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                {user?.first_name ? user.first_name[0] : 'U'}
              </div>
              <span className="hidden sm:inline-block max-w-[150px] truncate text-slate-200">{user?.email}</span>
            </div>
          </div>
        </header>

        {/* Page View Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
