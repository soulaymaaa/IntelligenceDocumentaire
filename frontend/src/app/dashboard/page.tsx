'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  FileText, CheckCircle, Clock, AlertCircle, Archive,
  Upload, ArrowRight, TrendingUp, Search, Shield,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Spinner';
import { documentsApi } from '@/lib/api';
import { formatBytes, formatDateShort } from '@/lib/utils';

const StatCard = ({
  icon: Icon, label, value, color, href,
}: {
  icon: any; label: string; value: number; color: string; href?: string;
}) => (
  <Card hover={!!href} className="relative overflow-hidden group border-surface-200" glow>
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 dark:opacity-20 ${color}`} />
    <div className="flex items-center justify-between">
      <div>
        <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
        <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 mt-2 tracking-tight">{value}</p>
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${color} bg-opacity-10 dark:bg-opacity-20 shadow-sm transition-transform group-hover:scale-110 duration-300`}>
        <Icon className={`w-7 h-7 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
    {href && (
      <Link href={href} className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 mt-4 transition-colors">
        View detailed stats <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    )}
  </Card>
);

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: documentsApi.getDashboard,
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard icon={FileText}    label="Total Documents" value={stats?.total || 0}   color="bg-brand-600"    href="/documents" />
        <StatCard icon={CheckCircle} label="Indexed"          value={stats?.indexed || 0} color="bg-emerald-600"  href="/documents?status=indexed" />
        <StatCard icon={Clock}       label="Processing"       value={stats?.pending || 0} color="bg-amber-600"    />
        <StatCard icon={AlertCircle} label="Errors"           value={stats?.errors || 0}  color="bg-red-600"      href="/documents?status=error" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent documents */}
        <div className="lg:col-span-2">
          <Card className="border-surface-200 shadow-sm">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-surface-100">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Recent Documents</h2>
              <Link href="/documents">
                <Button variant="ghost" size="sm" className="font-bold text-brand-600 dark:text-brand-400">
                  View all documents <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>

            {!stats?.recent?.length ? (
              <div className="text-center py-16 bg-surface-100/50 rounded-3xl border border-dashed border-surface-200">
                <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center shadow-sm mx-auto mb-4 border border-surface-200">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-slate-900 dark:text-slate-100 font-bold text-lg">No documents found</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 max-w-xs mx-auto">Upload your first document to see it appear here in your dashboard.</p>
                <Button variant="primary" size="sm" className="mt-6" onClick={() => window.location.href='/documents'}>
                  <Upload className="w-4 h-4 mr-1" /> Upload Now
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.recent.map((doc) => (
                  <Link
                    key={doc._id}
                    href={`/documents/${doc._id}`}
                    className="flex items-center gap-5 px-5 py-4 rounded-2xl hover:bg-surface-100 border border-transparent hover:border-surface-200 transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5 text-brand-600 dark:text-brand-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 dark:text-slate-100 font-bold truncate group-hover:text-brand-600 transition-colors">
                        {doc.originalName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {formatBytes(doc.size)} · Indexed {formatDateShort(doc.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={doc.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Quick actions */}
        <div className="space-y-6">
          <Card className="border-surface-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-6 tracking-tight">Quick Actions</h2>
            <div className="space-y-3.5">
              {[
                { href: '/documents', icon: Upload,   label: 'Upload New', desc: 'Add PDF or images' },
                { href: '/search',    icon: Search, label: 'AI Search',  desc: 'Query across docs' },
                { href: '/documents', icon: Archive,  label: 'Full Library',    desc: 'Manage all files' },
              ].map(({ href, icon: Icon, label, desc }) => (
                <Link
                  key={href + label}
                  href={href}
                  className="flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-brand-500/5 dark:hover:bg-brand-500/10 border border-surface-200 hover:border-brand-500/30 transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-surface-100 dark:bg-slate-800 shadow-sm border border-surface-200 dark:border-slate-700 flex items-center justify-center group-hover:bg-brand-600 transition-colors">
                    <Icon className="w-5 h-5 text-brand-600 group-hover:text-brand-100 transition-colors" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">{label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-brand-600 transform group-hover:translate-x-1 transition-all" />
                </Link>
              ))}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-brand-600 to-indigo-700 dark:from-brand-700 dark:to-slate-900 text-white border-none shadow-xl shadow-brand-500/20">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md shadow-inner mx-auto mb-4 flex items-center justify-center">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
              <p className="text-xl font-extrabold tracking-tight">
                {stats?.indexed || 0} / {stats?.total || 0} Ready
              </p>
              <p className="text-brand-100 text-[11px] font-bold uppercase tracking-widest mt-1">Indexing Progress</p>
              
              <div className="mt-6 h-3 bg-white/20 rounded-full overflow-hidden shadow-inner p-0.5">
                <div
                  className="h-full bg-white rounded-full transition-all duration-1000 ease-out shadow-sm"
                  style={{
                    width: stats?.total
                      ? `${Math.round(((stats.indexed) / stats.total) * 100)}%`
                      : '0%'
                  }}
                />
              </div>
              <p className="text-sm text-brand-50 mt-4 font-bold">
                {stats?.total
                  ? `${Math.round(((stats.indexed || 0) / stats.total) * 100)}% of your library is AI-ready`
                  : 'Start by uploading documents'}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
