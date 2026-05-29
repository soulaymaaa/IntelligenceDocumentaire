'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsersRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/portal');
  }, [router]);

  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mr-3" />
      <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
        Redirection vers le tableau de bord d'administration...
      </span>
    </div>
  );
}
