'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FileText, Search, LogOut, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/providers/LanguageProvider';
import { LogoMark } from '@/components/branding/LogoMark';

export const Sidebar = () => {
  const pathname = usePathname();
  const { logout, user } = useAuth();
  const { copy } = useLanguage();

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: copy.common.dashboard },
    { href: '/documents', icon: FileText, label: copy.common.documents },
    { href: '/search', icon: Search, label: copy.common.semanticSearch },
    { href: '/settings', icon: Settings, label: copy.common.settings },
  ];

  return (
    <aside className="fixed left-0 top-0 h-full w-60 bg-card border-r border-surface-200 flex flex-col z-30 transition-colors">
      <div className="px-4 py-4 border-b border-surface-200">
        <Link href="/" className="flex items-center gap-2.5 group">
          <LogoMark className="h-auto w-[96px] max-w-[96px]" />
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              DocIntel
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Plateforme documentaire
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-5 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 mb-3 opacity-70">
          {copy.common.navigation}
        </p>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 group',
                active
                  ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 shadow-sm border border-brand-100 dark:border-brand-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50/50 dark:hover:bg-brand-500/5'
              )}
            >
              <Icon className={cn('w-5 h-5 transition-colors', active ? 'text-brand-600' : 'text-slate-400 dark:text-slate-500 group-hover:text-brand-500')} />
              <span className="flex-1">{label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-brand-600 dark:bg-brand-400" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-5 border-t border-surface-200 space-y-2">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-surface-100 border border-surface-200">
          <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-md shadow-brand-500/20">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-medium">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          {copy.common.signOut}
        </button>
      </div>
    </aside>
  );
};
