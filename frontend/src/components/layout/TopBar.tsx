'use client';

import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';

export const TopBar = () => {
  return (
    <header className="fixed top-0 left-60 right-0 z-20 px-6 py-4">
      <div className="flex items-center justify-end gap-4 rounded-[34px] border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(9,20,31,0.96),rgba(6,13,22,0.92))] px-6 py-4 shadow-[0_20px_48px_-34px_rgba(0,0,0,0.6)] backdrop-blur">
        <div className="flex items-center gap-2 rounded-[22px] border border-cyan-400/14 bg-slate-950/55 p-1.5 shadow-[0_16px_34px_-28px_rgba(0,0,0,0.5)] backdrop-blur">
          <LanguageToggle />
          <div className="h-7 w-px bg-white/10" />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};
