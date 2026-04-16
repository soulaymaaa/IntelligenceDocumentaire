'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Search, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';

export const TopBar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { copy } = useLanguage();

  const pageTitles: Record<string, string> = {
    '/dashboard': copy.common.dashboard,
    '/documents': copy.common.documents,
    '/search': copy.common.semanticSearch,
    '/settings': copy.common.settings,
  };

  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] || copy.common.documents;

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 z-20 flex items-center justify-between px-8 shadow-sm shadow-slate-200/20 dark:shadow-none">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <LanguageToggle />
        <ThemeToggle />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/search')}
          className="hidden sm:flex bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
        >
          <Search className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          <span className="text-slate-700 dark:text-slate-300">{copy.common.search}</span>
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => router.push('/documents')}
          className="shadow-sm shadow-brand-500/10"
        >
          <Upload className="w-4 h-4" />
          {copy.common.upload}
        </Button>
      </div>
    </header>
  );
};
