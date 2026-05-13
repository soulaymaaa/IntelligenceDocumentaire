'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  LayoutDashboard,
  FileText,
  Search,
  LogOut,
  Settings,
  Calendar,
  FolderClosed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/providers/LanguageProvider';
import { LogoMark } from '@/components/branding/LogoMark';

const MIN_SIDEBAR_WIDTH = 80;
const MAX_SIDEBAR_WIDTH = 380;
const COMPACT_SIDEBAR_WIDTH = 160;

const clampSidebarWidth = (width: number) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

export const Sidebar = ({
  width,
  onResize,
}: {
  width: number;
  onResize: (width: number) => void;
}) => {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { copy } = useLanguage();
  const isCompact = width < COMPACT_SIDEBAR_WIDTH;

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: copy.common.dashboard },
    { href: '/planner', icon: Calendar, label: copy.common.calendar },
    { href: '/folders', icon: FolderClosed, label: copy.documents.folders.title },
    { href: '/documents', icon: FileText, label: copy.common.documents },
    { href: '/search', icon: Search, label: copy.common.semanticSearch },
    { href: '/settings', icon: Settings, label: copy.common.settings },
  ];

  const startResizing = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const initialX = event.clientX;
    const initialWidth = width;
    const originalUserSelect = document.body.style.userSelect;
    const originalCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    const handlePointerMove = (moveEvent: PointerEvent) => {
      onResize(clampSidebarWidth(initialWidth + moveEvent.clientX - initialX));
    };
    const stopResizing = () => {
      document.body.style.userSelect = originalUserSelect;
      document.body.style.cursor = originalCursor;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResizing);
      window.removeEventListener('pointercancel', stopResizing);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResizing);
    window.addEventListener('pointercancel', stopResizing);
  };

  const resetWidth = () => onResize(240);

  return (
    <aside className="fixed left-0 top-0 z-30 h-screen flex flex-col border-r border-surface-200 bg-card transition-colors"
      style={{ width }}
    >
      <div className={cn('border-b border-surface-200', isCompact ? 'px-2 py-4' : 'px-4 py-4')}>
        <Link href="/" className={cn('flex items-center group', isCompact ? 'justify-center' : 'gap-2.5')}>
          <LogoMark className={cn('h-auto', isCompact ? 'w-12 max-w-12' : 'w-[96px] max-w-[96px]')} />
          {!isCompact && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {copy.common.platformName}
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                {copy.common.platformSub}
              </p>
            </div>
          )}
        </Link>
      </div>

      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-5', isCompact ? 'px-2' : 'px-2.5')}>
        {!isCompact && (
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-3 opacity-70">
            {copy.common.navigation}
          </p>
        )}
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex items-center rounded-xl text-sm font-semibold transition-all duration-200 group',
                isCompact ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-2.5',
                active
                  ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/5'
              )}
            >
              <Icon className={cn('w-5 h-5 transition-colors', active ? 'text-brand-600' : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-500')} />
              {!isCompact && <span className="flex-1">{label}</span>}
              {active && !isCompact && <div className="w-1.5 h-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
            </Link>
          );
        })}
      </nav>

      <div className={cn('border-t border-surface-200 space-y-2', isCompact ? 'px-2 py-4' : 'px-3 py-5')}>
        <div
          title={user?.email}
          className={cn(
            'flex items-center rounded-xl bg-surface-100 border border-surface-200',
            isCompact ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-3'
          )}
        >
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-brand-500/20">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!isCompact && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email}</p>
            </div>
          )}
        </div>
        <button
          onClick={logout}
          title={copy.common.signOut}
          className={cn(
            'flex items-center w-full rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200',
            isCompact ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-2.5'
          )}
        >
          <LogOut className="w-4 h-4" />
          {!isCompact && copy.common.signOut}
        </button>
      </div>

      <button
        type="button"
        aria-label="Redimensionner la barre laterale"
        title="Glisser le bord pour ajuster la largeur. Double-cliquer pour reinitialiser."
        onPointerDown={startResizing}
        onDoubleClick={resetWidth}
        className="absolute right-[-3px] top-0 h-full w-1.5 cursor-col-resize outline-none transition-colors hover:bg-brand-500/40 focus-visible:bg-brand-500/50"
      />
    </aside>
  );
};
