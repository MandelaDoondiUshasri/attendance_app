import React, { useState, useEffect, useRef } from 'react';
import { Camera, Fingerprint, CheckCircle2, AlertCircle, RefreshCw, UserCheck, ShieldAlert } from 'lucide-react';
import api from '../../services/api';

export const OperatorDashboard = () => {
  const [activeTab, setActiveTab] = useState('FACE'); // 'FACE' | 'FINGERPRINT'
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const [biometricIdInput, setBiometricIdInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { success: bool, message: str, data: obj }
  const [todaySummary, setTodaySummary] = useState(null);

  const videoRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/attendance/today_summary/');
      setTodaySummary(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleFaceScan = async () => {
    setScanning(true);
    setResult(null);

    try {
      // Simulate live camera snapshot base64 frame capture
      const fakeCameraFrame = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAA=";
      const res = await api.post('/attendance/face/', {
        image_data: fakeCameraFrame,
        employee_id: employeeIdInput || undefined,
        device_id: 'OPERATOR-TERMINAL-01'
      });

      setResult({
        success: true,
        message: res.data.message,
        attendance: res.data.attendance
      });
      fetchSummary();
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Face Verification Failed'
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
        biometric_id: biometricIdInput,
        device_id: 'OPERATOR-FP-01'
      });

      setResult({
        success: true,
        message: res.data.message,
        attendance: res.data.attendance
      });
      fetchSummary();
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || err.response?.data?.message || 'Fingerprint Verification Failed'
      });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Biometric Attendance Terminal</h1>
          <p className="text-xs text-slate-400 mt-1">Authorized Operator Portal for In-Office Face & Fingerprint Check-In</p>
        </div>

        <div className="glass-card px-4 py-2 rounded-xl flex items-center gap-3">
          <UserCheck className="w-5 h-5 text-emerald-400" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Today's Total Count</p>
            <p className="text-lg font-black text-emerald-400">{todaySummary?.total_recorded || 0} Staff Recorded</p>
          </div>
        </div>
      </div>

      {/* MODE SELECTOR TABS */}
      <div className="flex rounded-2xl p-1.5 bg-slate-900 border border-slate-800">
        <button
          onClick={() => { setActiveTab('FACE'); setResult(null); }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'FACE'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>FACE ATTENDANCE</span>
        </button>

        <button
          onClick={() => { setActiveTab('FINGERPRINT'); setResult(null); }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'FINGERPRINT'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Fingerprint className="w-4 h-4" />
          <span>FINGERPRINT ATTENDANCE</span>
        </button>
      </div>

      {/* SCANNING WORKSPACE CARD */}
      <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        {activeTab === 'FACE' ? (
          <div className="space-y-6 text-center">
            {/* Viewfinder Preview Container */}
            <div className="relative w-full max-w-sm mx-auto h-64 rounded-2xl bg-slate-900 border-2 border-dashed border-brand-500/40 flex flex-col items-center justify-center overflow-hidden">
              <div className="absolute inset-4 rounded-xl border border-brand-500/20 pointer-events-none animate-pulse"></div>

              {scanning ? (
                <div className="space-y-3">
                  <RefreshCw className="w-10 h-10 text-brand-400 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-brand-300">Analyzing Face Biometrics & Liveness...</p>
                </div>
              ) : (
                <div className="space-y-2 text-slate-400">
                  <Camera className="w-12 h-12 mx-auto text-brand-500/60" />
                  <p className="text-xs font-semibold text-slate-300">Position face inside camera viewfinder</p>
                  <p className="text-[10px] text-slate-500">Liveness check & Template matching active</p>
                </div>
              )}
            </div>

            <div className="max-w-xs mx-auto">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 text-left">Target Employee ID (Optional search)</label>
              <input
                type="text"
                value={employeeIdInput}
                onChange={(e) => setEmployeeIdInput(e.target.value)}
                placeholder="e.g. EMP-1003"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              onClick={handleFaceScan}
              disabled={scanning}
              className="w-full max-w-sm py-3.5 px-6 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-brand-600/30 transition-all transform active:scale-95"
            >
              {scanning ? 'Processing Scan...' : 'START FACE BIOMETRIC SCAN'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            {/* Fingerprint Sensor Bridge Viewfinder */}
            <div className="relative w-full max-w-sm mx-auto h-64 rounded-2xl bg-slate-900 border-2 border-dashed border-indigo-500/40 flex flex-col items-center justify-center">
              {scanning ? (
                <div className="space-y-3">
                  <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs font-bold text-indigo-300">Reading Biometric Fingerprint Sensor...</p>
                </div>
              ) : (
                <div className="space-y-3 text-slate-400">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                    <Fingerprint className="w-10 h-10" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">Hardware Biometric Bridge Ready</p>
                  <p className="text-[10px] text-slate-500">Scan finger on device or enter Biometric ID</p>
                </div>
              )}
            </div>

            <div className="max-w-xs mx-auto">
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 text-left">Biometric / Employee ID</label>
              <input
                type="text"
                value={biometricIdInput}
                onChange={(e) => setBiometricIdInput(e.target.value)}
                placeholder="e.g. FP-1003 or EMP-1003"
                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white text-center font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleFingerprintScan}
              disabled={scanning}
              className="w-full max-w-sm py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all transform active:scale-95"
            >
              {scanning ? 'Reading Fingerprint...' : 'VERIFY FINGERPRINT'}
            </button>
          </div>
        )}

        {/* VERIFICATION FEEDBACK BANNER RESULT */}
        {result && (
          <div className={`mt-8 p-5 rounded-2xl border ${
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
                <h4 className="text-base font-extrabold">{result.success ? 'Attendance Recorded' : 'Verification Failed'}</h4>
                <p className="text-xs text-slate-200 font-medium">{result.message}</p>

                {result.attendance && (
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-emerald-500/20 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Employee</span>
                      <span className="font-bold text-white">{result.attendance.employee_name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Employee ID</span>
                      <span className="font-bold text-white">{result.attendance.employee_id_code}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Method</span>
                      <span className="font-bold text-white">{result.attendance.attendance_method}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Status</span>
                      <span className="font-bold text-emerald-400">{result.attendance.status}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorDashboard;
