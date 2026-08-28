import os

base_path = 'e:/projects/frgattendance/frontend/src/components/common/states/'

files = {
    'LoadingState.jsx': '''import React from 'react';

const LoadingState = ({ type = 'table', text = 'Loading...' }) => {
  if (type === 'button') {
    return (
      <span className="flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
        {text}
      </span>
    );
  }

  if (type === 'skeleton') {
    return (
      <div className="space-y-4 w-full">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-16 bg-slate-800/50 rounded-xl animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${type === 'full' ? 'min-h-[50vh]' : 'min-h-[200px]'}`}>
      <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(99,102,241,0.5)]"></div>
      <p className="text-sm font-semibold text-brand-300 animate-pulse">{text}</p>
    </div>
  );
};

export default LoadingState;
''',

    'ErrorState.jsx': '''import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const ErrorState = ({ title = 'Something went wrong', message, onRetry }) => {
  return (
    <div className="glass-card border-rose-500/20 bg-rose-500/5 p-6 sm:p-8 rounded-2xl flex flex-col items-center justify-center text-center w-full max-w-md mx-auto my-8">
      <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-4 border border-rose-500/20">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-300 mb-6">{message || 'We couldn\\'t load this information right now. Please try again.'}</p>
      
      {onRetry && (
        <button 
          onClick={onRetry}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition-all flex items-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" /> Try Again
        </button>
      )}
    </div>
  );
};

export default ErrorState;
''',

    'NoSearchResults.jsx': '''import React from 'react';
import { SearchX } from 'lucide-react';

const NoSearchResults = ({ searchTerm, onClear }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[300px]">
      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-brand-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
        <SearchX className="w-8 h-8 opacity-80" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No results found</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6">
        We couldn't find anything matching <span className="font-bold text-slate-300">"{searchTerm}"</span>.
      </p>
      
      <div className="text-xs text-slate-500 text-left bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6 w-full max-w-xs">
        <p className="font-semibold mb-2">Suggestions:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>Check the spelling</li>
          <li>Use broader search terms</li>
          <li>Clear any applied filters</li>
        </ul>
      </div>

      {onClear && (
        <button 
          onClick={onClear}
          className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all text-sm"
        >
          Clear Search
        </button>
      )}
    </div>
  );
};

export default NoSearchResults;
''',

    'PermissionDenied.jsx': '''import React from 'react';
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
''',

    'FormError.jsx': '''import React from 'react';
import { AlertCircle } from 'lucide-react';

const FormError = ({ message }) => {
  if (!message) return null;

  return (
    <div className="flex items-center gap-1.5 mt-1.5 text-rose-400 animate-fade-in">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span className="text-[11px] font-medium leading-tight">{message}</span>
    </div>
  );
};

export default FormError;
'''
}

for name, content in files.items():
    with open(os.path.join(base_path, name), 'w', encoding='utf-8') as f:
        f.write(content)

print('Done creating state files.')
