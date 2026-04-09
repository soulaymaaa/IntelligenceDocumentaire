import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glow?: boolean;
}

export const Card = ({ children, className, hover = false, glow = false, ...props }: CardProps) => (
  <div
    className={cn(
      'bg-card rounded-2xl p-6 shadow-card border border-surface-200 transition-all duration-300',
      hover && 'sm:hover:bg-card-hover sm:hover:shadow-card-hover cursor-pointer',
      glow && 'sm:hover:shadow-brand-500/10',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight', className)} {...props}>
    {children}
  </h3>
);
