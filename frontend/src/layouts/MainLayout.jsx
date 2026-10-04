import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationDropdown from '../components/common/NotificationDropdown';
import CompanyLogo from '../components/common/CompanyLogo';
import useLoc from '../hooks/useloc';
import useScreenTimeTracker from '../hooks/useScreenTimeTracker';
import api, { API_BASE_URL } from '../services/api';
import {
  LayoutDashboard, Users, CalendarCheck, Calendar, FileText, Home,
  DollarSign, BarChart3, ShieldCheck, Settings, LogOut, Menu, X,
  Clock, Activity, ChevronLeft, ChevronRight, Sparkles, CheckSquare, User, MapPin, Wrench
} from 'lucide-react';

export const MainLayout = () => {
  const { user, logout, companyName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useLoc();
  useScreenTimeTracker();

  // Dynamic Sidebar states
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingBadges, setPendingBadges] = useState({ leaves: 0, wfh: 0, corrections: 0 });
  const [sidebarAvatarError, setSidebarAvatarError] = useState(false);
  const [topAvatarError, setTopAvatarError] = useState(false);

  // Persist sidebar state
  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  // Real-time ticking digital clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch pending action counts for CEO / HR dynamically
  useEffect(() => {
    if ((['CEO', 'SYSTEM_ADMIN'].includes(user?.role)) || user?.role === 'HR') {
      const fetchBadges = async () => {
        try {
          const [leaveRes, wfhRes, corrRes] = await Promise.all([
            api.get('/leaves/requests/?status=PENDING'),
            api.get('/wfh/requests/?status=PENDING'),
            api.get('/attendance/corrections/?status=PENDING')
          ]);
          const leavesList = leaveRes.data?.results || (Array.isArray(leaveRes.data) ? leaveRes.data : []);
          const wfhList = wfhRes.data?.results || (Array.isArray(wfhRes.data) ? wfhRes.data : []);
          const corrList = corrRes.data?.results || (Array.isArray(corrRes.data) ? corrRes.data : []);
          
          const leavesCount = leavesList.filter(l => l.status === 'PENDING').length;
          const wfhCount = wfhList.filter(w => w.status === 'PENDING').length;
          const corrCount = corrList.filter(c => c.status === 'PENDING').length;
          setPendingBadges({ leaves: leavesCount, wfh: wfhCount, corrections: corrCount });
        } catch (e) {
          // Non-critical badge counter fallback
        }
      };
      fetchBadges();
      const interval = setInterval(fetchBadges, 20000); // Polled every 20s
      window.addEventListener('badge-updated', fetchBadges);
      return () => {
        clearInterval(interval);
        window.removeEventListener('badge-updated', fetchBadges);
      };
    }
  }, [user?.role, location.pathname]);

  const role = user?.role || 'EMPLOYEE';

  const getAvatarUrl = (url) => {
    if (!url) return null;
    // Strip internal docker or local host prefixes
    if (url.includes('backend:8000') || url.includes('localhost:8000') || url.includes('127.0.0.1:8000') || url.includes('0.0.0.0:8000')) {
      const mediaIdx = url.indexOf('/media/');
      if (mediaIdx !== -1) {
        return url.substring(mediaIdx);
      }
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (window.location.protocol === 'https:' && url.startsWith('http://')) {
        return url.replace(/^http:\/\//i, 'https://');
      }
      return url;
    }
    if (url.startsWith('/')) {
      return url;
    }
    return `/media/${url}`;
  };

  const getNavItems = () => {
    switch (role) {
      case 'CEO':
      case 'SYSTEM_ADMIN':
        return [
          { label: 'Executive Dashboard', path: '/ceo/dashboard', icon: LayoutDashboard },
          { label: 'Employees & Rosters', path: '/employees', icon: Users },
          { label: 'Live Attendance', path: '/attendance', icon: CalendarCheck, badge: pendingBadges.corrections },
          { label: 'Daily Shift Tracker', path: '/tasks', icon: CheckSquare },
          { label: 'Leave Governance', path: '/leaves', icon: FileText, badge: pendingBadges.leaves },
          { label: 'Company Calendar', path: '/calendar', icon: Calendar },
          { label: 'WFH Approvals', path: '/wfh', icon: Home, badge: pendingBadges.wfh },
          { label: 'Salary Control', path: '/salaries', icon: DollarSign },
          { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
          { label: 'System Audit Logs', path: '/audit', icon: ShieldCheck },
          { label: 'Enterprise Settings', path: '/settings', icon: Settings },
          { label: 'Live Tracking Map', path: '/ceo/livemap', icon: MapPin },
          { label: 'Maintenance Ops', path: '/maintenance/dashboard', icon: Wrench },
        ];
      case 'HR':
        return [
          { label: 'HR Command Center', path: '/hr/dashboard', icon: LayoutDashboard },
          { label: 'Staff Directory', path: '/employees', icon: Users },
          { label: 'Live Attendance', path: '/attendance', icon: CalendarCheck, badge: pendingBadges.corrections },
          { label: 'Daily Shift Tracker', path: '/tasks', icon: CheckSquare },
          { label: 'Leave Requests', path: '/leaves', icon: FileText, badge: pendingBadges.leaves },
          { label: 'WFH Queue', path: '/wfh', icon: Home, badge: pendingBadges.wfh },
          { label: 'Company Calendar', path: '/calendar', icon: Calendar },
          { label: 'Operational Reports', path: '/reports', icon: BarChart3 },
          { label: 'System Settings', path: '/settings', icon: Settings },
          { label: 'Live Tracking Map', path: '/ceo/livemap', icon: MapPin },
          { label: 'Maintenance Dept', path: '/maintenance/dashboard', icon: Wrench },
        ];
      case 'SUPERVISOR':
        return [
          { label: 'Maintenance Dashboard', path: '/maintenance/dashboard', icon: LayoutDashboard },
          { label: 'Maintenance Workers', path: '/maintenance/workers', icon: Users },
          { label: 'Take Worker Attendance', path: '/maintenance/attendance', icon: CalendarCheck },
          { label: 'Attendance History', path: '/maintenance/attendance/history', icon: Calendar },
          { label: 'Monthly Reports', path: '/maintenance/reports', icon: BarChart3 },
          { label: 'My Clock In / Out', path: '/attendance', icon: Clock },
        ];
      default: // EMPLOYEE
        return [
          { label: 'My Workspace', path: '/employee/dashboard', icon: LayoutDashboard },
          { label: 'My Timesheet', path: '/attendance', icon: CalendarCheck },
          { label: 'Task Submissions', path: '/tasks', icon: CheckSquare },
          { label: 'Leave Applications', path: '/leaves', icon: FileText },
          { label: 'WFH Check-in', path: '/wfh', icon: Home },
          { label: 'Holiday Calendar', path: '/calendar', icon: Calendar },
        ];
    }
  };

  const navItems = [...getNavItems(), { label: 'My Profile', path: '/profile', icon: User }];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-[100dvh] w-full overflow-hidden flex bg-slate-950 text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-md lg:hidden"
        />
      )}

      {/* DYNAMIC SIDEBAR */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-[60] h-full bg-[#0B0F19]/95 backdrop-blur-2xl border-r border-white/[0.08] flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none shadow-[4px_0_24px_-4px_rgba(0,0,0,0.5)] ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-[76px]' : 'lg:w-[264px]'}`}
      >
        {/* Ambient background glows */}
        <div className="pointer-events-none absolute -top-24 -left-20 w-56 h-56 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 -left-24 w-48 h-48 bg-cyan-600/5 rounded-full blur-3xl" />

        {/* Top Branding & Collapse Button */}
        <div className={`px-4 py-3.5 flex items-center border-b border-white/[0.06] bg-white/[0.01] h-16 shrink-0 relative ${isCollapsed && !mobileOpen ? 'justify-center px-2' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="shrink-0 transition-transform duration-200 hover:scale-105">
              <CompanyLogo size="sm" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-[13px] tracking-tight text-white uppercase truncate max-w-[130px]" title={`${companyName || 'Enterprise'} ${role}`}>
                    {companyName || 'FRG'}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    LIVE
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide">
                  {role.replace('_', ' ')} Workspace
                </p>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-150 shadow-sm shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-3 py-3 border-b border-white/[0.06] bg-white/[0.01] shrink-0">
          <div
            onClick={() => navigate('/profile')}
            title="View Profile"
            role="button"
            tabIndex={0}
            className={`group relative p-2.5 rounded-xl flex items-center gap-3 bg-gradient-to-b from-white/[0.04] to-transparent hover:from-white/[0.07] hover:to-white/[0.02] border border-white/[0.07] hover:border-indigo-500/30 transition-all duration-200 cursor-pointer shadow-sm ${
              isCollapsed && !mobileOpen ? 'justify-center p-2' : ''
            }`}
          >
            {/* Subtle ambient hover glow */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/0 via-indigo-500/0 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            <div className="relative shrink-0">
              {user?.avatar && !sidebarAvatarError ? (
                <img 
                  src={getAvatarUrl(user.avatar)} 
                  alt="" 
                  onError={() => setSidebarAvatarError(true)}
                  className="w-9 h-9 rounded-xl object-cover ring-1 ring-white/10 group-hover:ring-indigo-500/40 shadow-sm transition-all"
                />
              ) : (
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600/30 via-slate-800 to-slate-900 border border-white/10 group-hover:border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs shadow-sm transition-all">
                  {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0B0F19]" />
            </div>

            {(!isCollapsed || mobileOpen) && (
              <div className="overflow-hidden flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[13px] font-semibold text-slate-200 group-hover:text-white truncate transition-colors">
                    {user?.first_name || 'Enterprise'} {user?.last_name || 'User'}
                  </p>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all shrink-0 opacity-0 group-hover:opacity-100" />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold tracking-wider rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                    {role.replace('_', ' ')}
                  </span>
                  {(user?.department?.name || (typeof user?.department === 'string' && user.department)) && (
                    <span className="text-[10px] text-slate-400 truncate max-w-[85px]" title={typeof user.department === 'string' ? user.department : user.department.name}>
                      • {typeof user.department === 'string' ? user.department : user.department.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items (Independently Scrollable) */}
        <nav className="flex-1 px-3 py-3 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCalendar = item.icon === CalendarCheck || item.icon === Calendar;
            const isClock = item.icon === Clock;

            return (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500/15 via-indigo-500/10 to-indigo-500/5 text-white font-semibold border border-indigo-500/25 shadow-[0_2px_12px_-2px_rgba(99,102,241,0.2)]'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-white/[0.04] border border-transparent'
                    } ${isCollapsed && !mobileOpen ? 'justify-center px-2 py-2.5' : ''}`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Left accent glowing bar for active item */}
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-indigo-400 to-sky-400 shadow-[0_0_10px_rgba(99,102,241,0.9)]" />
                      )}

                      {/* Highlighted Symbol Badge for Calendar and Clock, cleanly styled for others */}
                      {isCalendar ? (
                        <span className={`p-1.5 rounded-xl border transition-all duration-200 shrink-0 flex items-center justify-center ${
                          isActive 
                            ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400/60 shadow-[0_0_14px_rgba(6,182,212,0.5)] scale-110' 
                            : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.25)] group-hover:bg-cyan-500/25 group-hover:border-cyan-400/50 group-hover:scale-105'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </span>
                      ) : isClock ? (
                        <span className={`p-1.5 rounded-xl border transition-all duration-200 shrink-0 flex items-center justify-center ${
                          isActive 
                            ? 'bg-amber-500/25 text-amber-300 border-amber-400/60 shadow-[0_0_14px_rgba(245,158,11,0.5)] scale-110' 
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.25)] group-hover:bg-amber-500/25 group-hover:border-amber-400/50 group-hover:scale-105'
                        }`}>
                          <Icon className="w-4 h-4 animate-pulse" />
                        </span>
                      ) : (
                        <span className={`p-1.5 rounded-xl border border-transparent transition-all duration-200 shrink-0 flex items-center justify-center ${
                          isActive 
                            ? 'text-indigo-400 scale-105 bg-indigo-500/15 border-indigo-500/30' 
                            : 'text-slate-400 group-hover:text-slate-200 group-hover:scale-105 group-hover:bg-white/[0.04]'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </span>
                      )}

                      {(!isCollapsed || mobileOpen) && (
                        <span className="truncate flex-1 tracking-[-0.01em]">
                          {item.label}
                        </span>
                      )}

                      {(!isCollapsed || mobileOpen) && item.badge > 0 && (
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>

                {/* Floating Tooltip when Collapsed */}
                {isCollapsed && !mobileOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md border border-white/10 text-white text-xs font-medium rounded-lg shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 z-50 flex items-center gap-2">
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-500 text-white rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-white/[0.06] bg-white/[0.01] backdrop-blur-md shrink-0 space-y-2">
          {(!isCollapsed || mobileOpen) ? (
            <>
              {/* Status & Version Pill */}
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[11px] font-medium text-emerald-400/90 tracking-wide">Connected</span>
                </div>
                <span className="font-mono text-[10px] text-slate-500 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.04]">
                  v1.2.0-prod
                </span>
              </div>

              {/* Sign Out Button */}
              <button
                onClick={handleLogout}
                className="group w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-rose-300 bg-white/[0.02] hover:bg-rose-500/10 border border-white/[0.05] hover:border-rose-500/20 transition-all duration-200 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition-colors" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <span className="relative flex h-2.5 w-2.5" title="Connected">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-300 bg-white/[0.02] hover:bg-rose-500/10 border border-white/[0.05] hover:border-rose-500/20 transition-all"
              >
                <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-400 transition-colors" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT (Independently Scrollable Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="min-h-[4rem] h-auto py-2 shrink-0 bg-slate-950/70 backdrop-blur-xl border-b border-white/[0.06] px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 z-[45]">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Live Real-Time Clock & Calendar Highlight Bar */}
            <div className="flex items-center gap-2 sm:gap-3 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-slate-900/60 border border-cyan-500/35 text-xs font-mono text-slate-200 shadow-[0_0_20px_-3px_rgba(6,182,212,0.25)]">
              {/* Highlighted Calendar Symbol & Date */}
              <div className="flex items-center gap-2 text-cyan-300 font-semibold" title="Today's Calendar Date">
                <span className="p-1 rounded-lg bg-cyan-500/25 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.5)] flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-cyan-200" />
                </span>
                <span className="hidden xs:inline tracking-tight font-medium text-slate-200">
                  {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <span className="xs:hidden font-medium text-slate-200">
                  {currentTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>

              <span className="text-cyan-500/40 font-bold">•</span>

              {/* Highlighted Clock Symbol & Real-Time Clock */}
              <div className="flex items-center gap-2 text-amber-300 font-bold" title="Current Real-Time Clock">
                <span className="p-1 rounded-lg bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.5)] flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                </span>
                <span className="font-bold text-white tracking-wider font-mono">
                  {currentTime.toLocaleTimeString('en-US', { hour12: true })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            {/* Live Operational Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400 shadow-sm">
              <Activity className="w-3.5 h-3.5" />
              <span>Live Engine Online</span>
            </div>

            <NotificationDropdown />
          </div>
        </header>

        {/* Page Content Body (Smooth Independent Vertical Scrolling) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
