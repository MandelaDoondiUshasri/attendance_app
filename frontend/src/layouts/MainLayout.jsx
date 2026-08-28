import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationDropdown from '../components/common/NotificationDropdown';
import useLoc from '../hooks/useloc';
import api, { API_BASE_URL } from '../services/api';
import {
  LayoutDashboard, Users, CalendarCheck, Calendar, FileText, Home,
  DollarSign, BarChart3, ShieldCheck, Settings, LogOut, Menu, X,
  Clock, Activity, ChevronLeft, ChevronRight, Sparkles, CheckSquare, User, MapPin
} from 'lucide-react';

export const MainLayout = () => {
  const { user, logout, companyName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  useLoc();

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
        ];
      case 'HR':
        return [
          { label: 'HR Command Center', path: '/hr/dashboard', icon: LayoutDashboard },
          { label: 'Staff Directory', path: '/employees', icon: Users },
          { label: 'Live Attendance', path: '/attendance', icon: CalendarCheck, badge: pendingBadges.corrections },
          { label: 'Daily Shift Tracker', path: '/tasks', icon: CheckSquare },
          { label: 'Leave Requests', path: '/leaves', icon: FileText, badge: pendingBadges.leaves },
          { label: 'WFH Queue', path: '/wfh', icon: Home, badge: pendingBadges.wfh },
          { label: 'Salary Control', path: '/salaries', icon: DollarSign },
          { label: 'Company Calendar', path: '/calendar', icon: Calendar },
          { label: 'Operational Reports', path: '/reports', icon: BarChart3 },
          { label: 'System Settings', path: '/settings', icon: Settings },
          { label: 'Live Tracking Map', path: '/ceo/livemap', icon: MapPin },
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
        className={`fixed lg:static inset-y-0 left-0 z-[60] h-full glass-panel border-r border-slate-800/80 flex flex-col transition-all duration-300 ease-in-out shrink-0 ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        {/* Top Branding & Collapse Button */}
        <div className={`px-3.5 py-3 flex items-center border-b border-slate-800/80 h-16 shrink-0 ${isCollapsed && !mobileOpen ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-brand-500/25 ring-1 ring-white/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-extrabold text-sm tracking-tight text-white uppercase truncate max-w-[120px]" title={`${companyName || 'Enterprise'} ${role}`}>{companyName || 'Enterprise'} {role}</h1>
                  <span className="px-1.5 py-0.2 text-[8px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">LIVE</span>
                </div>
                <p className="text-[9px] text-cyan-400 uppercase tracking-widest font-semibold">Enterprise Core</p>
              </div>
            )}
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition-colors shrink-0"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-3 py-3 border-b border-slate-800/50 bg-slate-900/30 shrink-0">
          <div className={`glass-card p-2.5 rounded-xl flex items-center gap-2.5 border border-slate-800/90 ${isCollapsed && !mobileOpen ? 'justify-center' : ''}`}>
            {user?.avatar && !sidebarAvatarError ? (
              <img 
                src={getAvatarUrl(user.avatar)} 
                alt="" 
                onError={() => setSidebarAvatarError(true)}
                className="w-8 h-8 rounded-xl object-cover shrink-0 shadow-inner border border-slate-700/60"
              />
            ) : (
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center text-brand-400 font-extrabold text-xs shadow-inner shrink-0">
                {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
              </div>
            )}
            {(!isCollapsed || mobileOpen) && (
              <div className="overflow-hidden flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{user?.first_name || 'Enterprise'} {user?.last_name || 'User'}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 tracking-wider">
                    {role.replace('_', ' ')}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items (Independently Scrollable) */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden custom-scrollbar select-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.path} className="relative group">
                <NavLink
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30 font-bold border border-brand-400/30'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                    } ${isCollapsed && !mobileOpen ? 'justify-center px-2' : ''}`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {(!isCollapsed || mobileOpen) && (
                    <span className="truncate flex-1">{item.label}</span>
                  )}
                  {(!isCollapsed || mobileOpen) && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/40">
                      {item.badge}
                    </span>
                  )}
                </NavLink>

                {/* Floating Tooltip when Collapsed */}
                {isCollapsed && !mobileOpen && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white text-xs font-semibold rounded-lg shadow-2xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span className="px-1.5 py-0.2 text-[9px] font-bold bg-brand-500 text-white rounded-full">
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
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 shrink-0 space-y-2">
          {(!isCollapsed || mobileOpen) ? (
            <>
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <span className="relative flex h-2.5 w-2.5" title="Connected">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN VIEWPORT (Independently Scrollable Content) */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* Top Header */}
        <header className="min-h-[4rem] h-auto py-2 shrink-0 glass-panel border-b border-slate-800/80 px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3 z-[45]">
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Live Real-Time Clock */}
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
            {/* Live Operational Status */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-400">
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
