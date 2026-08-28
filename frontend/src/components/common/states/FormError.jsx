import React from 'react';
import { AlertCircle } from 'lucide-react';

const FormError = ({ message, id }) => {
  if (!message) return null;

  return (
    <div 
      id={id}
      role="alert"
      className="flex items-center gap-1.5 mt-1.5 text-rose-400 animate-fade-in"
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="text-[11px] font-medium leading-tight">{message}</span>
    </div>
  );
};

export default FormError;
