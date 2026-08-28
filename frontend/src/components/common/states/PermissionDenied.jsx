import React from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PermissionDenied = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[50vh]">
      <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-5 text-amber-500 shadow-inner">
        <ShieldAlert className="w-10 h-10" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Access Restricted</h3>
      <p className="text-sm text-slate-400 max-w-md mb-8">
        You don't have permission to view this page. Contact your administrator if you believe you should have access.
      </p>
      <button 
        onClick={() => navigate(-1)}
        className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2 text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Go Back
      </button>
    </div>
  );
};

export default PermissionDenied;
