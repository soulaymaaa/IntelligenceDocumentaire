'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-xl bg-surface-100 border border-surface-200 animate-pulse" />
    );
  }

  const themes = [
    { id: 'light', icon: Sun, label: 'Light' },
    { id: 'dark', icon: Moon, label: 'Dark' },
  ];

  return (
    <div className="flex items-center gap-1 bg-surface-100 border border-surface-200 p-1 rounded-2xl shadow-sm">
      {themes.map((t) => {
        const Icon = t.icon;
        const isActive = theme === t.id;
        
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={cn(
              'relative p-2 rounded-xl transition-all duration-300 group',
              isActive 
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-md scale-100' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800 scale-95'
            )}
            title={t.label}
          >
            <Icon className={cn(
              "w-4 h-4 transition-transform duration-300",
              isActive ? "scale-110" : "scale-100 group-hover:scale-110"
            )} />
            {isActive && (
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-900 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {t.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
