'use client';

import { useLanguage } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Globe } from 'lucide-react';

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="flex items-center gap-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 font-bold transition-all"
      onClick={() => setLanguage(language === 'fr' ? 'en' : 'fr')}
    >
      <Globe className="w-4 h-4 text-brand-500 dark:text-cyan-400" />
      <span className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300">
        {language === 'fr' ? 'EN' : 'FR'}
      </span>
    </Button>
  );
}
