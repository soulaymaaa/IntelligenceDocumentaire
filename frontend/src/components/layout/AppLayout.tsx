'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useAuth } from '@/lib/auth-context';
import { PageLoader } from '@/components/ui/Spinner';

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 80;
const MAX_SIDEBAR_WIDTH = 380;
const SIDEBAR_STORAGE_KEY = 'docintel_sidebar_width';

const clampSidebarWidth = (width: number) => Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [hasLoadedSidebarWidth, setHasLoadedSidebarWidth] = useState(false);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY));
    if (storedWidth) setSidebarWidth(clampSidebarWidth(storedWidth));
    setHasLoadedSidebarWidth(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSidebarWidth) return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarWidth));
  }, [hasLoadedSidebarWidth, sidebarWidth]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar width={sidebarWidth} onResize={setSidebarWidth} />
      <TopBar sidebarWidth={sidebarWidth} />
      <main className="pt-[108px] min-h-screen transition-[margin] duration-150" style={{ marginLeft: sidebarWidth }}>
        <div className="p-5 animate-fade-in">{children}</div>
      </main>
    </div>
  );
};
