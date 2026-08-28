import React from 'react';
import { SearchX, RotateCcw } from 'lucide-react';

const NoSearchResults = ({ searchTerm, onClear }) => {
  return (
    <div 
      role="status"
      aria-label="No search results"
      className="flex flex-col items-center justify-center p-8 sm:p-12 text-center h-full min-h-[300px] animate-fade-in"
    >
      <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
        <SearchX className="w-8 h-8 opacity-80" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No results found</h3>
      <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
        We couldn't find anything matching <span className="font-semibold text-slate-200">"{searchTerm || 'your query'}"</span>.
      </p>
      
      <div className="text-xs text-slate-400 text-left bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mb-6 w-full max-w-xs space-y-1.5 shadow-inner">
        <p className="font-semibold text-slate-300">Try:</p>
        <ul className="list-disc pl-4 space-y-1 text-slate-400">
          <li>Checking the spelling</li>
          <li>Using fewer or different filters</li>
          <li>Using a broader search term</li>
        </ul>
      </div>

      {onClear && (
        <button 
          onClick={onClear}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 hover:border-slate-600 transition-all text-xs flex items-center gap-2 shadow-md active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Clear Search</span>
        </button>
      )}
    </div>
  );
};

export default NoSearchResults;
