import React from 'react';
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
