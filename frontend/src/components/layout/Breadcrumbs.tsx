'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { cn } from '@/lib/utils';

type Crumb = { label: string; href?: string };

export function Breadcrumbs({ extraLabel }: { extraLabel?: string }) {
  const pathname = usePathname();
  const { copy } = useLanguage();

  if (!pathname || pathname === '/') return null;

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: copy.breadcrumbs.home, href: '/dashboard' }];

  let path = '';
  segments.forEach((segment, index) => {
    path += `/${segment}`;
    const isLast = index === segments.length - 1;
    const prev = segments[index - 1];

    if (segment === 'dashboard') {
      if (!isLast) crumbs.push({ label: copy.common.dashboard, href: '/dashboard' });
      return;
    }

    const staticLabels: Record<string, string> = {
      documents: copy.common.documents,
      search: copy.common.semanticSearch,
      planner: copy.common.calendar,
      folders: copy.common.foldersNav,
      settings: copy.common.settings,
      dossiers: copy.common.projectDossiers,
    };

    if (prev === 'dossiers') {
      crumbs.push({ label: extraLabel || copy.breadcrumbs.dossier, href: isLast ? undefined : path });
      return;
    }

    if (prev === 'documents' && segment.length > 12) {
      crumbs.push({ label: extraLabel || copy.breadcrumbs.document, href: isLast ? undefined : path });
      return;
    }

    if (staticLabels[segment] && !isLast) {
      crumbs.push({ label: staticLabels[segment], href: path });
    } else if (isLast && staticLabels[segment]) {
      crumbs.push({ label: staticLabels[segment] });
    }
  });

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={`${crumb.label}-${i}`} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />}
          {crumb.href ? (
            <Link
              href={crumb.href}
              className={cn(
                'inline-flex items-center gap-1 font-semibold text-slate-500 transition-colors hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400',
                i === 0 && 'gap-1.5'
              )}
            >
              {i === 0 && <Home className="h-3.5 w-3.5" />}
              {crumb.label}
            </Link>
          ) : (
            <span className="max-w-[240px] truncate font-bold text-slate-900 dark:text-slate-100">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
