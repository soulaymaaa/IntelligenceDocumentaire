'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle,
  Clock,
  FileText,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { SkeletonCard } from '@/components/ui/Spinner';
import { StatusBadge } from '@/components/ui/Badge';
import { documentsApi } from '@/lib/api';
import { formatBytes, formatDateShort } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';

const StatCard = ({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: any;
  label: string;
  value: string | number;
  helper: string;
}) => (
  <Card className="border-surface-200">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <p className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
        <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">{helper}</p>
      </div>
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-600">
        <Icon className="w-6 h-6" />
      </div>
    </div>
  </Card>
);

export default function DashboardPage() {
  const { copy } = useLanguage();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: documentsApi.getDashboard,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <Card className="border-surface-200 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-200/70">{copy.dashboard.controlTower}</p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{copy.dashboard.aiDashboard}</h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
                {copy.dashboard.description}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/55">{copy.dashboard.queries}</p>
                <p className="mt-2 text-2xl font-extrabold">{stats?.totalQueries || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/55">{copy.dashboard.summaries}</p>
                <p className="mt-2 text-2xl font-extrabold">{stats?.summariesGenerated || 0}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/55">{copy.dashboard.avgRelevance}</p>
                <p className="mt-2 text-2xl font-extrabold">{stats?.averageRelevanceScore || 0}%</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={FileText} label={copy.dashboard.stats.documents} value={stats?.total || 0} helper={copy.dashboard.stats.documentsHelper} />
          <StatCard icon={CheckCircle} label={copy.dashboard.stats.indexed} value={stats?.indexed || 0} helper={copy.dashboard.stats.indexedHelper} />
          <StatCard icon={Clock} label={copy.dashboard.stats.processing} value={stats?.pending || 0} helper={copy.dashboard.stats.processingHelper} />
          <StatCard icon={Brain} label={copy.dashboard.stats.aiQueries} value={stats?.totalQueries || 0} helper={copy.dashboard.stats.aiQueriesHelper} />
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.1fr,0.9fr]">
          <Card className="border-surface-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{copy.dashboard.recentLibrary}</p>
                <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.dashboard.latestDocs}</h2>
              </div>
              <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600">
                {copy.dashboard.seeAll}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="mt-5 space-y-4">
              {stats?.recent?.length ? (
                stats.recent.map((doc) => (
                  <Link
                    key={doc._id}
                    href={`/documents/${doc._id}`}
                    className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-white px-4 py-4 transition-all hover:border-brand-500/20 hover:bg-surface-50"
                  >
                    <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-extrabold text-slate-900">{doc.originalName}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {formatBytes(doc.size)} • {formatDateShort(doc.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm font-medium text-slate-500">
                  {copy.dashboard.noDocs}
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="border-surface-200">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-brand-600" />
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.dashboard.activitySnapshot}</h2>
              </div>
              <div className="mt-5 grid gap-3">
                {(stats?.dailyActivity || []).slice(-7).map((entry) => (
                  <div key={entry.date} className="flex items-center gap-3">
                    <div className="w-24 text-xs font-bold uppercase tracking-widest text-slate-400">{entry.date.slice(5)}</div>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-surface-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-600 to-cyan-500"
                        style={{ width: `${Math.max(8, entry.count * 12)}px` }}
                      />
                    </div>
                    <div className="w-10 text-right text-sm font-bold text-slate-700 dark:text-slate-200">{entry.count}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-surface-200">
              <div className="flex items-center gap-3">
                <MessageSquareText className="w-5 h-5 text-brand-600" />
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.dashboard.aiPerformance}</h2>
              </div>
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{copy.dashboard.avgRelevance}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats?.averageRelevanceScore || 0}%</p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{copy.dashboard.summaries}</p>
                  <p className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">{stats?.summariesGenerated || 0}</p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-gradient-to-r from-brand-50 to-cyan-50 px-4 py-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-brand-600" />
                    <p className="text-sm font-bold text-slate-800">{copy.dashboard.aiNotice}</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
