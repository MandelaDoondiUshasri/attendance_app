import React, { useState, useEffect, useRef } from 'react';
import { useAuth, getMediaUrl } from '../../context/AuthContext';
import { Camera, Save, User as UserIcon, Phone, Mail, Briefcase, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';
import { useAppState } from '../../context/AppStateContext';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useAppState();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
  });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [passwordData, setPasswordData] = useState({ old_password: '', new_password: '', confirm_password: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
      });
      if (user.avatar) {
        setAvatarPreview(getMediaUrl(user.avatar));
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
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage({ type: 'error', text: 'Image size must be less than 5MB' });
        addToast('Image size must be less than 5MB', 'error');
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
    submitData.append('first_name', formData.first_name.trim());
    submitData.append('last_name', formData.last_name.trim());
    submitData.append('phone_number', formData.phone_number.trim());
    if (avatarFile) {
      submitData.append('avatar', avatarFile);
    }

    try {
      const response = await api.patch('/auth/me/', submitData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      updateUser(response.data);
      if (response.data?.avatar) {
        setAvatarPreview(getMediaUrl(response.data.avatar));
      }
      setAvatarFile(null);
      setMessage({ type: 'success', text: 'Profile information updated successfully!' });
      addToast('Profile information updated successfully!', 'success');
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      console.error("Profile update error:", err.response?.data);
      const data = err.response?.data;
      let errMsg = 'Failed to update profile';
      if (data) {
        if (typeof data === 'string') {
          errMsg = data;
        } else if (data.detail) {
          errMsg = data.detail;
        } else if (data.message) {
          errMsg = data.message;
        } else if (data.error) {
          errMsg = data.error;
        } else if (typeof data === 'object') {
          const errList = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
          if (errList.length > 0) errMsg = errList.join(' | ');
        }
      }
      setMessage({ type: 'error', text: errMsg });
      addToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      setPwdMessage({ type: 'error', text: 'New passwords do not match' });
      addToast('New passwords do not match', 'error');
      return;
    }
    setPwdLoading(true);
    setPwdMessage({ type: '', text: '' });

    try {
      await api.post('/auth/change-password/', {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password
      });
      setPwdMessage({ type: 'success', text: 'Password changed successfully.' });
      addToast('Password changed successfully.', 'success');
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
      setTimeout(() => setPwdMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      const data = err.response?.data;
      let errMsg = 'Failed to change password';
      if (data?.error) errMsg = data.error;
      else if (data?.old_password) errMsg = data.old_password[0];
      else if (data?.new_password) errMsg = data.new_password[0];
      setPwdMessage({ type: 'error', text: errMsg });
      addToast(errMsg, 'error');
    } finally {
      setPwdLoading(false);
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
        <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2.5 ${
          message.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Avatar & Quick Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 text-center">
            <div className="relative inline-block mb-4 group">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-slate-800 bg-slate-900 mx-auto flex items-center justify-center relative shadow-xl">
                {avatarPreview ? (
                  <img 
                    src={avatarPreview} 
                    alt={user?.first_name || 'Profile Avatar'} 
                    onError={() => setAvatarPreview(null)} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-brand-600 to-indigo-600 flex items-center justify-center text-3xl font-extrabold text-white">
                    {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
                  </div>
                )}
                {/* Hover overlay for changing avatar */}
                <div 
                  className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-full"
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
                <p className="text-sm font-medium text-slate-200">{user?.department || 'Executive Management'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserIcon className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Designation</p>
                <p className="text-sm font-medium text-slate-200">{user?.designation || (user?.role === 'CEO' ? 'Chief Executive Officer (CEO)' : user?.role || 'Staff')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-slate-500 mt-0.5" />
              <div>
                <p className="text-xs text-slate-400">Employee ID</p>
                <p className="text-sm font-medium text-slate-200">{user?.employee_id || 'EXEC-001'}</p>
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
                    required
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
                    placeholder="+91 9876543210"
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
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

          {/* Change Password Section */}
          <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 mt-6">
            <h3 className="text-lg font-bold text-white mb-6">Change Password</h3>
            
            {pwdMessage.text && (
              <div className={`p-4 rounded-xl text-sm font-medium border flex items-center gap-2.5 mb-6 ${
                pwdMessage.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {pwdMessage.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                <span>{pwdMessage.text}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">Current Password</label>
                <input
                  type="password"
                  name="old_password"
                  value={passwordData.old_password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">New Password</label>
                  <input
                    type="password"
                    name="new_password"
                    value={passwordData.new_password}
                    onChange={handlePasswordChange}
                    required
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    name="confirm_password"
                    value={passwordData.confirm_password}
                    onChange={handlePasswordChange}
                    required
                    className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {pwdLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  Update Password
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
