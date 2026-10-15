import React, { useState, useEffect } from 'react';
import {
  X, RefreshCw, AlertTriangle, CheckCircle2, Server, Database,
  Cpu, Play, Layers, ShieldAlert
} from 'lucide-react';
import api from '../../services/api';
import { useAppState } from '../../context/AppStateContext';

export const NotificationDiagnosticsModal = ({ isOpen, onClose }) => {
  const { addToast } = useAppState();
  const [metrics, setMetrics] = useState(null);
  const [health, setHealth] = useState(null);
  const [diagnostics, setDiagnostics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState(null);
  const [retryingAll, setRetryingAll] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [metricsRes, healthRes, diagRes] = await Promise.all([
        api.get('/notifications/metrics/'),
        api.get('/notifications/health/'),
        api.get('/notifications/diagnostics/')
      ]);
      setMetrics(metricsRes.data);
      setHealth(healthRes.data);
      setDiagnostics(diagRes.data.diagnostic_records || []);
    } catch (err) {
      console.error('Error fetching notification diagnostics:', err);
      addToast('Failed to load notification diagnostic telemetry', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const handleRetry = async (notificationId) => {
    try {
      setRetryingId(notificationId);
      const res = await api.post(`/notifications/${notificationId}/retry/`, { reset_count: true });
      addToast(res.data.message || 'Notification re-queued for delivery', 'success');
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to retry notification', 'error');
    } finally {
      setRetryingId(null);
    }
  };

  const handleRetryAll = async () => {
    try {
      setRetryingAll(true);
      const res = await api.post('/notifications/retry_all_failed/');
      addToast(res.data.message || 'Batch retry initiated', 'success');
      fetchData();
    } catch (err) {
      addToast('Failed to trigger batch retry', 'error');
    } finally {
      setRetryingAll(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby="diag-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 id="diag-title" className="text-lg font-bold text-white tracking-tight">
                Notification Pipeline Diagnostics & Health
              </h2>
              <p className="text-xs text-slate-400">
                Operational metrics, background queue telemetry, and recovery controls
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Health Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Database className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-slate-300">Database Outbox</span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${health?.database === 'ok' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                {health?.database?.toUpperCase() || 'CHECKING'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Cpu className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-medium text-slate-300">Celery/Redis Broker</span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${health?.redis_broker === 'ok' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>
                {health?.redis_broker?.toUpperCase() || 'STANDBY'}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-medium text-slate-300">Queue Latency</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-300">
                {health?.pending_outbox_jobs || 0} pending / {health?.stale_sending_jobs || 0} stale
              </span>
            </div>
          </div>

          {/* Metrics Breakdown Grid */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Delivery Stage Metrics (Durable Architecture)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <span className="text-[11px] text-slate-400 block">Total Created</span>
                <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                  {metrics?.total_notifications || 0}
                </span>
                <span className="text-[10px] text-slate-500 mt-1 block">Durable DB records</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-[11px] text-emerald-400 block">Push Accepted</span>
                <span className="text-xl font-bold font-mono text-emerald-300 mt-0.5 block">
                  {metrics?.status_breakdown?.push_accepted || 0}
                </span>
                <span className="text-[10px] text-emerald-500/70 mt-1 block">Gateway acknowledged</span>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20">
                <span className="text-[11px] text-amber-400 block">Retrying</span>
                <span className="text-xl font-bold font-mono text-amber-300 mt-0.5 block">
                  {metrics?.status_breakdown?.retrying || 0}
                </span>
                <span className="text-[10px] text-amber-500/70 mt-1 block">Exponential backoff</span>
              </div>

              <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/20">
                <span className="text-[11px] text-rose-400 block">Permanently Failed</span>
                <span className="text-xl font-bold font-mono text-rose-300 mt-0.5 block">
                  {metrics?.status_breakdown?.permanently_failed || 0}
                </span>
                <span className="text-[10px] text-rose-500/70 mt-1 block">Dead-letter state</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Delivery Success Rate:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {metrics?.delivery_success_rate_percent || 100}%
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Active Device Subs:</span>
                <span className="font-mono font-bold text-indigo-400">
                  {metrics?.device_stats?.active_subscriptions || 0} / {metrics?.device_stats?.total_subscriptions || 0}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">Inbox Unread Count:</span>
                <span className="font-mono font-bold text-brand-400">
                  {metrics?.read_stats?.unread || 0} unread
                </span>
              </div>
            </div>
          </div>

          {/* Diagnostics / Dead-Letter List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Failed & Retrying Notifications ({diagnostics.length})
                </h3>
              </div>
              {diagnostics.length > 0 && (
                <button
                  onClick={handleRetryAll}
                  disabled={retryingAll}
                  className="px-3 py-1 text-xs font-semibold rounded-lg bg-brand-600 hover:bg-brand-500 text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${retryingAll ? 'animate-spin' : ''}`} />
                  Retry All Eligible
                </button>
              )}
            </div>

            {diagnostics.length === 0 ? (
              <div className="p-6 rounded-xl bg-slate-950/40 border border-slate-800 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-sm font-semibold text-slate-300">No Failed or Retrying Notifications</p>
                <p className="text-xs text-slate-500 mt-1">All attendance notification jobs have been accepted or safely recorded.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {diagnostics.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-white truncate">
                          #{item.id} — {item.title}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-mono uppercase font-bold rounded-full ${item.status === 'retrying' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}`}>
                          {item.status}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">
                          Attempts: {item.attempt_count}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 truncate">
                        Recipient: <span className="text-slate-300">{item.recipient_email}</span> | Category: <span className="text-amber-400 font-mono">{item.last_error_category || 'N/A'}</span>
                      </p>
                      {item.last_error_detail && (
                        <p className="text-[11px] font-mono text-rose-400/80 mt-0.5 truncate">
                          Detail: {item.last_error_detail}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleRetry(item.id)}
                      disabled={retryingId === item.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${retryingId === item.id ? 'animate-spin' : ''}`} />
                      Retry
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center text-xs text-slate-500">
          <span>Browser display is outside app control; in-app inbox guarantees durable recovery.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationDiagnosticsModal;
