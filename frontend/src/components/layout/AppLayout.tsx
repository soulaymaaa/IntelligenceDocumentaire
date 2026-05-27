'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Sidebar } from './Sidebar';

import { TopBar } from './TopBar';
import { Breadcrumbs } from './Breadcrumbs';
import { useAuth } from '@/lib/auth-context';
import { PageLoader } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';

export const AppLayout = ({
  children,
  minimalTopBar = false,
  breadcrumbLabel,
}: {
  children: React.ReactNode;
  minimalTopBar?: boolean;
  breadcrumbLabel?: string;
}) => {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarWidth, setSidebarWidth] = useState(256);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar width={sidebarWidth} onResize={setSidebarWidth} />
      <div className="flex flex-col flex-1 overflow-y-auto h-screen" style={{ marginLeft: `${sidebarWidth}px` }}>
        <TopBar minimal={minimalTopBar} />
        <main
          className={cn(
            "min-h-screen transition-[margin,padding] duration-150",
            minimalTopBar ? "pt-12" : "pt-[108px]"
          )}
        >
          <div className="animate-fade-in p-5">
            <Breadcrumbs extraLabel={breadcrumbLabel} />
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
