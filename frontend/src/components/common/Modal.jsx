import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children, maxWidth = 'max-w-xl' }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className={`relative w-full ${maxWidth} max-h-[92vh] flex flex-col glass-panel rounded-2xl sm:rounded-3xl border border-slate-800 shadow-2xl p-4 sm:p-6 overflow-hidden my-auto`}>
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-800 shrink-0">
          <h3 className="text-sm sm:text-base font-bold text-white tracking-wide truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 sm:mt-4 flex-1 overflow-y-auto custom-scrollbar pr-1">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
