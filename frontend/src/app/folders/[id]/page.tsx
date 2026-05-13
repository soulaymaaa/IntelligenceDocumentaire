'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FolderOpen, FileText, RefreshCw, Pencil, Check, X, Search, Plus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { UploadZone } from '@/components/documents/UploadZone';
import { ConversationPanel } from '@/components/ai/ConversationPanel';
import { ScopedChatPanel } from '@/components/ai/ScopedChatPanel';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { SkeletonCard } from '@/components/ui/Spinner';
import { documentsApi, conversationsApi } from '@/lib/api';
import { useLanguage } from '@/providers/LanguageProvider';

const normalizeDocumentSearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function FolderPage() {
  const { id } = useParams<{ id: string }>();
  const { language } = useLanguage();
  const qc = useQueryClient();
  
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  
  const [question, setQuestion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  // Queries
  const { data: folderData } = useQuery({
    queryKey: ['document-folders'],
    queryFn: () => documentsApi.listFolders(),
  });

  const folder = folderData?.folders?.find((f) => f._id === id);

  const { data: docData, isLoading, refetch } = useQuery({
    queryKey: ['documents', { folderId: id }],
    queryFn: () => documentsApi.list({ folderId: id, limit: 100 }),
    enabled: !!id,
    refetchInterval: 10000,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', { folderId: id }],
    queryFn: () => conversationsApi.list({ scope: 'folder', folderId: id }),
    enabled: !!id,
  });

  const { data: activeConversation } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () => conversationsApi.get(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  // Effect to select first conversation if none selected
  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations, selectedConversationId]);

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.delete(docId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', { folderId: id }] });
      setDeleteTarget(null);
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.archive(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', { folderId: id }] }),
  });

  const restoreMutation = useMutation({
    mutationFn: (docId: string) => documentsApi.restore(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', { folderId: id }] }),
  });

  const moveMutation = useMutation({
    mutationFn: ({ docId, folderId }: { docId: string; folderId: string | null }) =>
      documentsApi.moveToFolder(docId, folderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['document-folders'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => documentsApi.renameFolder(id, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document-folders'] });
      setEditingName(false);
    },
  });

  const askMutation = useMutation({
    mutationFn: async (content: string) => {
      const conversation =
        activeConversation ||
        (await conversationsApi.create({ 
          title: content.slice(0, 60), 
          scope: 'folder',
          folderId: id 
        }));

      return conversationsApi.sendMessage(conversation._id, { 
        question: content, 
        topK: 6, 
        folderId: id,
        responseLanguage: language 
      });
    },
    onSuccess: ({ conversation }) => {
      setSelectedConversationId(conversation._id);
      qc.invalidateQueries({ queryKey: ['conversations', { folderId: id }] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation._id] });
      setQuestion('');
    },
  });

  // Handlers
  const handleStartEdit = () => {
    setNameValue(folder?.name || '');
    setEditingName(true);
  };

  const handleSaveName = () => {
    if (nameValue.trim()) renameMutation.mutate(nameValue.trim());
    else setEditingName(false);
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    await askMutation.mutateAsync(question);
  };

  const startNewConversation = async () => {
    const conversation = await conversationsApi.create({ 
      title: 'Folder conversation ' + (conversations.length + 1), 
      scope: 'folder',
      folderId: id
    });
    setSelectedConversationId(conversation._id);
    qc.invalidateQueries({ queryKey: ['conversations', { folderId: id }] });
  };

  const docs = docData?.documents || [];
  const normalizedSearchQuery = normalizeDocumentSearch(searchQuery.trim());
  const filteredDocs = normalizedSearchQuery
    ? docs.filter((doc) =>
        normalizeDocumentSearch(`${doc.originalName} ${doc.filename}`).includes(normalizedSearchQuery)
      )
    : docs;

  return (
    <AppLayout>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        {/* Left Side: Folder Content */}
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
                style={{ backgroundColor: (folder?.color || '#6366F1') + '22' }}
              >
                <FolderOpen className="w-5 h-5" style={{ color: folder?.color || '#6366F1' }} />
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
                    {folder?.name || 'Folder'}
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
                  {docs.length} document{docs.length !== 1 ? 's' : ''} in this folder
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowUpload(true)} className="shadow-md shadow-brand-500/20">
                <Plus className="w-4 h-4" />
                Ajouter un document
              </Button>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Refresh
              </Button>
            </div>
          </div>

          <div className="relative max-w-xl">
            <Search className="absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, tags ou contenu..."
              className="h-10 w-full bg-transparent pl-8 pr-8 text-base font-medium text-slate-900 placeholder:text-slate-400 outline-none dark:text-slate-100 dark:placeholder:text-slate-400"
            />
            {searchQuery.trim() && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-0 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Document grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array(4).fill(0).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-24 bg-card rounded-3xl border border-dashed border-surface-200 shadow-sm">
              <div className="w-20 h-20 bg-surface-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-surface-200 dark:border-slate-700">
                <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-xl tracking-tight">
                No documents in this folder yet
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-3 max-w-md mx-auto font-medium">
                Ajoutez directement un fichier dans ce dossier pour commencer.
              </p>
              <Button onClick={() => setShowUpload(true)} size="lg" className="mt-8 shadow-lg shadow-brand-500/20">
                <Plus className="w-5 h-5 mr-1" />
                Ajouter un document
              </Button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-surface-200 shadow-sm">
              <div className="w-16 h-16 bg-surface-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-surface-200 dark:border-slate-700">
                <Search className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              </div>
              <h3 className="text-slate-900 dark:text-slate-100 font-extrabold text-lg tracking-tight">
                Aucun document trouve
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto font-medium">
                Aucun nom de document ne correspond a "{searchQuery.trim()}" dans ce dossier.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredDocs.map((doc) => (
                <DocumentCard
                  key={doc._id}
                  document={doc}
                  folders={folderData?.folders || []}
                  onDelete={(docId) => setDeleteTarget(docId)}
                  onArchive={(docId) => archiveMutation.mutate(docId)}
                  onRestore={(docId) => restoreMutation.mutate(docId)}
                  onMove={(docId, folderId) => moveMutation.mutate({ docId, folderId })}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Side: AI Chat */}
        <ScopedChatPanel
          title="Folder AI Chat"
          subtitle={`${docs.length} document${docs.length !== 1 ? 's' : ''} linked to this folder`}
          conversations={conversations}
          selectedConversationId={selectedConversationId}
          onSelectConversation={setSelectedConversationId}
          onNewConversation={startNewConversation}
          storageKey="docintel_folder_chat_width"
        >
          <ConversationPanel
            conversation={activeConversation || null}
            question={question}
            onQuestionChange={setQuestion}
            onSend={handleAsk}
            isSending={askMutation.isPending}
            placeholder="Ask something about these documents..."
            emptyTitle="Ask this folder"
            emptyDescription="Answers use only the documents listed on the left."
            variant="embedded"
          />
        </ScopedChatPanel>
      </div>

      <Modal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        title={`Ajouter dans ${folder?.name || 'ce dossier'}`}
        className="max-w-2xl"
      >
        <UploadZone
          folderId={id}
          folderName={folder?.name}
          onUploadComplete={() => {
            qc.invalidateQueries({ queryKey: ['documents'] });
            qc.invalidateQueries({ queryKey: ['documents', { folderId: id }] });
            qc.invalidateQueries({ queryKey: ['document-folders'] });
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            setSearchQuery('');
            setTimeout(() => setShowUpload(false), 1500);
          }}
        />
      </Modal>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
        isLoading={deleteMutation.isPending}
        title="Delete Document"
        message="Are you sure you want to permanently delete this document?"
        confirmLabel="Delete"
        danger
      />
    </AppLayout>
  );
}
