import { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Input({ label, error, required, className = '', ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="sp-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input className={`sp-input ${error ? 'border-red-400 ring-red-100' : ''} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}

export function Select({ label, error, required, children, className = '', ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label className="sp-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select className={`sp-input ${error ? 'border-red-400' : ''} ${className}`} {...props}>
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

export function Textarea({ label, error, required, className = '', ...props }: TextareaProps) {
  return (
    <div>
      {label && (
        <label className="sp-label">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea className={`sp-input min-h-[80px] resize-y ${error ? 'border-red-400' : ''} ${className}`} {...props} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
