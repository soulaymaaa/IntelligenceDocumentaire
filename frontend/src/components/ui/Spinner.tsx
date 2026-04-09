import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; className?: string; }

export const Spinner = ({ size = 'md', className }: SpinnerProps) => (
  <Loader2 className={cn(
    'animate-spin text-brand-400',
    size === 'sm' && 'w-4 h-4',
    size === 'md' && 'w-6 h-6',
    size === 'lg' && 'w-10 h-10',
    className
  )} />
);

export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="w-20 h-20 rounded-3xl border-4 border-brand-100 animate-pulse absolute inset-0" />
        <div className="w-20 h-20 rounded-3xl border-4 border-t-brand-600 border-brand-50 animate-spin" />
      </div>
      <div className="text-center">
        <p className="text-slate-900 font-extrabold text-lg tracking-tight">Initializing Intelligence Engine</p>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 opacity-60">Please wait while we prepare your space</p>
      </div>
    </div>
  </div>
);

export const InlineLoader = ({ text = 'Analyzing...' }: { text?: string }) => (
  <div className="flex items-center gap-3 text-slate-600 bg-slate-50 border border-slate-100 px-4 py-2 rounded-xl inline-flex shadow-sm">
    <Spinner size="sm" />
    <span className="text-sm font-bold tracking-tight">{text}</span>
  </div>
);

export const SkeletonCard = () => (
  <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm animate-pulse">
    <div className="bg-slate-100 h-5 w-3/4 rounded-lg mb-4" />
    <div className="bg-slate-50 h-3 w-1/2 rounded-lg mb-8" />
    <div className="space-y-3">
      <div className="bg-slate-50 h-3 w-full rounded-lg" />
      <div className="bg-slate-50 h-3 w-5/6 rounded-lg" />
    </div>
  </div>
);
