import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck, Lock, Mail, ArrowRight, Eye, EyeOff,
  Clock, Fingerprint
} from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Adding a mounted state for initial enter animations
  const [mounted, setMounted] = useState(false);

  const { login, companyName } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(email.trim(), password);
      switch (userData.role) {
        case 'CEO':
          navigate('/ceo/dashboard');
          break;
        case 'HR':
          navigate('/hr/dashboard');
          break;
        case 'EMPLOYEE':
        default:
          navigate('/employee/dashboard');
          break;
      }
    } catch (err) {
      const data = err.response?.data;
      let msg = 'Invalid email or password.';
      if (typeof data === 'string') {
        msg = data;
      } else if (data?.error) {
        msg = data.error;
      } else if (data?.message) {
        msg = data.message;
      } else if (data?.detail) {
        if (typeof data.detail === 'string' && data.detail.toLowerCase().includes('no active account')) {
          msg = 'Invalid email or password.';
        } else {
          msg = data.detail;
        }
      } else if (data?.errors?.detail) {
        msg = data.errors.detail;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden selection:bg-brand-500 selection:text-white">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none animate-float" style={{ animationDuration: '10s' }}></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[35vw] h-[35vw] bg-cyan-500/20 rounded-full blur-[90px] pointer-events-none animate-float" style={{ animationDuration: '8s', animationDelay: '2s' }}></div>
      <div className="absolute top-[40%] left-[60%] w-[25vw] h-[25vw] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none animate-float" style={{ animationDuration: '12s', animationDelay: '1s' }}></div>

      {/* Top Live Environment Header Bar */}
      <div className={`w-full max-w-[420px] flex items-center justify-between mb-8 px-2 transition-all duration-1000 transform ${mounted ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-white/5 backdrop-blur-md">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-semibold text-emerald-400 tracking-wider uppercase text-[10px]">System Active</span>
        </div>

        <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-300 bg-slate-900/50 px-3 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span className="tracking-widest">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</span>
        </div>
      </div>

      <div className={`w-full max-w-[420px] relative z-10 transition-all duration-700 delay-100 transform ${mounted ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}`}>
        {/* Main Card */}
        <div className="glass-panel-elevated rounded-3xl p-8 sm:p-10 text-center">
          
          {/* Logo Section */}
          <div className="flex flex-col items-center mb-8 relative">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-brand-600 via-cyan-500 to-indigo-600 rounded-3xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200 animate-tilt"></div>
              <div className="relative flex w-20 h-20 rounded-2xl bg-slate-900 items-center justify-center border border-white/10 shadow-2xl">
                <Fingerprint className="w-10 h-10 text-brand-400" />
              </div>
            </div>
            
            <div className="mt-5 space-y-1">
              <h1 className="text-3xl font-extrabold text-white tracking-tight uppercase flex items-center justify-center gap-2">
                {companyName || 'FRG Enterprise'}
              </h1>
              <div className="flex items-center justify-center gap-1.5 text-xs text-brand-300/80 font-medium tracking-widest uppercase">
                <span>Secure Portal</span>
                <span className="w-1 h-1 rounded-full bg-brand-400/50"></span>
                <span>v2.0</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-start gap-3 animate-shake shadow-inner">
              <ShieldCheck className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="text-left leading-tight">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-slate-400 pl-1">Corporate Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Mail className="w-[18px] h-[18px]" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="w-full pl-11 pr-4 py-3.5 glass-input rounded-2xl text-sm text-white placeholder:text-slate-600 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between pl-1">
                <label className="block text-[13px] font-medium text-slate-400">Password</label>
                <Link to="/forgot-password" className="text-[12px] font-medium text-brand-400 hover:text-brand-300 transition-colors">
                  Recovery
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-brand-400 transition-colors">
                  <Lock className="w-[18px] h-[18px]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-11 pr-12 py-3.5 glass-input rounded-2xl text-sm text-white placeholder:text-slate-600 transition-all tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 px-4 btn-primary rounded-2xl text-white font-bold text-[15px] shadow-lg shadow-brand-600/25 flex items-center justify-center gap-2 transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-[2.5px] border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span className="tracking-wide">Authenticating...</span>
                  </div>
                ) : (
                  <>
                    <span className="tracking-wide">Sign In to Workspace</span>
                    <ArrowRight className="w-[18px] h-[18px] opacity-80" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer Security Badge */}
        <div className={`mt-8 text-center transition-all duration-1000 delay-300 transform ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/40 border border-white/5 text-[11px] text-slate-400 backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tracking-wide">Encrypted by Advanced Compliance Engine</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
