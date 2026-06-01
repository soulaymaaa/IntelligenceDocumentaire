'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { LogoMark } from '@/components/branding/LogoMark';
import { useEffect, useState } from 'react';

const MIN_WIDTH = 72;
const FULL_WIDTH = 256;

export function AdminSidebar({ onWidthChange }: { onWidthChange?: (width: number) => void }) {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const isCompact = collapsed;
  const width = isCompact ? MIN_WIDTH : FULL_WIDTH;

  useEffect(() => {
    onWidthChange?.(width);
  }, [onWidthChange, width]);

  const navItems = [
    {
      href: '/portal',
      icon: LayoutDashboard,
      label: 'Tableau de Bord',
      exact: true,
    },
    {
      href: '/portal/users',
      icon: Users,
      label: 'Utilisateurs',
    },
    {
      href: '/portal/admins',
      icon: Shield,
      label: 'Administrateurs',
    },
  ];

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <aside
      className="fixed left-0 top-0 z-30 h-screen flex flex-col border-r border-surface-200 bg-card transition-all duration-300"
      style={{ width }}
    >
      {/* Logo Header */}
      <div className={cn('border-b border-surface-200 relative', isCompact ? 'px-2 py-4' : 'px-4 py-4')}>
        <Link href="/portal" className={cn('flex items-center group', isCompact ? 'justify-center' : 'gap-2.5')}>
          <LogoMark className={cn('h-auto', isCompact ? 'w-10 max-w-10' : 'w-[88px] max-w-[88px]')} />
          {!isCompact && (
            <div className="min-w-0 leading-tight">
              <p className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                DocIntel
              </p>
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-violet-500 dark:text-violet-400">
                Admin Console
              </p>
            </div>
          )}
        </Link>

        {/* Admin badge */}
        {!isCompact && (
          <div className="mt-3 mx-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <ShieldCheck className="w-3 h-3 text-violet-500 shrink-0" />
            <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider truncate">
              Espace Sécurisé
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto py-5', isCompact ? 'px-2' : 'px-2.5')}>
        {!isCompact && (
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-3 opacity-70">
            Navigation
          </p>
        )}

        {navItems.map(({ href, icon: Icon, label, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                'flex items-center rounded-xl text-sm font-semibold transition-all duration-200 group',
                isCompact ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-2.5',
                active
                  ? 'bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-400 shadow-sm border border-violet-100 dark:border-violet-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-500/5'
              )}
            >
              <Icon
                className={cn(
                  'w-5 h-5 transition-colors shrink-0',
                  active
                    ? 'text-violet-600 dark:text-violet-400'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-violet-500'
                )}
              />
              {!isCompact && <span className="flex-1">{label}</span>}
              {active && !isCompact && (
                <div className="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — User info + Logout */}
      <div className={cn('border-t border-surface-200 space-y-2', isCompact ? 'px-2 py-4' : 'px-3 py-5')}>
        <div
          title={user?.email}
          className={cn(
            'flex items-center rounded-xl bg-surface-100 border border-surface-200',
            isCompact ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-3'
          )}
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-violet-500/20 shrink-0">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
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
          title="Déconnexion"
          className={cn(
            'flex items-center w-full rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200',
            isCompact ? 'justify-center px-0 py-3' : 'gap-3 px-3.5 py-2.5'
          )}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!isCompact && 'Déconnexion'}
        </button>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-card border border-surface-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-violet-600 hover:border-violet-300 transition-all z-10"
        title={isCompact ? 'Déplier' : 'Réduire'}
      >
        {isCompact ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>
    </aside>
  );
}
