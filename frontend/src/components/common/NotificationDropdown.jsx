import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, X, Calendar, Home, Clock, DollarSign,
  MapPin, AlertCircle, Sparkles, CheckCircle2, ChevronRight
} from 'lucide-react';
import api from '../../services/api';
import { startSiren, stopSiren } from '../../utils/audioAlert';
import { useAppState } from '../../context/AppStateContext';

export const NotificationDropdown = () => {
  const { addToast } = useAppState();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [lateAlertNotification, setLateAlertNotification] = useState(null);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const knownIds = useRef(new Set());

  // 1. Fetch notifications and unread count
  const fetchNotifications = async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications/'),
        api.get('/notifications/unread_count/')
      ]);

      const newNotifs = notifsRes.data.results || notifsRes.data || [];
      setNotifications(newNotifs);
      setUnreadCount(countRes.data.unread_count || 0);

      // Check for LATE_CLOCK_IN_ALERT
      const unreadLateAlert = newNotifs.find(
        (n) => n.notification_type === 'LATE_CLOCK_IN_ALERT' && !n.is_read
      );
      if (unreadLateAlert && !lateAlertNotification) {
        setLateAlertNotification(unreadLateAlert);
        startSiren();
      }

      // Trigger native push notifications for new incoming unread notifications
      if (knownIds.current.size > 0) {
        newNotifs.forEach((n) => {
          if (!knownIds.current.has(n.id) && !n.is_read && n.notification_type !== 'LATE_CLOCK_IN_ALERT') {
            if ('Notification' in window && Notification.permission === 'granted') {
              const notification = new Notification(n.title, {
                body: n.message,
                icon: '/vite.svg',
              });
              notification.onclick = () => {
                window.focus();
                handleNotificationClick(n);
                notification.close();
              };
            }
          }
        });
      }

      // Update known IDs
      const newKnownIds = new Set();
      newNotifs.forEach((n) => newKnownIds.add(n.id));
      knownIds.current = newKnownIds;
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // 2. Click outside & Escape key listeners to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // 3. Mark single notification as read & navigate
  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      try {
        await api.post(`/notifications/${n.id}/mark_read/`);
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        window.dispatchEvent(new CustomEvent('badge-updated'));
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    }
    setIsOpen(false);

    // Route according to notification type
    const type = n.notification_type || '';
    if (type.startsWith('LEAVE_')) navigate('/leaves');
    else if (type.startsWith('WFH_')) navigate('/wfh');
    else if (type.startsWith('CORRECTION_')) navigate('/attendance');
    else if (type.startsWith('SALARY_')) navigate('/salaries');
    else if (type === 'LOCATION_UPDATE') navigate('/ceo/livemap');
  };

  // 4. Mark all as read
  const markAllRead = async (e) => {
    if (e) e.stopPropagation();
    if (unreadCount === 0 && notifications.every((n) => n.is_read)) {
      setIsOpen(false);
      return;
    }

    try {
      setMarkingAllRead(true);
      await api.post('/notifications/mark_all_read/');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      addToast('All notifications marked as read', 'success');
      window.dispatchEvent(new CustomEvent('badge-updated'));
      setIsOpen(false);
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
      addToast(e.response?.data?.error || 'Failed to mark notifications as read', 'error');
    } finally {
      setMarkingAllRead(false);
    }
  };

  // 5. Late clock-in alert actions
  const handleLateAction = async (actionType) => {
    try {
      await api.post('/attendance/late_action/', { action: actionType });
      stopSiren();
      setLateAlertNotification(null);
      fetchNotifications();
      addToast(
        `Attendance recorded as ${actionType === 'CLOCK_IN' ? 'Present' : 'Absent'}`,
        'success'
      );
      if (actionType === 'CLOCK_IN') {
        navigate('/attendance');
      }
    } catch (e) {
      console.error(e);
      addToast('Failed to process action. Please try again.', 'error');
    }
  };

  // Helper: Format relative timestamp
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
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Helper: Icon and theme per notification type
  const getNotificationConfig = (type = '') => {
    if (type.startsWith('LEAVE_')) {
      return {
        icon: Calendar,
        color: 'text-purple-400',
        bg: 'bg-purple-500/15 border-purple-500/30',
        badge: 'Leave'
      };
    }
    if (type.startsWith('WFH_')) {
      return {
        icon: Home,
        color: 'text-indigo-400',
        bg: 'bg-indigo-500/15 border-indigo-500/30',
        badge: 'WFH'
      };
    }
    if (type.startsWith('CORRECTION_')) {
      return {
        icon: Clock,
        color: 'text-amber-400',
        bg: 'bg-amber-500/15 border-amber-500/30',
        badge: 'Attendance'
      };
    }
    if (type.startsWith('SALARY_')) {
      return {
        icon: DollarSign,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/15 border-emerald-500/30',
        badge: 'Salary'
      };
    }
    if (type === 'LOCATION_UPDATE') {
      return {
        icon: MapPin,
        color: 'text-cyan-400',
        bg: 'bg-cyan-500/15 border-cyan-500/30',
        badge: 'Location'
      };
    }
    return {
      icon: Bell,
      color: 'text-brand-400',
      bg: 'bg-brand-500/15 border-brand-500/30',
      badge: 'Alert'
    };
  };

  return (
    <div ref={dropdownRef} className="relative">
      {/* BELL TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2.5 rounded-xl border transition-all duration-200 cursor-pointer focus:outline-none ${
          isOpen
            ? 'bg-slate-800 text-white border-brand-500/50 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/80 border-slate-800/80'
        }`}
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[1.125rem] h-[1.125rem] px-1 items-center justify-center rounded-full bg-gradient-to-tr from-brand-600 to-indigo-500 text-[10px] font-mono font-extrabold text-white shadow-[0_0_10px_rgba(99,102,241,0.7)] border border-white/20 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* COMPACT & PROFESSIONAL NOTIFICATION DROPDOWN */}
      {isOpen && (
        <div
          className="absolute right-0 top-full mt-2.5 w-[380px] sm:w-[420px] max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_20px_rgba(99,102,241,0.15)] z-[100] overflow-hidden flex flex-col origin-top-right animate-dropdown"
          role="dialog"
          aria-label="Notifications Panel"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30">
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">Notifications</h3>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-extrabold bg-brand-500/20 text-brand-300 border border-brand-500/40 rounded-full shadow-inner">
                    {unreadCount} new
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700/60 rounded-full">
                    All caught up
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  disabled={markingAllRead}
                  className="px-2.5 py-1 text-[11px] font-semibold text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 border border-brand-500/20 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>{markingAllRead ? 'Marking...' : 'Mark all read'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                aria-label="Close notification panel"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Notification Items List */}
          <div className="max-h-[380px] sm:max-h-[420px] overflow-y-auto divide-y divide-white/5 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center text-slate-500 shadow-inner">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-300">No Notifications</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    You're all caught up! There are no new alerts.
                  </p>
                </div>
              </div>
            ) : (
              notifications.map((n) => {
                const cfg = getNotificationConfig(n.notification_type);
                const Icon = cfg.icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3.5 transition-all cursor-pointer relative group flex items-start gap-3 select-none ${
                      n.is_read
                        ? 'opacity-70 hover:opacity-100 hover:bg-white/[0.03]'
                        : 'bg-brand-500/[0.08] hover:bg-brand-500/[0.14]'
                    }`}
                  >
                    {/* Unread Left Border Indicator */}
                    {!n.is_read && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-brand-500 to-indigo-500 rounded-r shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                    )}

                    {/* Type Icon Badge */}
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${cfg.bg} ${cfg.color} shadow-sm mt-0.5`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Content Body */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <h4
                          className={`text-xs font-bold truncate ${
                            n.is_read ? 'text-slate-300' : 'text-white'
                          }`}
                        >
                          {n.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 shrink-0 font-mono font-medium">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 group-hover:text-slate-300 transition-colors leading-relaxed line-clamp-2 break-words">
                        {n.message}
                      </p>
                    </div>

                    {/* Unread Glowing Dot */}
                    {!n.is_read && (
                      <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0 mt-1.5 shadow-[0_0_6px_rgba(99,102,241,0.9)] animate-pulse" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-white/5 bg-slate-900/60 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
              <span>{notifications.length} total alerts</span>
              <span className="font-mono text-[10px]">ESC to close</span>
            </div>
          )}
        </div>
      )}

      {/* LATE CLOCK-IN ALERT MODAL */}
      {lateAlertNotification && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass-panel p-8 rounded-3xl max-w-md w-full border border-rose-500/50 shadow-2xl shadow-rose-500/20 text-center animate-dropdown">
            <div className="w-16 h-16 bg-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/50">
              <Bell className="w-8 h-8 text-rose-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-black text-white mb-2">Missing Attendance!</h2>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              It's past 9:15 AM and you haven't clocked in yet. Are you absent today or do you want to clock in right now?
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleLateAction('MARK_ABSENT')}
                className="px-4 py-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95"
              >
                Mark Absent
              </button>
              <button
                type="button"
                onClick={() => handleLateAction('CLOCK_IN')}
                className="px-4 py-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs transition-all cursor-pointer active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                Clock In Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
