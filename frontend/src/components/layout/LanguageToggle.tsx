'use client';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="flex items-center gap-1 bg-surface-100 border border-surface-200 p-1 rounded-2xl shadow-sm">
      {(['fr', 'en'] as const).map((option) => {
        const active = locale === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => setLocale(option)}
            className={cn(
              'rounded-xl px-3 py-2 text-xs font-extrabold uppercase tracking-[0.2em] transition-all duration-300',
              active
                ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-brand-400 shadow-md'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800'
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
