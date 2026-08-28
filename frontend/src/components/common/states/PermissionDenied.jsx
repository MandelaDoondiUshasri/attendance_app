import React from 'react';
import { ShieldAlert, LayoutDashboard, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const PermissionDenied = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDashboardRedirect = () => {
    switch (user?.role) {
      case 'CEO':
      case 'SYSTEM_ADMIN':
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
  };

  return (
    <div 
      role="alert"
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[50vh] animate-fade-in"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400 shadow-inner">
        <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10" aria-hidden="true" />
      </div>
      <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Access Restricted</h2>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md mb-2 leading-relaxed">
        You don't have permission to view this page.
      </p>
      <p className="text-xs text-slate-500 max-w-sm mb-8">
        Contact your administrator if you believe you should have access to this resource.
      </p>
      
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button 
          onClick={() => navigate(-1)}
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-700 hover:border-slate-600 transition-all flex items-center gap-2 text-xs active:scale-95"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Go Back</span>
        </button>
        <button 
          onClick={handleDashboardRedirect}
          className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2 text-xs active:scale-95"
        >
          <LayoutDashboard className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Go to Dashboard</span>
        </button>
      </div>
    </div>
  );
};

export default PermissionDenied;
