'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Filter, FileText, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { UploadZone } from '@/components/documents/UploadZone';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { SkeletonCard } from '@/components/ui/Spinner';
import { documentsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';
import type { DocumentStatus } from '@/types';

const STATUS_TABS: Array<{ label: string; value: DocumentStatus | '' }> = [
  { label: 'All',        value: '' },
  { label: 'Indexed',    value: 'indexed' },
  { label: 'Pending',    value: 'pending' },
  { label: 'Processing', value: 'processing_ocr' },
  { label: 'Error',      value: 'error' },
  { label: 'Archived',   value: 'archived' },
];

export default function DocumentsPage() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | ''>('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', { page, status: statusFilter, search }],
    queryFn: () => documentsApi.list({
      page, limit: 20,
      status: statusFilter || undefined,
      search: search || undefined,
    }),
    refetchInterval: 10000, // poll for status updates
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setDeleteTarget(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => documentsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });

  const docs = data?.documents || [];
  const meta = data?.meta;

  return (
    <AppLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Documents</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
            {meta?.total ?? '—'} files stored in your library
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowUpload(true)} className="shadow-md shadow-brand-500/20">
            <Plus className="w-5 h-5 ml-0" />
            Add Document
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col xl:flex-row gap-5 mb-10">
        <div className="flex-1 max-w-xl">
          <Input
            placeholder="Search by name, tags, or content…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            icon={<Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
            className="shadow-sm border-surface-200"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-surface-100 border border-surface-200 rounded-2xl p-1.5 overflow-x-auto shadow-inner">
          {STATUS_TABS.map((t) => (
            <button
              key={t.label}
              onClick={() => { setStatusFilter(t.value); setPage(1); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === t.value
                  ? 'bg-card text-brand-600 dark:text-brand-400 shadow-sm border border-surface-200 dark:border-brand-500/20'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-card/50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-surface-200 shadow-sm">
          <div className="w-20 h-20 bg-surface-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-surface-200 dark:border-slate-700">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xl tracking-tight">No results matched your search</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 mb-8 max-w-md mx-auto font-medium">
            {search || statusFilter 
              ? 'Try adjusting your keywords or changing the status filter to find what you are looking for.' 
              : 'Your library is empty. Upload your first document to unlock AI-powered insights.'}
          </p>
          {!search && !statusFilter && (
            <Button onClick={() => setShowUpload(true)} size="lg" className="shadow-lg shadow-brand-500/20">
              <Plus className="w-5 h-5 mr-1" /> Create First Index
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {docs.map((doc) => (
              <DocumentCard
                key={doc._id}
                document={doc}
                onDelete={(id) => setDeleteTarget(id)}
                onArchive={(id) => archiveMutation.mutate(id)}
              />
            ))}
          </div>

          {/* Pagination */}
          {meta && meta.pages > 1 && (
            <div className="flex justify-center items-center gap-6 mt-12 bg-surface-100/50 backdrop-blur-sm p-4 rounded-3xl border border-surface-200 inline-flex mx-auto w-auto min-w-[300px]">
              <Button
                variant="secondary" size="sm"
                disabled={!meta.hasPrev}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                Page <span className="text-brand-600 dark:text-brand-400">{meta.page}</span> <span className="opacity-40">/</span> {meta.pages}
              </span>
              <Button
                variant="secondary" size="sm"
                disabled={!meta.hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Documents" className="max-w-2xl">
        <UploadZone
          onUploadComplete={() => {
            qc.invalidateQueries({ queryKey: ['documents'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setTimeout(() => setShowUpload(false), 1500);
          }}
        />
      </Modal>

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        isLoading={deleteMutation.isPending}
        title="Delete Document"
        message="Are you sure you want to permanently delete this document? This will also remove all extracted text, embeddings, and summaries."
        confirmLabel="Delete"
        danger
      />
    </AppLayout>
  );
}
