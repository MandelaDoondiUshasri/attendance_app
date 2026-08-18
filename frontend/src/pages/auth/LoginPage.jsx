import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('ceo@company.com');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(email, password);
      switch (userData.role) {
        case 'CEO':
          navigate('/ceo/dashboard');
          break;
        case 'HR':
          navigate('/hr/dashboard');
          break;
        case 'ATTENDANCE_OPERATOR':
          navigate('/operator/dashboard');
          break;
        case 'EMPLOYEE':
        default:
          navigate('/employee/dashboard');
          break;
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.detail || 'Invalid email or password credentials');
    } finally {
      setLoading(false);
    }
  };

  const setDemoAccount = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('Password123!');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Banner */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-400 items-center justify-center shadow-xl shadow-brand-500/25 mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">APEX ENTERPRISE</h1>
          <p className="text-sm text-slate-400 mt-1">Attendance, Leave, WFH & HR Portal</p>
        </div>

        {/* Card Form */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-slate-800">
          <h2 className="text-xl font-bold text-white mb-6">Sign In to Platform</h2>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Work Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@company.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 transition-all duration-200"
            >
              {loading ? 'Authenticating...' : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Role Fillers */}
          <div className="mt-8 pt-6 border-t border-slate-800/80">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">Quick Role Switcher</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDemoAccount('ceo@company.com')}
                className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 text-slate-300 text-left transition-colors"
              >
                <div className="font-bold text-white">CEO</div>
                <div className="text-[10px] text-slate-500">ceo@company.com</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('hr@company.com')}
                className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 text-slate-300 text-left transition-colors"
              >
                <div className="font-bold text-white">HR / Admin</div>
                <div className="text-[10px] text-slate-500">hr@company.com</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('operator@company.com')}
                className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 text-slate-300 text-left transition-colors"
              >
                <div className="font-bold text-white">Operator</div>
                <div className="text-[10px] text-slate-500">operator@company.com</div>
              </button>
              <button
                type="button"
                onClick={() => setDemoAccount('emp1@company.com')}
                className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500 text-slate-300 text-left transition-colors"
              >
                <div className="font-bold text-white">Employee</div>
                <div className="text-[10px] text-slate-500">emp1@company.com</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
