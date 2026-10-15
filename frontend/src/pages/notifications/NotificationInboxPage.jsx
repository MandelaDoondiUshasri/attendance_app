import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, Calendar, Home, Clock, DollarSign,
  MapPin, AlertCircle, Sparkles, CheckCircle2, ChevronRight, FileText,
  Search, Filter, RefreshCw, Smartphone, ShieldCheck, AlertTriangle,
  ChevronLeft, ArrowUpRight, Activity, Wifi, WifiOff
} from 'lucide-react';
import api from '../../services/api';
import pushNotificationService from '../../services/pushNotificationService';
import { useAuth } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';
import NotificationDiagnosticsModal from './NotificationDiagnosticsModal';

export const NotificationInboxPage = () => {
  const { user } = useAuth();
  const { addToast } = useAppState();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(15);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pushStatus, setPushStatus] = useState('unknown');
  const [enablingPush, setEnablingPush] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const isManagement = ['CEO', 'HR', 'SYSTEM_ADMIN'].includes(user?.role);

  // 1. Check Push Permission on this device
  useEffect(() => {
    if (pushNotificationService.isSupported()) {
      setPushStatus(pushNotificationService.getPermission());
    } else {
      setPushStatus('unsupported');
    }
  }, []);

  // 2. Fetch Notifications with persistent recovery
  const fetchInbox = useCallback(async (page = 1, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        page: page,
        page_size: pageSize
      };

      if (activeTab === 'UNREAD') {
        params.is_read = 'false';
      } else if (activeTab === 'ATTENDANCE') {
        // Attendance related types
        // Let server filter or client partition
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const [listRes, countRes] = await Promise.all([
        api.get('/notifications/', { params }),
        api.get('/notifications/unread_count/')
      ]);

      const data = listRes.data;
      const results = data.results || (Array.isArray(data) ? data : []);
      setNotifications(results);
      setTotalCount(data.count || results.length);
      setUnreadCount(countRes.data?.unread_count || 0);
      setCurrentPage(page);
    } catch (err) {
      console.error('Failed to load notification inbox:', err);
      if (!silent) {
        addToast('Could not synchronize inbox from server', 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [activeTab, searchQuery, pageSize, addToast]);

  // 3. Online/Offline & Focus Auto-Sync (Section 7)
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      addToast('Back online. Synchronizing notifications...', 'info');
      fetchInbox(currentPage, true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      addToast('Working offline. Notifications cached.', 'warning');
    };

    const handleFocus = () => {
      fetchInbox(currentPage, true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('badge-updated', () => fetchInbox(currentPage, true));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('badge-updated', () => fetchInbox(currentPage, true));
    };
  }, [fetchInbox, currentPage, addToast]);

  // Initial and tab-change trigger
  useEffect(() => {
    fetchInbox(1);
  }, [activeTab, fetchInbox]);

  // 4. Mark single as read
  const handleMarkRead = async (notif, e) => {
    if (e) e.stopPropagation();
    try {
      await api.post(`/notifications/${notif.id}/mark_read/`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent('badge-updated'));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  // 5. Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
      addToast('All notifications marked as read', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
    } catch (err) {
      addToast('Failed to mark all as read', 'error');
    }
  };

  // 6. Navigation router per notification
  const handleCardClick = async (notif) => {
    if (!notif.is_read) {
      await handleMarkRead(notif);
    }

    const type = notif.notification_type || '';
    if (type.startsWith('ATTENDANCE_') || type.startsWith('CORRECTION_')) {
      navigate('/attendance');
    } else if (type.startsWith('EARLYPASS_')) {
      navigate('/attendance/early-pass');
    } else if (type.startsWith('LEAVE_')) {
      navigate('/leaves');
    } else if (type.startsWith('WFH_')) {
      navigate('/wfh');
    } else if (type === 'PAYSLIP_RELEASED') {
      navigate('/employee/payslips');
    } else if (type.startsWith('SALARY_')) {
      navigate('/salaries');
    } else if (type === 'LOCATION_UPDATE') {
      navigate('/ceo/livemap');
    } else {
      navigate('/attendance');
    }
  };

  // 7. Enable Push Notifications on this device
  const handleEnablePush = async () => {
    setEnablingPush(true);
    try {
      const res = await pushNotificationService.subscribe();
      if (res.success) {
        setPushStatus('granted');
        addToast('Push notifications successfully enabled on this device!', 'success');
      } else {
        if (res.reason === 'denied') {
          setPushStatus('denied');
          addToast('Notification permission was blocked in browser settings.', 'warning');
        } else {
          addToast(res.error || 'Could not register push notifications.', 'error');
        }
      }
    } catch (err) {
      addToast('Failed to enable push notifications', 'error');
    } finally {
      setEnablingPush(false);
    }
  };

  // Helper: format relative time
  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    try {
      const now = new Date();
      const date = new Date(dateStr);
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  // Helper: icon & style config per notification type
  const getTypeConfig = (type = '') => {
    if (type.startsWith('ATTENDANCE_') || type.startsWith('CORRECTION_')) {
      return {
        icon: Clock,
        label: 'Attendance',
        border: 'border-amber-500/30',
        bg: 'bg-amber-500/10',
        text: 'text-amber-400'
      };
    }
    if (type.startsWith('EARLYPASS_')) {
      return {
        icon: Clock,
        label: 'EarlyPass',
        border: 'border-orange-500/30',
        bg: 'bg-orange-500/10',
        text: 'text-orange-400'
      };
    }
    if (type.startsWith('LEAVE_')) {
      return {
        icon: Calendar,
        label: 'Leave',
        border: 'border-purple-500/30',
        bg: 'bg-purple-500/10',
        text: 'text-purple-400'
      };
    }
    if (type.startsWith('WFH_')) {
      return {
        icon: Home,
        label: 'WFH',
        border: 'border-indigo-500/30',
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400'
      };
    }
    if (type === 'PAYSLIP_RELEASED' || type.startsWith('SALARY_')) {
      return {
        icon: DollarSign,
        label: 'Payroll',
        border: 'border-emerald-500/30',
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400'
      };
    }
    return {
      icon: Bell,
      label: 'System Alert',
      border: 'border-brand-500/30',
      bg: 'bg-brand-500/10',
      text: 'text-brand-400'
    };
  };

  // Helper: status badge renderer
  const renderDeliveryBadge = (notif) => {
    const st = notif.status;
    switch (st) {
      case 'push_accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Push Accepted
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" /> Push Retrying
          </span>
        );
      case 'permanently_failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <AlertCircle className="w-3 h-3 text-rose-400" /> Push Failed (Saved in Inbox)
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <AlertTriangle className="w-3 h-3 text-orange-400" /> Device Expired
          </span>
        );
      case 'created':
      case 'queued':
      case 'sending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3 h-3 text-indigo-400" /> Saved in Inbox
          </span>
        );
    }
  };

  // Client-side filtering if tabs partition records
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'UNREAD') return !n.is_read;
    if (activeTab === 'ATTENDANCE') {
      const t = n.notification_type || '';
      return t.startsWith('ATTENDANCE_') || t.startsWith('CORRECTION_') || t.startsWith('EARLYPASS_') || t === 'LATE_CLOCK_IN_ALERT';
    }
    if (activeTab === 'LEAVES_WFH') {
      const t = n.notification_type || '';
      return t.startsWith('LEAVE_') || t.startsWith('WFH_');
    }
    if (activeTab === 'PAYROLL') {
      const t = n.notification_type || '';
      return t.startsWith('SALARY_') || t === 'PAYSLIP_RELEASED';
    }
    return true;
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* ─── Top Header Banner ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 border border-white/10 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-white/20">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Notification Inbox</h1>
              {unreadCount > 0 && (
                <span className="px-2.5 py-0.5 text-xs font-mono font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 flex items-center gap-2">
              Durable audit log of attendance events with zero silent loss.
              {isOnline ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <Wifi className="w-3 h-3" /> Live Sync
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <WifiOff className="w-3 h-3" /> Offline Mode
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {isManagement && (
            <button
              onClick={() => setShowDiagnostics(true)}
              className="px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-2 transition-all shadow-sm"
              title="View queue telemetry and diagnostics"
            >
              <Activity className="w-4 h-4 text-brand-400" />
              Pipeline Health
            </button>
          )}

          <button
            onClick={() => fetchInbox(currentPage)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 transition-all"
            title="Refresh inbox"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-bold shadow-[0_0_15px_rgba(99,102,241,0.3)] flex items-center gap-2 transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* ─── Push Subscription Device Banner ──────────────────────────────── */}
      {pushStatus !== 'granted' && pushStatus !== 'unsupported' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-brand-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Enable Device Push Notifications</h3>
              <p className="text-xs text-slate-400">
                Receive instant phone & browser alerts for check-ins, early pass approvals, and leave updates.
              </p>
            </div>
          </div>
          <button
            onClick={handleEnablePush}
            disabled={enablingPush}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 transition-all shrink-0 disabled:opacity-50"
          >
            <Smartphone className="w-4 h-4" />
            {enablingPush ? 'Registering Device...' : 'Enable on this Device'}
          </button>
        </div>
      )}

      {/* ─── Filter Tabs & Search Bar ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'UNREAD', label: `Unread (${unreadCount})` },
            { id: 'ATTENDANCE', label: 'Attendance' },
            { id: 'LEAVES_WFH', label: 'Leaves & WFH' },
            { id: 'PAYROLL', label: 'Payroll' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.35)]'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notification text..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900/90 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-brand-500/60 transition-colors"
          />
        </div>
      </div>

      {/* ─── Notification List ────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {loading && notifications.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto mb-3"></div>
            <p className="text-xs font-semibold text-slate-400">Loading notifications from database...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-16 text-center rounded-2xl bg-slate-900/40 border border-white/5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-300">No notifications found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {activeTab === 'UNREAD'
                ? "You are all caught up! No unread notifications right now."
                : "Eligible attendance events, approvals, and alerts will appear here permanently."}
            </p>
          </div>
        ) : (
          filteredNotifications.map((n) => {
            const config = getTypeConfig(n.notification_type);
            const Icon = config.icon;

            return (
              <div
                key={n.id}
                onClick={() => handleCardClick(n)}
                className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  !n.is_read
                    ? 'bg-slate-900/95 border-brand-500/40 shadow-[0_4px_20px_rgba(99,102,241,0.08)] hover:border-brand-500/70 hover:bg-slate-850'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80 text-slate-300'
                }`}
              >
                {/* Left Active Stripe */}
                {!n.is_read && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-500 to-indigo-600 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                )}

                {/* Content section */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className={`p-2.5 rounded-xl ${config.bg} ${config.border} border ${config.text} shrink-0 mt-0.5`}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-brand-300 transition-colors">
                        {n.title}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-full ${config.bg} ${config.text} border ${config.border}`}>
                        {config.label}
                      </span>
                      {renderDeliveryBadge(n)}
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse"></span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-1 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>

                    <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-slate-500">
                      <span>{formatTimeAgo(n.created_at)}</span>
                      <span>•</span>
                      <span>Event #{n.id}</span>
                      {n.read_at && (
                        <>
                          <span>•</span>
                          <span className="text-slate-400">Read</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(n, e)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-brand-400" />
                      Mark read
                    </button>
                  )}
                  <div className="p-2 rounded-lg bg-slate-800/40 group-hover:bg-brand-500/20 group-hover:text-brand-400 text-slate-400 transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── Pagination Controls ─────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
          <div>
            Showing <span className="text-white font-mono font-bold">{notifications.length}</span> of <span className="text-white font-mono font-bold">{totalCount}</span> records
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInbox(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono font-bold text-white bg-slate-800 rounded-lg">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => fetchInbox(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Diagnostics Modal ────────────────────────────────────────────── */}
      {showDiagnostics && (
        <NotificationDiagnosticsModal
          isOpen={showDiagnostics}
          onClose={() => setShowDiagnostics(false)}
        />
      )}
    </div>
  );
};

export default NotificationInboxPage;
