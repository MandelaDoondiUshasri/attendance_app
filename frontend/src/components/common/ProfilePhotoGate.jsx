import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, ShieldCheck, CheckCircle2, AlertCircle,
  RefreshCw, ArrowRight, Lock, User, Sparkles, LogOut, Check
} from 'lucide-react';
import api from '../../services/api';
import { useAuth, getMediaUrl } from '../../context/AuthContext';
import { useAppState } from '../../context/AppStateContext';

export const ProfilePhotoGate = ({ onSuccess }) => {
  const { user, updateUser, logout, companyName } = useAuth();
  const { addToast } = useAppState();

  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'camera'
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cameraError, setCameraError] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Stop camera stream on unmount or tab switch
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Handle switching tabs
  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    if (tab !== 'camera') {
      stopCameraStream();
    }
    setActiveTab(tab);
    setErrorMessage('');
    if (tab === 'camera' && !photoPreview) {
      startCamera();
    }
  };

  // Start webcam stream
  const startCamera = async () => {
    setCameraError('');
    setIsCameraActive(false);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by your browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error('Camera initialization error:', err);
      let msg = 'Could not access camera. Please check browser camera permissions or upload an image file.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied. Please allow camera permissions in your browser or use file upload.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera device detected on your system. Please use file upload instead.';
      }
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // Capture webcam photo to canvas
  const handleCapturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth || 640, video.videoHeight || 640);

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    // Center crop square
    const startX = ((video.videoWidth || size) - size) / 2;
    const startY = ((video.videoHeight || size) - size) / 2;

    ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoBase64(dataUrl);
    setPhotoPreview(dataUrl);
    setPhotoFile(null); // using base64
    stopCameraStream();
  };

  // File drop / select validation
  const validateAndSelectFile = (file) => {
    setErrorMessage('');
    if (!file) return;

    // Type check
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Please upload a valid image file (JPG, PNG, or WEBP).');
      return;
    }

    // Size check (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('Image size exceeds 5MB. Please choose a smaller photo.');
      return;
    }

    setPhotoFile(file);
    setPhotoBase64(null);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelectFile(file);
    }
  };

  const handleResetPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setPhotoBase64(null);
    setErrorMessage('');
    if (activeTab === 'camera') {
      startCamera();
    }
  };

  // Upload and unlock dashboard
  const handleUploadSubmit = async () => {
    if (!photoFile && !photoBase64) {
      setErrorMessage('Please select or capture a photo first.');
      return;
    }

    setUploading(true);
    setErrorMessage('');

    try {
      let res;
      if (photoBase64) {
        // Base64 from camera
        res = await api.post('/auth/upload-photo/', {
          photo_base64: photoBase64
        });
      } else {
        // Multipart file
        const formData = new FormData();
        formData.append('avatar', photoFile);
        formData.append('profile_photo', photoFile);

        res = await api.post('/auth/upload-photo/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      const updatedUser = res.data?.user || res.data;
      updateUser(updatedUser);
      setUploadSuccess(true);
      addToast('Profile photo verified and saved successfully! Welcome to your dashboard.', 'success');

      setTimeout(() => {
        if (onSuccess) onSuccess(updatedUser);
      }, 1200);
    } catch (err) {
      console.error('Failed to upload profile photo:', err);
      const data = err.response?.data;
      let msg = 'Failed to upload profile photo. Please try again.';
      if (typeof data === 'string') msg = data;
      else if (data?.error) msg = data.error;
      else if (data?.message) msg = data.message;
      else if (data?.detail) msg = data.detail;
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const userName = user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Team Member';

  return (
    <div className="relative min-h-[calc(100vh-5rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Dynamic Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000" />

      <div className="relative w-full max-w-2xl bg-slate-900/90 backdrop-blur-2xl border border-slate-800/80 rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Top Header Badge */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                Action Required
              </span>
              <h2 className="text-xs text-slate-400 font-medium mt-0.5">
                Mandatory Security & Identity Verification
              </h2>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-400 hover:text-slate-200 transition-colors"
            title="Log out of this account"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Welcome & Instructions */}
        <div className="mt-6 text-center">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-brand-500/20 to-emerald-500/20 border border-brand-500/30 mb-3 shadow-lg shadow-brand-500/10">
            <Camera className="w-7 h-7 text-brand-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Upload Your Profile Photo
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Welcome, <span className="text-white font-semibold">{userName}</span>! Company compliance requires every employee to upload an official profile photo before gaining access to the employee dashboard and workspace.
          </p>
        </div>

        {uploadSuccess ? (
          /* Success Animation State */
          <div className="py-12 text-center animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400 mb-4 animate-bounce">
              <Check className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-white">Profile Photo Verified!</h3>
            <p className="text-sm text-emerald-400 mt-1">Unlocking your dashboard and timesheet access...</p>
            <div className="mt-6 flex justify-center">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ) : (
          <>
            {/* Input Selection Tabs */}
            {!photoPreview && (
              <div className="mt-6 flex justify-center">
                <div className="inline-flex p-1 rounded-2xl bg-slate-800/80 border border-slate-700/70">
                  <button
                    type="button"
                    onClick={() => handleTabSwitch('upload')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'upload'
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload Image File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabSwitch('camera')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      activeTab === 'camera'
                        ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take Photo with Camera</span>
                  </button>
                </div>
              </div>
            )}

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Main Interactive Stage */}
            <div className="mt-6">
              {photoPreview ? (
                /* Photo Preview & Quality Check Stage */
                <div className="flex flex-col items-center">
                  <div className="relative group">
                    <div className="w-44 h-44 sm:w-48 sm:h-48 rounded-full overflow-hidden border-4 border-brand-500/40 shadow-2xl shadow-brand-500/20 ring-4 ring-slate-800 bg-slate-950 flex items-center justify-center">
                      <img
                        src={photoPreview}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-2 rounded-full shadow-lg border-2 border-slate-900">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 font-medium">
                    Preview of your official profile picture
                  </p>

                  <button
                    type="button"
                    onClick={handleResetPhoto}
                    disabled={uploading}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white py-1.5 px-3 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Change or Retake Photo</span>
                  </button>
                </div>
              ) : activeTab === 'upload' ? (
                /* File Upload Drag & Drop Area */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-3xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
                      : 'border-slate-700/80 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-950/60'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-400 flex items-center justify-center mx-auto mb-4 group-hover:scale-105 transition-transform">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    Click to browse or drag & drop photo here
                  </h3>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Supports high-resolution JPG, PNG, or WEBP (up to 5MB)
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 text-[11px] text-slate-400 border border-slate-700/60">
                    <Sparkles className="w-3 h-3 text-brand-400" />
                    <span>Professional headshot recommended</span>
                  </div>
                </div>
              ) : (
                /* Webcam Camera Stream Stage */
                <div className="flex flex-col items-center">
                  {cameraError ? (
                    <div className="w-full p-6 rounded-3xl bg-slate-950/60 border border-slate-800 text-center">
                      <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                      <p className="text-xs text-slate-300 max-w-md mx-auto">{cameraError}</p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="mt-4 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl flex items-center justify-center">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        autoPlay
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      <canvas ref={canvasRef} className="hidden" />

                      {/* Face Alignment Overlay Guide */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <div className="w-48 h-56 rounded-full border-2 border-dashed border-white/40 shadow-inner" />
                        <span className="mt-3 text-[11px] font-semibold text-white/80 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                          Center your face here
                        </span>
                      </div>
                    </div>
                  )}

                  {isCameraActive && !cameraError && (
                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="mt-4 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-500 hover:bg-brand-400 text-white font-bold text-sm shadow-lg shadow-brand-500/25 transition-all hover:scale-105"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Capture Photo</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Photo Quality Guidelines */}
            <div className="mt-6 pt-5 border-t border-slate-800/80">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Verification Standards</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-400">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Front-facing face</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Even, clear lighting</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/40 border border-slate-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>No sunglasses / masks</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 pt-4">
              <button
                type="button"
                onClick={handleUploadSubmit}
                disabled={(!photoFile && !photoBase64) || uploading}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-500 hover:to-emerald-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-bold text-sm shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Verifying & Saving Photo...</span>
                  </>
                ) : (
                  <>
                    <span>Save Photo & Unlock Dashboard</span>
                    <ArrowRight className="w-4 h-4 opacity-80" />
                  </>
                )}
              </button>

              <p className="text-center text-[11px] text-slate-400 mt-3">
                Logged in as <span className="text-slate-300 font-mono">{user?.employee_id || user?.email}</span> • Upload is permanent and recorded for enterprise compliance.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfilePhotoGate;
