import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  allowPasswordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, allowPasswordToggle = false, type, ...props }, ref) => {
    const isPasswordField = type === 'password';
    const [showPassword, setShowPassword] = useState(false);
    const effectiveType = isPasswordField && allowPasswordToggle
      ? (showPassword ? 'text' : 'password')
      : type;

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">{label}</label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 transition-colors">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={effectiveType}
            className={cn(
              'input-base',
              icon && 'pl-10',
              isPasswordField && allowPasswordToggle && 'pr-12',
              error && 'border-red-500 focus:border-red-600 focus:ring-red-100 dark:focus:ring-red-900/20',
              className
            )}
            {...props}
          />
          {isPasswordField && allowPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-surface-100 hover:text-slate-700 dark:hover:text-slate-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-tight">{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 tracking-tight">{label}</label>
      )}
      <textarea
        ref={ref}
        className={cn(
          'input-base resize-none',
          error && 'border-red-500 focus:border-red-600 focus:ring-red-100 dark:focus:ring-red-900/20',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-tight">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';
