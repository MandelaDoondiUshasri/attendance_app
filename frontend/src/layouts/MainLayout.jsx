import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationDropdown from '../components/common/NotificationDropdown';
import {
  LayoutDashboard, Users, CalendarCheck, FileText, Home,
  DollarSign, BarChart3, ShieldCheck, Settings, LogOut, Menu, X, User
} from 'lucide-react';

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const role = user?.role || 'EMPLOYEE';

  const getNavItems = () => {
    switch (role) {
      case 'CEO':
        return [
          { label: 'Executive Dashboard', path: '/ceo/dashboard', icon: LayoutDashboard },
          { label: 'Employees', path: '/employees', icon: Users },
          { label: 'Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'Leave Management', path: '/leaves', icon: FileText },
          { label: 'WFH Requests', path: '/wfh', icon: Home },
          { label: 'Salary Management', path: '/salaries', icon: DollarSign },
          { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
          { label: 'Audit Logs', path: '/audit', icon: ShieldCheck },
          { label: 'Organization Settings', path: '/settings', icon: Settings },
        ];
      case 'HR':
        return [
          { label: 'HR Dashboard', path: '/hr/dashboard', icon: LayoutDashboard },
          { label: 'Employees', path: '/employees', icon: Users },
          { label: 'Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'Leave Requests', path: '/leaves', icon: FileText },
          { label: 'WFH Requests', path: '/wfh', icon: Home },
          { label: 'Reports', path: '/reports', icon: BarChart3 },
        ];
      case 'ATTENDANCE_OPERATOR':
        return [
          { label: 'Terminal Terminal', path: '/operator/dashboard', icon: CalendarCheck },
          { label: "Today's Log", path: '/attendance', icon: FileText },
        ];
      case 'EMPLOYEE':
      default:
        return [
          { label: 'My Dashboard', path: '/employee/dashboard', icon: LayoutDashboard },
          { label: 'My Attendance', path: '/attendance', icon: CalendarCheck },
          { label: 'My Leaves', path: '/leaves', icon: FileText },
          { label: 'My WFH', path: '/wfh', icon: Home },
          { label: 'My Salary History', path: '/salaries', icon: DollarSign },
        ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 glass-panel border-r border-slate-800/80 flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-white">APEX HR</h1>
              <p className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold">Enterprise Platform</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Role Badge Card */}
        <div className="px-4 py-4 border-b border-slate-800/50">
          <div className="glass-card p-3 rounded-xl flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm">
              {user?.first_name ? user.first_name[0] : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.first_name} {user?.last_name}</p>
              <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full bg-brand-500/20 text-brand-400 border border-brand-500/30">
                {role.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                      ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30 font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-4 border-t border-slate-800/80">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all duration-200"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navigation Bar */}
        <header className="h-16 glass-panel border-b border-slate-800/80 px-6 flex items-center justify-between z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800"
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>System Active • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>

          <div className="flex items-center gap-4">
            <NotificationDropdown />
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <User className="w-4 h-4 text-indigo-400" />
              <span>{user?.email}</span>
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
