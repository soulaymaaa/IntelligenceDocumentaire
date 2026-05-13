'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, FileText, Search, LogOut, Settings, FolderOpen, Plus, X, Trash2, Calendar, FolderClosed,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/providers/LanguageProvider';
import { LogoMark } from '@/components/branding/LogoMark';
import { useEffect, useRef, useState } from 'react';
import { dossiersApi } from '@/lib/api';
import type { Dossier } from '@/types';

const PRESET_COLORS = [
  '#6366F1', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899',
];

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
  const router = useRouter();
  const { logout, user } = useAuth();
  const { copy } = useLanguage();
  const isCompact = width < COMPACT_SIDEBAR_WIDTH;

  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    dossiersApi.list().then(setDossiers).catch(() => {});
  }, []);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: copy.common.dashboard },
    { href: '/planner', icon: Calendar, label: copy.common.calendar },
    { href: '/folders', icon: FolderClosed, label: copy.documents.folders.title },
    { href: '/documents', icon: FileText, label: copy.common.documents },
    { href: '/search', icon: Search, label: copy.common.semanticSearch },
    { href: '/settings', icon: Settings, label: copy.common.settings },
  ];

  const handleCreateDossier = async () => {
    const name = newName.trim();
    if (!name) { setCreating(false); return; }
    try {
      const color = PRESET_COLORS[dossiers.length % PRESET_COLORS.length];
      const created = await dossiersApi.create(name, color);
      setDossiers((prev) => [...prev, created]);
      setNewName('');
      setCreating(false);
      router.push(`/dossiers/${created._id}`);
    } catch {
      setCreating(false);
    }
  };

  const handleDeleteDossier = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await dossiersApi.delete(id);
    setDossiers((prev) => prev.filter((d) => d._id !== id));
    if (pathname.startsWith(`/dossiers/${id}`)) router.push('/documents');
  };

  const startResizing = (event: React.PointerEvent<HTMLButtonElement>) => {
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
    <aside
      className="fixed left-0 top-0 z-30 flex h-full flex-col border-r border-surface-200 bg-card transition-colors"
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

        {/* Dossiers section */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 opacity-70 flex items-center gap-1.5">
              <FolderOpen className="w-3 h-3" />
              {copy.common.dossiers}
            </p>
            <button
              onClick={() => setCreating(true)}
              className="p-0.5 rounded text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
              title={copy.common.newDossier}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {creating && (
            <div className="px-2 mb-1 flex items-center gap-1">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateDossier();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
                placeholder={copy.common.dossierNamePlaceholder}
                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400"
              />
              <button
                onClick={() => { setCreating(false); setNewName(''); }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="space-y-0.5">
            {dossiers.map((dossier) => {
              const active = pathname.startsWith(`/dossiers/${dossier._id}`);
              return (
                <Link
                  key={dossier._id}
                  href={`/dossiers/${dossier._id}`}
                  className={cn(
                    'group flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    active
                      ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/5'
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: dossier.color }}
                  />
                  <span className="flex-1 truncate">{dossier.name}</span>
                  <button
                    onClick={(e) => handleDeleteDossier(e, dossier._id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-300 hover:text-red-500 transition-all"
                    title="Delete dossier"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </Link>
              );
            })}

            {dossiers.length === 0 && !creating && (
              <p className="px-3.5 py-2 text-[11px] text-slate-400 dark:text-slate-600 italic">
                {copy.common.newDossier}…
              </p>
            )}
          </div>
        </div>
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
        aria-label="Redimensionner la barre latérale"
        title="Glisser le bord pour ajuster la largeur. Double-cliquer pour réinitialiser."
        onPointerDown={startResizing}
        onDoubleClick={resetWidth}
        className="absolute right-[-3px] top-0 h-full w-1.5 cursor-col-resize outline-none transition-colors hover:bg-brand-500/40 focus-visible:bg-brand-500/50"
      />

    </aside>
  );
};
