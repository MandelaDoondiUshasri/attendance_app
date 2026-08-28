import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../../services/api';
import { startSiren, stopSiren } from '../../utils/audioAlert';

import { useAppState } from '../../context/AppStateContext';
import EmptyState from './states/EmptyState';

export const NotificationDropdown = () => {
  const { addToast } = useAppState();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [lateAlertNotification, setLateAlertNotification] = useState(null);
  const navigate = useNavigate();
  const knownIds = useRef(new Set());

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications/');
      const newNotifs = res.data.results || res.data || [];
      setNotifications(newNotifs);
      
      const countRes = await api.get('/notifications/unread_count/');
      setUnreadCount(countRes.data.unread_count || 0);

      // Check for LATE_CLOCK_IN_ALERT
      const unreadLateAlert = newNotifs.find(n => n.notification_type === 'LATE_CLOCK_IN_ALERT' && !n.is_read);
      if (unreadLateAlert && !lateAlertNotification) {
        setLateAlertNotification(unreadLateAlert);
        startSiren();
      }

      // Trigger native push notifications for new incoming unread notifications
      if (knownIds.current.size > 0) {
        newNotifs.forEach(n => {
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
      newNotifs.forEach(n => newKnownIds.add(n.id));
      knownIds.current = newKnownIds;

    } catch (e) {
      console.error(e);
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

  const handleNotificationClick = async (n) => {
    // Mark as read if it's unread
    if (!n.is_read) {
      try {
        await api.post(`/notifications/${n.id}/mark_read/`);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (e) {
        console.error(e);
      }
    }
    setIsOpen(false);
    
    // Navigate based on type
    const type = n.notification_type || '';
    if (type.startsWith('LEAVE_')) navigate('/leaves');
    else if (type.startsWith('WFH_')) navigate('/wfh');
    else if (type.startsWith('CORRECTION_')) navigate('/attendance');
    else if (type.startsWith('SALARY_')) navigate('/salaries');
    else if (type === 'LOCATION_UPDATE') navigate('/ceo/livemap');
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark_all_read/');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      addToast('All notifications marked as read', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to mark notifications as read', 'error');
    }
  };

  const handleLateAction = async (actionType) => {
    try {
      await api.post('/attendance/late_action/', { action: actionType });
      stopSiren();
      setLateAlertNotification(null);
      fetchNotifications();
      addToast(`Attendance recorded as ${actionType === 'CLOCK_IN' ? 'Present' : 'Absent'}`, 'success');
      // Reload or navigate appropriately
      if (actionType === 'CLOCK_IN') {
        navigate('/attendance');
      }
    } catch (e) {
      console.error(e);
      addToast('Failed to process action. Please try again.', 'error');
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors focus:outline-none"
        aria-label="View notifications"
      >
        <Bell className="w-5 h-5" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 glass-panel rounded-2xl border border-slate-800 shadow-2xl z-50 overflow-hidden animate-fade-in">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/60">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Notifications {unreadCount > 0 && <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-400 rounded-full">{unreadCount} new</span>}
            </h4>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
            {notifications.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Bell}
                  title="No Notifications"
                  description="You are all caught up! There are no new alerts."
                />
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-4 transition-colors cursor-pointer hover:bg-slate-800 ${n.is_read ? 'opacity-60 bg-transparent' : 'bg-indigo-500/5'}`}
                >
                  <p className="text-xs font-bold text-white mb-1">{n.title}</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                  <p className="text-[10px] text-slate-500 mt-2">{new Date(n.created_at).toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Late Clock-In Alert Modal */}
      {lateAlertNotification && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="glass-panel p-8 rounded-2xl max-w-md w-full border border-red-500/50 shadow-2xl shadow-red-500/20 text-center animate-bounce-subtle">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/50">
              <Bell className="w-8 h-8 text-red-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Missing Attendance!</h2>
            <p className="text-slate-300 mb-8">
              It's past 9:15 AM and you haven't clocked in yet. Are you absent today or do you want to clock in right now?
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleLateAction('MARK_ABSENT')}
                className="btn-glass bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold"
              >
                Mark Absent
              </button>
              <button
                onClick={() => handleLateAction('CLOCK_IN')}
                className="btn-glass bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 font-bold"
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
