import { cn } from '@/lib/utils';
import type { DocumentStatus } from '@/types';

interface BadgeProps {
  status?: DocumentStatus;
  children?: React.ReactNode;
  className?: string;
}

const statusConfig: Record<DocumentStatus, { label: string; className: string }> = {
  pending:        { label: 'Pending',     className: 'badge-pending' },
  processing_ocr: { label: 'Processing',  className: 'badge-processing' },
  indexed:        { label: 'Indexed',     className: 'badge-indexed' },
  error:          { label: 'Error',       className: 'badge-error' },
  archived:       { label: 'Archived',    className: 'badge-archived' },
};

export const StatusBadge = ({ status, className }: BadgeProps) => {
  if (!status) return null;
  const config = statusConfig[status];
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold',
      config.className, className
    )}>
      <span className={cn(
        'w-1.5 h-1.5 rounded-full',
        status === 'processing_ocr' ? 'animate-pulse bg-blue-400' :
        status === 'indexed'        ? 'bg-emerald-400' :
        status === 'error'          ? 'bg-red-400' :
        status === 'archived'       ? 'bg-slate-400' : 'bg-amber-400'
      )} />
      {config.label}
    </span>
  );
};

export const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn(
    'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
    'bg-brand-50 text-brand-700 border border-brand-100',
    className
  )}>
    {children}
  </span>
);
