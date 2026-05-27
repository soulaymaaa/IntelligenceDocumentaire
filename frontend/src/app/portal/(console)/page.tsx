'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, Users, ShieldCheck, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Metrics {
  totalUsers: number;
  activeUsers: number;
  deletedAccounts: number;
}

export default function AdminConsolePage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin-portal/metrics', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch metrics');
        return res.json();
      })
      .then((data) => {
        setMetrics(data?.data ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <section className={cn('grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-surface-100 border-b border-surface-200') }>
      <div className="flex items-center gap-2 p-4 bg-white rounded-lg shadow">
        <Users className="w-5 h-5 text-brand-600" />
        <span className="font-medium">
          Utilisateurs actifs : {loading ? '...' : metrics?.activeUsers ?? 0}
        </span>
      </div>
      <div className="flex items-center gap-2 p-4 bg-white rounded-lg shadow">
        <ShieldCheck className="w-5 h-5 text-brand-600" />
        <span className="font-medium">
          Total utilisateurs : {loading ? '...' : metrics?.totalUsers ?? 0}
        </span>
      </div>
      <div className="flex items-center gap-2 p-4 bg-white rounded-lg shadow">
        <Trash2 className="w-5 h-5 text-red-600" />
        <span className="font-medium">
          Comptes supprimés : {loading ? '...' : metrics?.deletedAccounts ?? 0}
        </span>
      </div>
    </section>
  );
}
