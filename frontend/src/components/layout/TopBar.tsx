'use client';

import { useEffect, useRef, useState } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { QRTrigger } from './QRTrigger';
import { cn } from '@/lib/utils';

export const TopBar = ({ minimal = false }: { minimal?: boolean }) => {
  return (
    <header
       className={cn('fixed top-0 right-0 z-20 px-6', minimal ? 'py-2' : 'py-4')}
    >
      <div
        className={cn(
          'flex items-center justify-end gap-4 rounded-[34px] transition-all duration-300',
          !minimal && 'topbar-shell px-6 py-4'
        )}
      >
        <div className="topbar-tools flex items-center gap-2 rounded-[22px]">
          <QRTrigger />
          <div className="topbar-divider" />
          <LanguageToggle />
          <div className="topbar-divider" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
