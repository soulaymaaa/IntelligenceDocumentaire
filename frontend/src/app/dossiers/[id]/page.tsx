'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, FileText, RefreshCw, Pencil, Check, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { Button } from '@/components/ui/Button';
import { ConfirmModal } from '@/components/ui/Modal';
import { SkeletonCard } from '@/components/ui/Spinner';
import { documentsApi, dossiersApi } from '@/lib/api';

export default function DossierPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');

  const { data: dossiers } = useQuery({
    queryKey: ['dossiers'],
    queryFn: () => dossiersApi.list(),
  });

  const dossier = dossiers?.find((d) => d._id === id);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', { dossierId: id }],
    queryFn: () => documentsApi.list({ dossierId: id, limit: 100 }),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.delete(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', { dossierId: id }] });
      setDeleteTarget(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.archive(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', { dossierId: id }] }),
  });

  const restoreMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.restore(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', { dossierId: id }] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ docId, dossierId }: { docId: string; dossierId: string | null }) =>
      documentsApi.move(docId, dossierId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => dossiersApi.update(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dossiers'] });
      setEditingName(false);
    },
  });

  const handleStartEdit = () => {
    setNameValue(dossier?.name || '');
    setEditingName(true);
  };

  const handleSaveName = () => {
    if (nameValue.trim()) renameMutation.mutate(nameValue.trim());
    else setEditingName(false);
  };

  const docs = data?.documents || [];

  return (
    <AppLayout breadcrumbLabel={dossier?.name}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ backgroundColor: (dossier?.color || '#6366F1') + '22' }}
          >
            <FolderOpen className="w-5 h-5" style={{ color: dossier?.color || '#6366F1' }} />
          </div>
          <div>
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  className="text-2xl font-extrabold bg-transparent border-b-2 border-brand-400 outline-none text-slate-900 dark:text-slate-100 tracking-tight w-48"
                  autoFocus
                />
                <button onClick={handleSaveName} className="text-brand-600 hover:text-brand-700">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingName(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
                {dossier?.name || 'Dossier'}
                <button
                  onClick={handleStartEdit}
                  className="text-slate-300 hover:text-slate-500 transition-colors"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </h1>
            )}
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-0.5">
              {docs.length} document{docs.length !== 1 ? 's' : ''} in this dossier
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          Refresh
        </Button>
      </div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(3).fill(0).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-surface-200 shadow-sm">
          <div className="w-20 h-20 bg-surface-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-surface-200 dark:border-slate-700">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xl tracking-tight">
            No documents in this dossier yet
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto font-medium">
            Go to your Documents library and use the folder icon on any card to move it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {docs.map((doc) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              dossiers={dossiers || []}
              onDelete={(docId) => setDeleteTarget(docId)}
              onArchive={(docId) => archiveMutation.mutate(docId)}
              onRestore={(docId) => restoreMutation.mutate(docId)}
              onMove={(docId, dossierId) => moveMutation.mutate({ docId, dossierId })}
            />
          ))}
        </div>
      )}

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
