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
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const res = await api.get('/attendance/today_summary/');
      setTodaySummary(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees/');
      const results = res.data.results || res.data || [];
      setEmployees(results.filter(e => e.employment_status === 'ACTIVE'));
    } catch (e) {
      console.error("Error loading active employees:", e);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchEmployees();
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
    const selectedEmp = employees.find(e => e.id.toString() === selectedEmployeeId);
    
    if (!selectedEmp && !biometricIdInput) {
      setResult({ success: false, message: 'Please select an employee finger to simulate placement, or type a Biometric ID.' });
      return;
    }

    setScanning(true);
    setResult(null);
    setScanProgress(0);

    // Simulated progress bar animation
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 150);

    // Wait for the scan animation to finish
    await new Promise(resolve => setTimeout(resolve, 1800));
    clearInterval(interval);

    try {
      const payload = {};
      if (selectedEmp) {
        if (selectedEmp.fingerprint_enrolled && selectedEmp.fingerprint_hash) {
          payload.fingerprint_hash = selectedEmp.fingerprint_hash;
        } else {
          // Simulate placing unregistered finger
          payload.fingerprint_hash = 'FP-TEMPLATE-UNREGISTERED-MOCK-' + Math.random().toString(36).substring(2, 10).toUpperCase();
        }
      } else {
        payload.biometric_id = biometricIdInput;
      }

      const res = await api.post('/attendance/fingerprint/', {
        ...payload,
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
            {/* Interactive simulated fingerprint scanner pad */}
            <div className="max-w-md mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              
              {/* Left Column: Simulated Scanning Pad */}
              <div 
                onClick={!scanning ? handleFingerprintScan : undefined}
                className={`relative h-64 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 group select-none ${
                  scanning 
                    ? 'ring-2 ring-indigo-500/50 border-indigo-400/40 shadow-indigo-950/20' 
                    : 'hover:border-indigo-500/40 hover:shadow-indigo-950/10'
                }`}
              >
                {/* Scanner Glow Overlay */}
                <div className={`absolute inset-0 bg-indigo-500/5 transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${scanning ? 'opacity-100' : ''}`} />

                {scanning ? (
                  <div className="space-y-4 z-10 w-full px-4">
                    {/* Scanning glow light line */}
                    <div className="absolute left-0 right-0 h-1 bg-indigo-400/80 shadow-md shadow-indigo-400 blur-[1px] animate-[scan_2s_ease-in-out_infinite] z-20"></div>
                    
                    <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                      <RefreshCw className="w-16 h-16 text-indigo-400 animate-spin absolute opacity-40" />
                      <Fingerprint className="w-10 h-10 text-indigo-400 animate-pulse" />
                      <span className="text-[10px] font-black text-white absolute">{scanProgress}%</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-300 tracking-wide">Scanning Fingerprint...</p>
                      <p className="text-[9px] text-slate-500 mt-1">Keep finger placed on scanner pad</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 z-10 text-slate-400 transition-all duration-300 group-hover:text-slate-300">
                    <div className="w-20 h-20 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400/80 transition-all duration-300 group-hover:scale-105 group-hover:text-indigo-400 group-hover:bg-indigo-500/20 shadow-md">
                      <Fingerprint className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Biometric Sensor Plate</p>
                      <p className="text-[10px] text-slate-500 mt-1">Click to simulate placing finger</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Simulated Finger Controls & Selection */}
              <div className="text-left space-y-4 bg-slate-900/50 p-5 rounded-2xl border border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Simulate Finger Placement</label>
                  <select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                      if (e.target.value) setBiometricIdInput(''); // Clear typed ID if dropdown is used
                    }}
                    disabled={scanning}
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="">-- Touch Scanner (Select Staff Finger) --</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.fingerprint_enrolled ? 'Enrolled' : 'Not Enrolled'})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEmployeeId && (
                  <div className={`p-3 rounded-lg border text-[11px] font-semibold flex items-center gap-2 ${
                    employees.find(e => e.id.toString() === selectedEmployeeId)?.fingerprint_enrolled
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/5 border-amber-500/20 text-amber-400'
                  }`}>
                    {employees.find(e => e.id.toString() === selectedEmployeeId)?.fingerprint_enrolled ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>Fingerprint is enrolled in database. Verification should pass.</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                        <span>No fingerprint enrolled. Verification will fail.</span>
                      </>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800">
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">Or manually enter Biometric ID (fallback)</label>
                  <input
                    type="text"
                    value={biometricIdInput}
                    disabled={scanning}
                    onChange={(e) => {
                      setBiometricIdInput(e.target.value);
                      setSelectedEmployeeId(''); // Clear selection if typing
                    }}
                    placeholder="e.g. FP-1003 or EMP-1003"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleFingerprintScan}
              disabled={scanning || (!selectedEmployeeId && !biometricIdInput)}
              className="w-full max-w-sm py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-extrabold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 transition-all transform active:scale-95"
            >
              {scanning ? 'Reading Biometric Sensor...' : 'TRIGGER VERIFICATION SCAN'}
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
