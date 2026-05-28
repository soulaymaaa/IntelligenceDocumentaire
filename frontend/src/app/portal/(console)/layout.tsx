'use client';
import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, Users, ShieldCheck, Trash2, LayoutDashboard, UserCheck } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { cn } from '@/lib/utils';
import { adminPortalApi } from '@/lib/api';

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [metrics, setMetrics] = useState<{ totalUsers: number; activeUsers: number; deletedAccounts: number } | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Fetch admin metrics
  useEffect(() => {
    if (user?.role === 'admin') {
      adminPortalApi.getMetrics()
        .then((data) => {
          setMetrics(data);
          setLoadingMetrics(false);
        })
        .catch(() => {
          setLoadingMetrics(false);
        });
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/portal/login');
      } else if (user.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Chargement du portail admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className={cn('flex items-center justify-between px-6 py-4 border-b border-surface-200 bg-card/85 backdrop-blur-md sticky top-0 z-30') }>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Console d'administration</h1>
          </div>
          <nav className="flex items-center gap-1.5 bg-surface-150 dark:bg-slate-900/60 p-1 rounded-xl border border-surface-200">
            <Link 
              href="/portal" 
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                pathname === "/portal" 
                  ? "bg-white dark:bg-slate-800 text-brand-650 dark:text-brand-400 shadow-sm border border-surface-200/50" 
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Tableau de bord
            </Link>
            <Link 
              href="/portal/users" 
              className={cn(
                "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                pathname === "/portal/users" 
                  ? "bg-white dark:bg-slate-800 text-brand-650 dark:text-brand-400 shadow-sm border border-surface-200/50" 
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              )}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Utilisateurs
            </Link>
          </nav>
        </div>
        <button onClick={logout} className={cn('flex items-center text-slate-650 hover:text-red-650 transition-colors font-bold text-sm')} title="Déconnexion">
          <LogOut className="w-4 h-4 mr-1.5" />
          Déconnexion
        </button>
      </header>
      <TopBar minimal={false} />
      <main className="min-h-screen transition-[margin,padding] duration-150 pt-[108px]">
        {/* Stats Bar */}
        <section className="grid grid-cols-3 gap-4 p-4 bg-surface-100 border-b border-surface-200">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-600" />
            <span className="font-medium">Utilisateurs actifs : {loadingMetrics ? '...' : metrics?.activeUsers ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand-600" />
            <span className="font-medium">Total utilisateurs : {loadingMetrics ? '...' : metrics?.totalUsers ?? 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            <span className="font-medium">Comptes supprimés : {loadingMetrics ? '...' : metrics?.deletedAccounts ?? 0}</span>
          </div>
        </section>
        <div className="animate-fade-in p-5 space-y-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 text-xs font-semibold uppercase tracking-wider w-fit">
            <ShieldAlert className="w-3.5 h-3.5" /> Console d'Administration
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
