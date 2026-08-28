import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Camera, Save, User as UserIcon, Phone, Mail, Briefcase, Activity } from 'lucide-react';
import api, { API_BASE_URL } from '../../services/api';

const ProfilePage = () => {
  const { user, updateUser } = useAuth(); // we need to update user context after save
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
      });
      if (user.avatar) {
        let url = user.avatar;
        if (url.includes('backend:8000') || url.includes('localhost:8000') || url.includes('127.0.0.1:8000') || url.includes('0.0.0.0:8000')) {
          const mediaIdx = url.indexOf('/media/');
          if (mediaIdx !== -1) {
            url = url.substring(mediaIdx);
          }
        }
        if (url.startsWith('http://') || url.startsWith('https://')) {
          if (window.location.protocol === 'https:' && url.startsWith('http://')) {
            url = url.replace(/^http:\/\//i, 'https://');
          }
          setAvatarPreview(url);
        } else {
          setAvatarPreview(url.startsWith('/') ? url : `/media/${url}`);
        }
      }
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setMessage({ type: 'error', text: 'Image size must be less than 2MB' });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
      setMessage({ type: '', text: '' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    const submitData = new FormData();
    submitData.append('first_name', formData.first_name);
    submitData.append('last_name', formData.last_name);
    submitData.append('phone_number', formData.phone_number);
    if (avatarFile) {
      submitData.append('avatar', avatarFile);
    }

    try {
      // Let axios automatically set the Content-Type with the correct boundary for FormData
      // We MUST delete it to override the default 'application/json' in api.js
      const response = await api.patch('/auth/me/', submitData, {
        transformRequest: [(data, headers) => {
          delete headers['Content-Type'];
          return data;
        }]
      });
      updateUser(response.data);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Profile</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your personal information and display picture</p>
        </div>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Avatar & Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center">
            <div className="relative inline-block mb-4 group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-900 mx-auto flex items-center justify-center relative">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" onError={() => setAvatarPreview(null)} className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-16 h-16 text-slate-600" />
                )}
                {/* Hover overlay for changing avatar */}
                <div 
                  className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-white mb-1" />
                  <span className="text-xs text-white font-medium">Change DP</span>
                </div>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/jpeg, image/png, image/webp"
                className="hidden" 
              />
            </div>
            
            <h3 className="text-xl font-bold text-white">{user?.first_name} {user?.last_name}</h3>
            <p className="text-brand-400 font-medium text-sm mt-1">{user?.role}</p>
            <div className="mt-4 pt-4 border-t border-slate-800 flex justify-center gap-4 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-400" />
                Active Account
              </div>
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Work Information</h4>
            
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Department</p>
                <p className="text-sm font-medium text-slate-200">{user?.department || 'Not Assigned'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserIcon className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Designation</p>
                <p className="text-sm font-medium text-slate-200">{user?.designation || 'Not Assigned'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Employee ID</p>
                <p className="text-sm font-medium text-slate-200">{user?.employee_id || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Form */}
        <div className="lg:col-span-2">
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-6">Personal Details</h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Last Name</label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">Email address cannot be changed. Contact IT support for changes.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-3.5 w-5 h-5 text-slate-500" />
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleInputChange}
                    placeholder="+1 (555) 000-0000"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
