'use client';

import { useLanguage } from '@/providers/LanguageProvider';

export const Footer = () => {
  const { copy } = useLanguage();
  
  if (!copy || !copy.footer) return null;

  return (
    <footer className="mt-16 border-t border-surface-200 py-6">
      <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">
        {copy.footer.rights}
      </p>
    </footer>
  );
};
