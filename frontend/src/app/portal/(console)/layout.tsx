'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { AdminSidebar } from '@/components/admin-portal/AdminSidebar';
import { PageLoader } from '@/components/ui/Spinner';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const MIN_WIDTH = 72;
const FULL_WIDTH = 256;

export default function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const [sidebarWidth, setSidebarWidth] = useState(FULL_WIDTH);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/portal/login');
      } else if (user.role !== 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) return <PageLoader />;
  if (!user || user.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen bg-surface">
      <AdminSidebar onWidthChange={setSidebarWidth} />

      <div
        className="flex flex-col flex-1 overflow-y-auto h-screen transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        {/* Minimal topbar for admin */}
        <div className="fixed top-0 right-0 z-20 flex items-center gap-2 px-5 py-3 transition-all duration-300"
          style={{ left: sidebarWidth }}
        >
          <div className="flex-1" />
          <ThemeToggle />
        </div>

        <main className="flex-1 pt-14 transition-[margin] duration-300">
          <div className="animate-fade-in p-6 space-y-6 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
