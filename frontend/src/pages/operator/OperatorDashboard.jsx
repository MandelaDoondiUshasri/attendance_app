import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Fingerprint, CheckCircle2, AlertCircle, RefreshCw,
  UserCheck, ShieldAlert, Video, VideoOff, Scan, Activity, Clock
} from 'lucide-react';
import api from '../../services/api';

export const OperatorDashboard = () => {
  const [activeTab, setActiveTab] = useState('FACE'); // 'FACE' | 'FINGERPRINT'
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [biometricIdInput, setBiometricIdInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [todaySummary, setTodaySummary] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [recentLogs, setRecentLogs] = useState([]);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/attendance/today_summary/');
      setTodaySummary(res.data);
    } catch (e) {
      console.error('Failed to fetch summary:', e);
    }
  };

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, 15000); // Polling every 15s for live updates
    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Webcam access error / not available:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleFaceScan = async () => {
    setScanning(true);
    setResult(null);

    try {
      let imagePayload = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAA=";

      // Capture frame from active camera if available
      if (videoRef.current && cameraActive) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0);
        imagePayload = canvas.toDataURL('image/jpeg', 0.8);
      }

      const res = await api.post('/attendance/face/', {
        image_data: imagePayload,
        employee_id: employeeIdInput.trim() || undefined,
        device_id: 'FRG-OPERATOR-TERMINAL-01'
      });

      const successData = {
        success: true,
        message: res.data.message || 'Face biometrics matched successfully',
        attendance: res.data.attendance
      };
      setResult(successData);

      if (res.data.attendance) {
        setRecentLogs((prev) => [res.data.attendance, ...prev.slice(0, 4)]);
      }
      fetchSummary();
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Face Biometric Match Failed'
      });
    } finally {
      setScanning(false);
    }
  };

  const handleFingerprintScan = async () => {
    if (!biometricIdInput) {
      setResult({ success: false, message: 'Please enter or scan a valid Fingerprint Biometric ID.' });
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const res = await api.post('/attendance/fingerprint/', {
        biometric_id: biometricIdInput.trim(),
        device_id: 'FRG-OPERATOR-FP-01'
      });

      const successData = {
        success: true,
        message: res.data.message || 'Fingerprint match confirmed',
        attendance: res.data.attendance
      };
      setResult(successData);

      if (res.data.attendance) {
        setRecentLogs((prev) => [res.data.attendance, ...prev.slice(0, 4)]);
      }
      fetchSummary();
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Fingerprint Match Failed'
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Real-time Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-3xl border border-slate-800/80 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">FRG Biometric Attendance Terminal</h1>
            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              LIVE HUD
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">High-Speed Optical Face & Fingerprint Check-in Gateway</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2.5 rounded-2xl flex items-center gap-3 border border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Today's Verified Count</p>
              <p className="text-lg font-black text-emerald-400 leading-none mt-0.5">{todaySummary?.total_recorded || 0} Staff</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex rounded-2xl p-1.5 bg-slate-900/90 border border-slate-800 shadow-inner">
        <button
          onClick={() => { setActiveTab('FACE'); setResult(null); }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'FACE'
              ? 'bg-gradient-to-r from-brand-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30 border border-brand-400/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>FACE RECOGNITION HUD</span>
        </button>

        <button
          onClick={() => { setActiveTab('FINGERPRINT'); setResult(null); }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'FINGERPRINT'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30 border border-indigo-400/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          <span>OPTICAL FINGERPRINT SENSOR</span>
        </button>
      </div>

      {/* Scanning Workspace */}
      <div className="glass-panel-elevated p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {activeTab === 'FACE' ? (
          <div className="space-y-6 text-center">
            {/* Viewfinder Preview Container with Cyber Scanner Laser */}
            <div className="relative w-full max-w-md mx-auto h-72 rounded-2xl bg-slate-950 border-2 border-brand-500/40 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
              {/* Corner Crosshairs */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-cyan-400 pointer-events-none"></div>
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-cyan-400 pointer-events-none"></div>
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-cyan-400 pointer-events-none"></div>
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-cyan-400 pointer-events-none"></div>

              {/* Scanning Laser */}
              {scanning && <div className="scanner-laser"></div>}

              {cameraActive ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <div className="space-y-3 p-4 text-slate-400">
                  <div className="relative inline-block">
                    <div className="w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mx-auto text-brand-400">
                      <Scan className="w-10 h-10 animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Biometric Optical Scanner Ready</p>
                    <p className="text-xs text-slate-400 mt-0.5">Position face within the HUD target crosshairs</p>
                  </div>
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 border border-slate-700 transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" /> Enable Live Camera Feed
                  </button>
                </div>
              )}

              {cameraActive && (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="absolute top-3 right-3 z-10 px-2 py-1 bg-slate-900/80 hover:bg-slate-800 text-rose-400 border border-rose-500/30 rounded-lg text-[10px] font-bold flex items-center gap-1"
                >
                  <VideoOff className="w-3 h-3" /> Stop Camera
                </button>
              )}
            </div>

            <div className="max-w-xs mx-auto">
              <label className="block text-xs font-semibold text-slate-400 mb-1 text-left">Employee ID (Optional quick target)</label>
              <input
                type="text"
                value={employeeIdInput}
                onChange={(e) => setEmployeeIdInput(e.target.value)}
                placeholder="e.g. EMP-1000 or EMP-1001"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center font-mono focus:outline-none focus:border-brand-500 shadow-inner"
              />
            </div>

            <button
              onClick={handleFaceScan}
              disabled={scanning}
              className="w-full max-w-md py-3.5 px-6 bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing Biometric Neural Match...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>TRIGGER FACE BIOMETRIC VERIFICATION</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            {/* Fingerprint Sensor Bridge Viewfinder */}
            <div className="relative w-full max-w-md mx-auto h-72 rounded-2xl bg-slate-950 border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center p-4">
              {scanning ? (
                <div className="space-y-3">
                  <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-sm font-bold text-indigo-300">Reading Capacitive Fingerprint Sensor...</p>
                </div>
              ) : (
                <div className="space-y-3 text-slate-400">
                  <div className="w-24 h-24 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400 shadow-lg shadow-indigo-500/10">
                    <Fingerprint className="w-12 h-12 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Hardware Fingerprint Scanner Ready</p>
                    <p className="text-xs text-slate-400 mt-0.5">Place finger on USB sensor plate or enter Biometric ID</p>
                  </div>
                </div>
              )}
            </div>

            <div className="max-w-xs mx-auto">
              <label className="block text-xs font-semibold text-slate-400 mb-1 text-left">Biometric Badge / Fingerprint ID</label>
              <input
                type="text"
                value={biometricIdInput}
                onChange={(e) => setBiometricIdInput(e.target.value)}
                placeholder="e.g. FP-1000 or EMP-1000"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center font-mono focus:outline-none focus:border-indigo-500 shadow-inner"
              />
            </div>

            <button
              onClick={handleFingerprintScan}
              disabled={scanning}
              className="w-full max-w-md py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {scanning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Matching Minutiae Points...</span>
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4" />
                  <span>VERIFY FINGERPRINT SCAN</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Verification Feedback Result */}
        {result && (
          <div className={`mt-6 p-5 rounded-2xl border ${
            result.success
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          } animate-fade-in`}>
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle2 className="w-8 h-8 flex-shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <ShieldAlert className="w-8 h-8 flex-shrink-0 text-rose-400 mt-0.5" />
              )}
              <div className="space-y-1 text-left flex-1">
                <h4 className="text-base font-extrabold">{result.success ? 'Attendance Verified & Logged' : 'Biometric Verification Failed'}</h4>
                <p className="text-xs text-slate-200 font-medium">{result.message}</p>

                {result.attendance && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-emerald-500/20 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Employee</span>
                      <span className="font-bold text-white">{result.attendance.employee_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Employee ID</span>
                      <span className="font-bold text-white font-mono">{result.attendance.employee_id_code}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Verification</span>
                      <span className="font-bold text-cyan-400">{result.attendance.attendance_method}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Status</span>
                      <span className="font-bold text-emerald-400">{result.attendance.status}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Live Stream Recent Log Ticker */}
      {recentLogs.length > 0 && (
        <div className="glass-panel p-5 rounded-3xl border border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Recent Terminal Scans (Live Stream)
            </span>
          </div>

          <div className="space-y-2">
            {recentLogs.map((log, idx) => (
              <div key={idx} className="glass-card p-3 rounded-xl flex items-center justify-between text-xs border border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    ✓
                  </div>
                  <div>
                    <span className="font-bold text-white">{log.employee_name}</span>
                    <span className="text-[10px] text-slate-400 ml-2 font-mono">({log.employee_id_code})</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-bold text-cyan-300">{log.attendance_method}</span>
                  <span className="text-[10px] font-bold text-emerald-400">{log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OperatorDashboard;
