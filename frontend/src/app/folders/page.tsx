'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, FolderClosed, FolderPlus, Trash2, Plus, Search, Pencil, Sparkles } from 'lucide-react';
import { UploadZone } from '@/components/documents/UploadZone';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { SkeletonCard } from '@/components/ui/Spinner';
import { documentsApi } from '@/lib/api';
import { useLanguage } from '@/providers/LanguageProvider';

export default function FoldersPage() {
  const { copy } = useLanguage();
  const queryClient = useQueryClient();
  const folderCopy = copy.documents.folders;
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [search, setSearch] = useState('');
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [activeFolder, setActiveFolder] = useState<{ id: string; name: string } | null>(null);
  const [deleteDocTarget, setDeleteDocTarget] = useState<string | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['document-folders', search],
    queryFn: () => documentsApi.listFolders(search),
  });

  const folders = data?.folders || [];
  const matchingDocs = data?.documents || [];
  const folderToDelete = folders.find((folder) => folder._id === deleteFolderTarget);

  const createFolderMutation = useMutation({
    mutationFn: (name: string) => documentsApi.createFolder({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      setFolderName('');
      setShowCreateFolder(false);
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => documentsApi.deleteFolder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteFolderTarget(null);
    },
  });

  const handleCreateFolder = async (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) return;
    await createFolderMutation.mutateAsync(name);
  };

  const renameFolderMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => documentsApi.renameFolder(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      setRenameFolderTarget(null);
      setRenameName('');
    },
  });

  const handleRenameFolder = async (event: FormEvent) => {
    event.preventDefault();
    if (!renameFolderTarget || !renameName.trim()) return;
    await renameFolderMutation.mutateAsync({ id: renameFolderTarget, name: renameName.trim() });
  };

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setDeleteDocTarget(null);
    },
  });

  const archiveDocMutation = useMutation({
    mutationFn: (id: string) => documentsApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const restoreDocMutation = useMutation({
    mutationFn: (id: string) => documentsApi.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const renameDocMutation = useMutation({
    mutationFn: ({ id, newName }: { id: string; newName: string }) => documentsApi.rename(id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const moveToFolderMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) => documentsApi.moveToFolder(id, folderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return (
    <AppLayout>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {folderCopy.title}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
            {folderCopy.pageHelper}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreateFolder(true)} className="shadow-md shadow-brand-500/20">
          <FolderPlus className="h-4 w-4" />
          {folderCopy.create}
        </Button>
      </div>

      <div className="mb-10 max-w-xl">
        <Input
          placeholder={copy.documents.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />}
          className="shadow-sm border-surface-200"
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array(6).fill(0).map((_, index) => <SkeletonCard key={index} />)}
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-surface-200 bg-card py-24 text-center shadow-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl border border-surface-200 bg-surface-100 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <FolderClosed className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          </div>
          <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {search ? copy.documents.noResults : folderCopy.empty}
          </h3>
          <p className="mx-auto mt-3 mb-8 max-w-md text-sm font-medium text-slate-500 dark:text-slate-400">
            {search ? copy.documents.noResultsHelper : folderCopy.emptyHelper}
          </p>
          <Button onClick={() => setShowCreateFolder(true)} size="lg">
            <FolderPlus className="h-5 w-5" />
            {folderCopy.create}
          </Button>
        </div>
      ) : (
        <div className="space-y-12">
          {folders.length > 0 && (
            <section>
              <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {folderCopy.title} ({folders.length})
              </h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {folders.map((folder) => (
                  <div
                    key={folder._id}
                    className="group rounded-2xl border border-surface-200 bg-card p-5 shadow-sm transition-all duration-200 hover:border-brand-200 hover:shadow-md"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-surface-200 bg-surface-100 shadow-inner">
                        <FolderClosed className="h-6 w-6" style={{ color: folder.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <Link
                            href={`/folders/${folder._id}`}
                            className="line-clamp-2 text-sm font-extrabold text-slate-900 transition-colors hover:text-brand-600 dark:text-slate-100"
                          >
                            {folder.name}
                          </Link>
                          <div className="flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                            <button
                              onClick={() => {
                                setRenameFolderTarget(folder._id);
                                setRenameName(folder.name);
                              }}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                              title={folderCopy.rename}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeleteFolderTarget(folder._id)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                              title={folderCopy.deleteTitle}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-tight text-slate-500">
                          <FileText className="h-3.5 w-3.5" />
                          {folder.documentCount ?? 0} {folderCopy.documentsCount}
                        </div>

                        <div className="mt-5 flex items-center justify-between">
                          <Link
                            href={`/folders/${folder._id}`}
                            className="inline-flex items-center gap-2 text-xs font-extrabold text-brand-600 transition-colors hover:text-brand-700"
                          >
                            <Sparkles className="h-4 w-4" />
                            {folderCopy.open} & AI Chat
                          </Link>
                          <button
                            onClick={() => {
                              setActiveFolder({ id: folder._id, name: folder.name });
                              setShowUpload(true);
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors"
                            title={folderCopy.addToFolder}
                          >
                            <Plus className="h-4 w-4" />
                            <span className="hidden sm:inline">{folderCopy.addToFolder}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {search && matchingDocs.length > 0 && (
            <section>
              <h2 className="mb-6 text-sm font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {copy.common.documents} ({matchingDocs.length})
              </h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {matchingDocs.map((doc) => (
                  <DocumentCard
                    key={doc._id}
                    document={doc}
                    folders={folders}
                    onDelete={(id) => setDeleteDocTarget(id)}
                    onArchive={(id) => archiveDocMutation.mutate(id)}
                    onRestore={(id) => restoreDocMutation.mutate(id)}
                    onRename={async (id, newName) => {
                      await renameDocMutation.mutateAsync({ id, newName });
                    }}
                    onMove={async (id, folderId) => {
                      await moveToFolderMutation.mutateAsync({ id, folderId });
                    }}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={showCreateFolder}
        onClose={() => { setShowCreateFolder(false); setFolderName(''); }}
        title={folderCopy.createTitle}
        className="max-w-md"
      >
        <form onSubmit={handleCreateFolder} className="space-y-5">
          <Input
            label={folderCopy.nameLabel}
            placeholder={folderCopy.namePlaceholder}
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            icon={<FolderClosed className="h-4 w-4" />}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setShowCreateFolder(false); setFolderName(''); }}
              disabled={createFolderMutation.isPending}
            >
              {folderCopy.cancel}
            </Button>
            <Button type="submit" isLoading={createFolderMutation.isPending} disabled={!folderName.trim()}>
              <FolderPlus className="h-4 w-4" />
              {folderCopy.createConfirm}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={!!deleteFolderTarget}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => deleteFolderTarget && deleteFolderMutation.mutate(deleteFolderTarget)}
        isLoading={deleteFolderMutation.isPending}
        title={folderCopy.deleteTitle}
        message={folderToDelete ? `${folderCopy.deleteMessage} "${folderToDelete.name}"` : folderCopy.deleteMessage}
        confirmLabel={folderCopy.deleteConfirm}
        danger
      />

      <ConfirmModal
        isOpen={!!deleteDocTarget}
        onClose={() => setDeleteDocTarget(null)}
        onConfirm={() => deleteDocTarget && deleteDocMutation.mutate(deleteDocTarget)}
        isLoading={deleteDocMutation.isPending}
        title={copy.documents.deleteTitle}
        message={copy.documents.deleteMessage}
        confirmLabel={copy.documents.deleteConfirm}
        danger
      />

      <Modal
        isOpen={!!renameFolderTarget}
        onClose={() => { setRenameFolderTarget(null); setRenameName(''); }}
        title={folderCopy.renameTitle}
        className="max-w-md"
      >
        <form onSubmit={handleRenameFolder} className="space-y-5">
          <Input
            label={folderCopy.nameLabel}
            placeholder={folderCopy.namePlaceholder}
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
            icon={<FolderClosed className="h-4 w-4" />}
            autoFocus
          />
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setRenameFolderTarget(null); setRenameName(''); }}
              disabled={renameFolderMutation.isPending}
            >
              {folderCopy.cancel}
            </Button>
            <Button type="submit" isLoading={renameFolderMutation.isPending} disabled={!renameName.trim()}>
              <Pencil className="h-4 w-4" />
              {folderCopy.rename}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showUpload}
        onClose={() => { setShowUpload(false); setActiveFolder(null); }}
        title={copy.documents.uploadTitle}
        className="max-w-2xl"
      >
        <UploadZone
          folderId={activeFolder?.id || null}
          folderName={activeFolder?.name}
          onUploadComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['document-folders'] });
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            setTimeout(() => {
              setShowUpload(false);
              setActiveFolder(null);
            }, 1500);
          }}
        />
      </Modal>
    </AppLayout>
  );
}
