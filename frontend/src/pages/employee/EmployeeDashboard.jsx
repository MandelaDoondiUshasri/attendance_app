import React, { useState, useEffect, useRef } from 'react';
import {
  User, CalendarCheck, Home, FileText, Clock, Plus, Camera,
  MapPin, CheckCircle, AlertTriangle, ArrowRight, ShieldCheck
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import Modal from '../../components/common/Modal';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [attendances, setAttendances] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState(null); // 'WFH_SCAN', 'APPLY_LEAVE', 'APPLY_WFH', 'CORRECTION'

  // Form states
  const [leaveForm, setLeaveForm] = useState({ leave_type: '', start_date: '', end_date: '', reason: '' });
  const [wfhForm, setWfhForm] = useState({ date: new Date().toISOString().split('T')[0], reason: '' });
  const [corrForm, setCorrForm] = useState({ date: '', requested_check_in: '', reason: '' });
  const [leaveTypes, setLeaveTypes] = useState([]);

  // WFH Scanner state
  const [wfhScanning, setWfhScanning] = useState(false);
  const [locationState, setLocationState] = useState({ lat: null, lng: null, status: 'Fetching GPS...' });
  const [wfhResult, setWfhResult] = useState(null);

  const videoRef = useRef(null);

  const fetchEmployeeData = async () => {
    try {
      const [userRes, attRes, typeRes] = await Promise.all([
        api.get('/auth/me/'),
        api.get('/attendance/'),
        api.get('/leaves/types/')
      ]);
      setProfile(userRes.data);
      const attList = attRes.data.results || attRes.data || [];
      setAttendances(attList);
      setLeaveTypes(typeRes.data.results || typeRes.data || []);

      const todayStr = new Date().toISOString().split('T')[0];
      const todayRec = attList.find(a => a.date === todayStr);
      setTodayAttendance(todayRec);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  useEffect(() => {
    let activeStream = null;

    const startWebcam = async () => {
      try {
        if (activeModal === 'WFH_SCAN') {
          const userStream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
          });
          activeStream = userStream;
          if (videoRef.current) {
            videoRef.current.srcObject = userStream;
          }
          speakText("Remote check in active. Please look directly at the camera viewport.");
        }
      } catch (err) {
        console.error("Webcam failed:", err);
        speakText("Camera not connected.");
      }
    };

    if (activeModal === 'WFH_SCAN') {
      startWebcam();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [activeModal]);

  const openWfhModal = () => {
    setActiveModal('WFH_SCAN');
    setWfhResult(null);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocationState({ lat: pos.coords.latitude, lng: pos.coords.longitude, status: 'GPS Verified' });
        },
        (err) => {
          setLocationState({ lat: 37.7749, lng: -122.4194, status: 'Fallback GPS Signal' });
        }
      );
    } else {
      setLocationState({ lat: 37.7749, lng: -122.4194, status: 'Default Coordinates' });
    }
  };

  const handleWfhCheckIn = async () => {
    setWfhScanning(true);
    setWfhResult(null);
    speakText("Verifying face biometrics and geolocation signals.");

    if (!videoRef.current) {
      setWfhResult({ success: false, message: 'Camera feed not ready.' });
      speakText("Camera not ready.");
      setWfhScanning(false);
      return;
    }

    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const faceImage = canvas.toDataURL('image/jpeg');

      const res = await api.post('/attendance/wfh/', {
        image_data: faceImage,
        latitude: locationState.lat || 37.7749,
        longitude: locationState.lng || -122.4194,
        device_id: 'WFH-WEB-CAM-01'
      });

      setWfhResult({ success: true, message: res.data.message, attendance: res.data.attendance });
      speakText("Work from home check in recorded successfully.");
      fetchEmployeeData();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'WFH Attendance Failed';
      setWfhResult({
        success: false,
        message: errMsg
      });
      speakText(`Check in failed. ${errMsg}`);
    } finally {
      setWfhScanning(false);
    }
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/leaves/', {
        leave_type: parseInt(leaveForm.leave_type),
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason
      });
      alert('Leave application submitted for approval.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Leave submission failed.');
    }
  };

  const handleApplyWFH = async (e) => {
    e.preventDefault();
    try {
      await api.post('/wfh/', {
        date: wfhForm.date,
        reason: wfhForm.reason
      });
      alert('WFH request submitted for CEO/HR approval.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'WFH submission failed.');
    }
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/attendance/corrections/', {
        date: corrForm.date,
        requested_check_in: new Date(corrForm.date + 'T' + corrForm.requested_check_in).toISOString(),
        reason: corrForm.reason
      });
      alert('Attendance correction request submitted.');
      setActiveModal(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Correction submission failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* EMPLOYEE HEADER & QUICK ACTIONS */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-brand-500/25">
            {profile?.first_name ? profile.first_name[0] : 'E'}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white tracking-tight">{profile?.first_name} {profile?.last_name}</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                {profile?.employee_id || 'EMP-1001'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {profile?.designation || 'Staff Member'} • {profile?.department || 'General'} • Work Mode: <span className="text-indigo-400 font-semibold">{profile?.work_mode || 'OFFICE'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={openWfhModal}
            className="flex-1 md:flex-none px-4 py-2.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all"
          >
            <Camera className="w-4 h-4" /> Mark WFH Attendance
          </button>
          <button
            onClick={() => setActiveModal('APPLY_LEAVE')}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-purple-400" /> Apply Leave
          </button>
          <button
            onClick={() => setActiveModal('APPLY_WFH')}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4 text-indigo-400" /> Apply WFH
          </button>
          <button
            onClick={() => setActiveModal('CORRECTION')}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Clock className="w-4 h-4 text-amber-400" /> Correct Attendance
          </button>
        </div>
      </div>

      {/* TODAY'S ATTENDANCE STATUS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Check-In</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {todayAttendance?.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Checked In'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Check-Out</p>
          <p className="text-xl font-bold text-indigo-400 mt-1">
            {todayAttendance?.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending Check-Out'}
          </p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Today's Working Hours</p>
          <p className="text-xl font-bold text-white mt-1">{todayAttendance?.working_hours || '0.00'} hrs</p>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-slate-800">
          <p className="text-xs font-semibold text-slate-400">Remaining Leave Balance</p>
          <p className="text-xl font-bold text-purple-400 mt-1">{profile?.leave_balance ?? 24} Days</p>
        </div>
      </div>

      {/* ATTENDANCE HISTORY TABLE */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800">
        <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <CalendarCheck className="w-5 h-5 text-brand-400" /> Recent Attendance Records
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/60 text-slate-400 font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Check-In</th>
                <th className="p-3">Check-Out</th>
                <th className="p-3">Hours</th>
                <th className="p-3">Work Mode</th>
                <th className="p-3">Method</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {attendances.length === 0 ? (
                <tr><td colSpan="7" className="p-6 text-center text-slate-500">No attendance records found</td></tr>
              ) : (
                attendances.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-900/40">
                    <td className="p-3 font-semibold text-white">{a.date}</td>
                    <td className="p-3 text-slate-300">{a.check_in ? new Date(a.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 text-slate-300">{a.check_out ? new Date(a.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-3 font-bold text-slate-200">{a.working_hours} h</td>
                    <td className="p-3 text-slate-300">{a.work_mode}</td>
                    <td className="p-3 text-slate-400">{a.attendance_method}</td>
                    <td className="p-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WFH ATTENDANCE SCANNER MODAL */}
      <Modal isOpen={activeModal === 'WFH_SCAN'} onClose={() => setActiveModal(null)} title="WFH Biometric & Geolocation Check-In">
        <div className="space-y-6 text-center">
          <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-left text-xs space-y-1">
            <p className="font-bold text-indigo-400">Security Verification Signal Requirements:</p>
            <p className="text-slate-300">• Approved WFH Request for Today</p>
            <p className="text-slate-300">• Face Scan + Anti-Spoof Liveness Detection</p>
            <p className="text-slate-300">• GPS Geolocation Signal: <span className="font-mono text-emerald-400">{locationState.status} ({locationState.lat?.toFixed(4)}, {locationState.lng?.toFixed(4)})</span></p>
          </div>

          <div className="relative w-full max-w-sm mx-auto h-56 rounded-2xl bg-slate-955 border border-slate-800 flex flex-col items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />
            {wfhScanning && (
              <div className="absolute inset-0 bg-indigo-500/10 z-10 flex flex-col items-center justify-center">
                <div className="absolute left-0 right-0 h-1 bg-indigo-500/80 shadow-md shadow-indigo-500 blur-[1px] animate-[scan_2s_ease-in-out_infinite] z-20"></div>
                <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
                <p className="text-[10px] font-bold text-white mt-2">Verifying biometrics & liveness...</p>
              </div>
            )}
          </div>

          <button
            onClick={handleWfhCheckIn}
            disabled={wfhScanning}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white font-bold text-xs rounded-xl shadow-lg"
          >
            {wfhScanning ? 'Verifying Signals...' : 'RECORD WFH ATTENDANCE'}
          </button>

          {wfhResult && (
            <div className={`p-4 rounded-xl text-xs text-left ${wfhResult.success ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
              <p className="font-bold">{wfhResult.success ? 'Success' : 'Error'}</p>
              <p>{wfhResult.message}</p>
            </div>
          )}
        </div>
      </Modal>

      {/* APPLY LEAVE MODAL */}
      <Modal isOpen={activeModal === 'APPLY_LEAVE'} onClose={() => setActiveModal(null)} title="Apply for Leave">
        <form onSubmit={handleApplyLeave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Leave Type</label>
            <select
              value={leaveForm.leave_type}
              onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">-- Select Leave Type --</option>
              {leaveTypes.map(t => <option key={t.id} value={t.id}>{t.name} (Max {t.days_allowed} days)</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={leaveForm.start_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={leaveForm.end_date}
                onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                required
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason</label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
              required
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl shadow-lg">Submit Application</button>
          </div>
        </form>
      </Modal>

      {/* APPLY WFH MODAL */}
      <Modal isOpen={activeModal === 'APPLY_WFH'} onClose={() => setActiveModal(null)} title="Apply for Work From Home">
        <form onSubmit={handleApplyWFH} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target WFH Date</label>
            <input
              type="date"
              value={wfhForm.date}
              onChange={(e) => setWfhForm({ ...wfhForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Remote Work</label>
            <textarea
              value={wfhForm.reason}
              onChange={(e) => setWfhForm({ ...wfhForm, reason: e.target.value })}
              required
              rows={3}
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 rounded-xl shadow-lg">Submit WFH Request</button>
          </div>
        </form>
      </Modal>

      {/* ATTENDANCE CORRECTION MODAL */}
      <Modal isOpen={activeModal === 'CORRECTION'} onClose={() => setActiveModal(null)} title="Request Attendance Correction">
        <form onSubmit={handleCorrectionSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Attendance Date</label>
            <input
              type="date"
              value={corrForm.date}
              onChange={(e) => setCorrForm({ ...corrForm, date: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Correct Requested Check-In Time</label>
            <input
              type="time"
              value={corrForm.requested_check_in}
              onChange={(e) => setCorrForm({ ...corrForm, requested_check_in: e.target.value })}
              required
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Justification Reason</label>
            <textarea
              value={corrForm.reason}
              onChange={(e) => setCorrForm({ ...corrForm, reason: e.target.value })}
              required
              rows={3}
              placeholder="Explain why biometric check-in was missed (e.g. system turnstile error)..."
              className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 text-xs font-medium text-slate-400 bg-slate-800 rounded-xl">Cancel</button>
            <button type="submit" className="px-4 py-2 text-xs font-bold text-white bg-amber-600 rounded-xl shadow-lg">Submit Correction Request</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeeDashboard;
