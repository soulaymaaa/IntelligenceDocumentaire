'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  ExternalLink,
  FileSearch,
  FileText,
  Highlighter,
  RefreshCw,
  Scan,
  Sparkles,
  Pencil,
  Check,
  X,
  Trash2,
  Undo2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversationPanel } from '@/components/ai/ConversationPanel';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmModal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { documentsApi, aiApi, conversationsApi } from '@/lib/api';
import { formatBytes, formatDate, getDocumentPreviewUrl, getErrorMessage, highlightText } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';
import type { Conversation, Document, SummaryPayload } from '@/types';

type DetailTab = 'overview' | 'highlights' | 'summary' | 'chat';
type SummaryView = 'short' | 'detailed' | 'key_points';

export default function DocumentDetailPage() {
  const { copy } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<DetailTab>('overview');
  const [summaryView, setSummaryView] = useState<SummaryView>('short');
  const [question, setQuestion] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: doc, isLoading, error } = useQuery<Document>({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    refetchInterval: (query: any) => {
      const current = query.state.data as Document | undefined;
      return current?.status === 'pending' || current?.status === 'processing_ocr' ? 3000 : false;
    },
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', 'document', id],
    queryFn: () => conversationsApi.list({ scope: 'document', documentId: id }),
    enabled: !!id,
  });

  const { data: activeConversation } = useQuery({
    queryKey: ['conversation', selectedConversationId],
    queryFn: () => conversationsApi.get(selectedConversationId!),
    enabled: !!selectedConversationId,
  });

  useEffect(() => {
    if (!selectedConversationId && conversations[0]?._id) {
      setSelectedConversationId(conversations[0]._id);
    }
  }, [conversations, selectedConversationId]);

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      router.push('/documents');
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => documentsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => documentsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const ocrMutation = useMutation({
    mutationFn: () => documentsApi.runOcr(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const reindexMutation = useMutation({
    mutationFn: () => documentsApi.reindex(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const summaryMutation = useMutation({
    mutationFn: (mode: 'short' | 'detailed' | 'key_points' | 'all') => aiApi.generateSummary(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const renameMutation = useMutation({
    mutationFn: (newName: string) => documentsApi.rename(id, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');

  useEffect(() => {
    if (doc) setEditedName(doc.originalName);
  }, [doc]);

  const handleRename = async () => {
    if (editedName.trim() === '' || editedName === doc?.originalName) {
      setIsEditingName(false);
      setEditedName(doc?.originalName || '');
      return;
    }

    try {
      await renameMutation.mutateAsync(editedName.trim());
      setIsEditingName(false);
    } catch (error) {
      console.error('Failed to rename:', error);
      setEditedName(doc?.originalName || '');
    }
  };

  const askMutation = useMutation({
    mutationFn: async (content: string) => {
      const conversation =
        activeConversation ||
        (await conversationsApi.create({
          title: content.slice(0, 60),
          scope: 'document',
          documentId: id,
        }));

      return conversationsApi.sendMessage(conversation._id, {
        question: content,
        topK: 6,
        documentId: id,
      });
    },
    onSuccess: ({ conversation }) => {
      setSelectedConversationId(conversation._id);
      qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation._id] });
      setQuestion('');
      setTab('chat');
    },
  });

  const summaryData = useMemo<SummaryPayload>(() => ({
    short: doc?.summaryShort || '',
    detailed: doc?.summaryDetailed || doc?.summary || '',
    keyPoints: doc?.summaryBullets || [],
  }), [doc]);

  const activeAssistantMessage = useMemo(() => {
    const messages = activeConversation?.messages || [];
    return [...messages].reverse().find((message) => message.role === 'assistant');
  }, [activeConversation]);

  const previewUrl = getDocumentPreviewUrl(doc?.filename);
  const highlightTerms = activeAssistantMessage?.highlights?.flatMap((item) => item.matchedTerms) || [];

  if (isLoading || !doc) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !doc) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-slate-900 dark:text-slate-100 font-semibold text-lg">{copy.documents.detail.notFound}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">
            {copy.documents.detail.notFoundHelper}
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/documents')}>
            {copy.documents.detail.back}
          </Button>
        </div>
      </AppLayout>
    );
  }

  const openSourcePage = (pageNumber?: number) => {
    const url = getDocumentPreviewUrl(doc.filename, pageNumber);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <AppLayout>
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/documents')}
            className="rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {copy.common.documents}
          </Button>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="truncate text-sm font-bold text-slate-500 dark:text-slate-400 max-w-[200px]">{doc.originalName}</span>
        </div>

        <Card className="relative overflow-hidden border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-slate-950/50 backdrop-blur-xl shadow-xl shadow-slate-200/50 dark:shadow-none transition-all duration-500 group/hero">
          {/* Decorative Glows */}
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-brand-500/10 dark:bg-cyan-500/5 blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-cyan-500/10 dark:bg-brand-500/5 blur-3xl animate-pulse" />
          
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1.4fr,0.6fr] p-1">
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="h-1 w-6 rounded-full bg-brand-500 dark:bg-cyan-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-600 dark:text-cyan-400">
                      Analyse Documentaire IA
                    </p>
                  </div>
                  
                  <div className="mt-1">
                    {isEditingName ? (
                      <div className="flex items-center gap-3 animate-in slide-in-from-left-4">
                        <input
                          autoFocus
                          type="text"
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename();
                            if (e.key === 'Escape') {
                              setIsEditingName(false);
                              setEditedName(doc.originalName);
                            }
                          }}
                          className="bg-white dark:bg-slate-900 border-2 border-brand-500 dark:border-cyan-500/50 rounded-2xl px-4 py-2 text-3xl font-black text-slate-900 dark:text-white focus:outline-none shadow-lg shadow-brand-500/10 transition-all min-w-[350px]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleRename}
                            disabled={renameMutation.isPending}
                            className="p-3 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-500/20 transition-all active:scale-95"
                          >
                            <Check className="w-6 h-6" />
                          </button>
                          <button
                            onClick={() => {
                              setIsEditingName(false);
                              setEditedName(doc.originalName);
                            }}
                            disabled={renameMutation.isPending}
                            className="p-3 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-white transition-all"
                          >
                            <X className="w-6 h-6" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-4 group/title">
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                          {doc.originalName}
                        </h1>
                        <button
                          onClick={() => setIsEditingName(true)}
                          className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-white/30 hover:text-brand-600 dark:hover:text-cyan-400 hover:bg-brand-50 dark:hover:bg-white/10 transition-all opacity-40 group-hover/title:opacity-100 shadow-sm"
                          title={copy.documents.detail.editName}
                        >
                          <Pencil className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <StatusBadge status={doc.status} className="px-4 py-1.5 text-[11px] font-black uppercase rounded-xl border-none shadow-sm" />
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-white/5 px-4 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-sm border border-slate-200/50 dark:border-white/5">
                      <FileText className="w-3.5 h-3.5 opacity-60" />
                      {formatBytes(doc.size)}
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-slate-100/80 dark:bg-white/5 px-4 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 backdrop-blur-sm border border-slate-200/50 dark:border-white/5">
                      <BookOpen className="w-3.5 h-3.5 opacity-60" />
                      {formatDate(doc.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                {[
                  { icon: Scan, label: 'OCR', mutation: ocrMutation },
                  { icon: RefreshCw, label: 'Reindexer', mutation: reindexMutation },
                  { icon: doc.archived ? Undo2 : Archive, label: doc.archived ? 'Restaurer' : 'Archiver', mutation: doc.archived ? restoreMutation : archiveMutation },
                ].map((item, idx) => (
                  <Button
                    key={idx}
                    variant="secondary"
                    size="sm"
                    className="h-10 rounded-2xl border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 px-5 font-bold text-slate-700 dark:text-slate-200 hover:bg-brand-50 dark:hover:bg-white/10 hover:border-brand-200 dark:hover:border-cyan-500/20 transition-all shadow-sm group/btn"
                    onClick={() => item.mutation.mutate()}
                    isLoading={item.mutation.isPending}
                  >
                    <item.icon className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                    {item.label}
                  </Button>
                ))}
                
                <Button
                  size="sm"
                  className="h-10 rounded-2xl px-6 font-bold shadow-lg shadow-brand-500/20 bg-brand-600 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600 transition-all active:scale-95 group/sparkle"
                  onClick={() => summaryMutation.mutate('all')}
                  isLoading={summaryMutation.isPending}
                >
                  <Sparkles className="w-3.5 h-3.5 group-hover/sparkle:rotate-12 transition-transform" />
                  {copy.documents.refresh} resumes
                </Button>
                
                <div className="hidden sm:block mx-1 h-8 w-px bg-slate-200 dark:bg-white/10" />
                
                <Button 
                  variant="danger" 
                  size="sm" 
                  className="h-10 rounded-2xl px-5 font-bold opacity-80 hover:opacity-100 transition-all" 
                  onClick={() => setShowDelete(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {copy.documents.deleteConfirm}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 p-3 sm:p-5 lg:bg-slate-50/50 dark:lg:bg-white/[0.02] lg:border-l border-slate-200/50 dark:border-white/5">
              <div className="space-y-3">
                <Card className="border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 rounded-[24px] shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-600 dark:text-cyan-400 mb-3">{copy.documents.detail.intelState}</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSearch className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{copy.documents.detail.conversations}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{conversations.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{copy.documents.detail.pages}</span>
                      </div>
                      <span className="text-xs font-black text-slate-900 dark:text-white">{doc.pageCount || 'N/D'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{copy.documents.detail.activeSynthesis}</span>
                      </div>
                      <span className="text-xs font-black text-green-600 dark:text-green-400">{summaryData.detailed ? copy.documents.detail.ready : copy.documents.detail.notReady}</span>
                    </div>
                  </div>
                </Card>

                <Card className="border-none bg-[#0f172a] p-5 rounded-[24px] shadow-xl text-white relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2">{copy.documents.detail.quickPreview}</p>
                  <p className="text-xs font-medium leading-relaxed text-slate-300 mb-6">
                    {copy.documents.detail.highlights.description}
                  </p>
                  {previewUrl && (
                    <Button
                      variant="secondary"
                      className="w-full h-11 rounded-xl bg-white/10 border-white/10 text-white hover:bg-white hover:text-slate-900 transition-all font-black text-[10px] uppercase tracking-widest"
                      onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {copy.documents.detail.visualize}
                    </Button>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-surface-200 bg-surface-100 p-2">
          {[
            { id: 'overview', label: copy.documents.detail.tabs.overview, icon: BookOpen },
            { id: 'highlights', label: copy.documents.detail.tabs.highlights, icon: Highlighter },
            { id: 'summary', label: copy.documents.detail.tabs.summary, icon: Sparkles },
            { id: 'chat', label: copy.documents.detail.tabs.chat, icon: FileSearch },
          ].map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId as DetailTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                tab === tabId
                  ? 'border border-surface-200 bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[1fr,1fr]">
            <Card className="border-surface-200">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.overview.title}</h2>
              <div className="mt-5 overflow-hidden rounded-3xl border border-surface-200 bg-slate-50">
                {doc.mimeType === 'application/pdf' && previewUrl ? (
                  <iframe
                    title={copy.documents.detail.overview.title}
                    src={previewUrl}
                    className="h-[720px] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm font-medium text-slate-500">
                    {copy.documents.detail.overview.pdfOnly}
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-surface-200">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.overview.aiEvidence}</h2>
              <div className="mt-5 space-y-4">
                {!activeAssistantMessage?.sources?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm font-medium text-slate-500">
                    {copy.documents.detail.overview.noEvidence}
                  </div>
                ) : (
                  activeAssistantMessage.sources.map((source, index) => (
                    <div key={`${source.chunkId}-${index}`} className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-extrabold text-slate-900">{source.documentName}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-700 hover:text-brand-700 dark:text-slate-700 dark:hover:text-brand-700"
                          onClick={() => openSourcePage(source.pageNumber)}
                        >
                          {copy.documents.detail.overview.openSource}
                        </Button>
                      </div>
                      <p className="mt-3 text-sm font-medium leading-7 text-slate-700">{source.text}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {tab === 'highlights' && (
          <Card className="border-surface-200">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.highlights.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.highlights.description}
                </p>
              </div>
              {activeAssistantMessage?.sources?.[0]?.pageNumber && (
                <Button variant="secondary" onClick={() => openSourcePage(activeAssistantMessage.sources?.[0]?.pageNumber)}>
                  <ExternalLink className="w-4 h-4" />
                  {copy.documents.detail.highlights.openCited}
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="space-y-4">
                {(activeAssistantMessage?.highlights || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm font-medium text-slate-500">
                    {copy.documents.detail.highlights.noHighlights}
                  </div>
                ) : (
                  activeAssistantMessage?.highlights?.map((highlight, index) => (
                    <div key={`${highlight.sourceIndex}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-4">
                      <p
                        className="text-sm leading-7 text-slate-700"
                        dangerouslySetInnerHTML={{ __html: highlightText(highlight.snippet, highlight.matchedTerms) }}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-3xl border border-surface-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{copy.documents.detail.highlights.extractedText}</p>
                </div>
                <div className="max-h-[720px] overflow-auto rounded-2xl bg-white p-6">
                  <p
                    className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{
                    __html: highlightText(doc.extractedText || 'Aucun texte extrait disponible.', highlightTerms),
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {tab === 'summary' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.summary.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.summary.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['short', 'detailed', 'key_points'] as SummaryView[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSummaryView(mode)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                      summaryView === mode
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-100 text-slate-600 hover:bg-surface-200'
                    }`}
                  >
                    {mode === 'short' ? copy.documents.detail.summary.modes.short : mode === 'detailed' ? copy.documents.detail.summary.modes.detailed : copy.documents.detail.summary.modes.keyPoints}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              {summaryView === 'key_points' ? (
                summaryData.keyPoints.length ? (
                  <div className="grid gap-3">
                    {summaryData.keyPoints.map((point, index) => (
                      <div key={index} className="rounded-2xl border border-surface-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-100">
                        {point}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySummary onGenerate={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending} />
                )
              ) : summaryData[summaryView] ? (
                <div className="rounded-3xl border border-brand-500/15 bg-gradient-to-br from-brand-50/80 to-white px-6 py-6 text-sm font-medium leading-8 text-slate-800 dark:border-brand-500/25 dark:from-slate-950/90 dark:to-slate-900/90 dark:text-slate-100">
                  {summaryData[summaryView]}
                </div>
              ) : (
                <EmptySummary onGenerate={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending} />
              )}

              {summaryMutation.isError && (
                <p className="mt-4 text-sm font-bold text-red-600">{getErrorMessage(summaryMutation.error)}</p>
              )}
            </div>
          </Card>
        )}

        {tab === 'chat' && (
          <div className="grid gap-8 xl:grid-cols-[320px,1fr]">
            <Card className="border-surface-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">{copy.documents.detail.chat.history}</p>
                  <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.chat.threads}</h2>
                </div>
                  <Button
                    size="sm"
                    onClick={async () => {
                      const conversation = await conversationsApi.create({
                        title: copy.documents.detail.chat.new + ' ' + (conversations.length + 1),
                        scope: 'document',
                        documentId: id,
                      });
                      setSelectedConversationId(conversation._id);
                      qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    {copy.documents.detail.chat.new}
                  </Button>
              </div>

              <div className="mt-5 space-y-3">
                  {conversations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm font-medium text-slate-500">
                      {copy.documents.detail.chat.noConversations}
                    </div>
                  ) : (
                  conversations.map((conversation: Conversation) => (
                    <button
                      key={conversation._id}
                      onClick={() => setSelectedConversationId(conversation._id)}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${
                        selectedConversationId === conversation._id
                          ? 'border-brand-500/30 bg-brand-50/80 shadow-sm'
                          : 'border-surface-200 bg-white hover:border-brand-500/20 hover:bg-surface-50'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{conversation.title}</p>
                      <p className="mt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {formatDate(conversation.lastMessageAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <ConversationPanel
                conversation={activeConversation || null}
                question={question}
                onQuestionChange={setQuestion}
                onSend={() => askMutation.mutate(question)}
                isSending={askMutation.isPending}
                placeholder={copy.documents.detail.chat.placeholder}
                emptyTitle={copy.documents.detail.chat.assistant}
                emptyDescription={copy.documents.detail.chat.description}
              />

              {askMutation.isError && (
                <Card className="border-red-200 bg-red-50 text-sm font-bold text-red-700">
                  {getErrorMessage(askMutation.error)}
                </Card>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        title={copy.documents.detail.deleteTitle}
        message={copy.documents.detail.deleteMessage}
        confirmLabel={copy.documents.detail.deleteConfirm}
        danger
      />
    </AppLayout>
  );
}

const EmptySummary = ({
  onGenerate,
  isLoading,
}: {
  onGenerate: () => void;
  isLoading?: boolean;
}) => {
  const { copy } = useLanguage();
  return (
    <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
      <FileText className="mx-auto w-10 h-10 text-slate-300" />
      <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.summary.empty}</p>
      <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        {copy.documents.detail.summary.emptyHelper}
      </p>
      <button
        className="mt-5 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-brand-600 text-white font-bold hover:bg-brand-700 transition-all disabled:opacity-50"
        onClick={onGenerate}
        disabled={isLoading}
      >
        <Sparkles className="w-4 h-4" />
        {copy.documents.detail.summary.generate}
      </button>
    </div>
  );
};
