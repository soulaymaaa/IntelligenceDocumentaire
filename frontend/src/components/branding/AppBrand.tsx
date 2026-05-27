'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { LogoMark } from './LogoMark';

type AppBrandProps = {
  name?: string;
  subtitle?: string;
  href?: string;
  compact?: boolean;
  className?: string;
  logoClassName?: string;
};

export function AppBrand({
  name = 'DocIntel',
  subtitle,
  href,
  compact = false,
  className,
  logoClassName,
}: AppBrandProps) {
  const content = (
    <div
      className={cn(
        'flex items-center min-w-0',
        compact ? 'justify-center gap-0' : 'gap-3',
        className
      )}
    >
      <LogoMark
        className={cn(
          'h-auto shrink-0 object-contain',
          compact ? 'w-11 max-w-11' : 'w-12 max-w-12',
          logoClassName
        )}
      />
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {name}
          </p>
          {subtitle && (
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group block min-w-0 transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
