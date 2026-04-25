'use client';

import { cn } from '@/lib/utils';

type LogoMarkProps = {
  className?: string;
};

export function LogoMark({ className }: LogoMarkProps) {
  return (
    <img
      src="/docintel_logo_only.svg"
      alt="DocIntel"
      className={cn('block select-none object-contain', className)}
      draggable={false}
    />
  );
}
