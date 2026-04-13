'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  BookOpen,
  ExternalLink,
  FileSearch,
  FileText,
  Highlighter,
  RefreshCw,
  Scan,
  Sparkles,
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
import type { Conversation, Document, SummaryPayload } from '@/types';

type DetailTab = 'overview' | 'highlights' | 'summary' | 'chat';
type SummaryView = 'short' | 'detailed' | 'key_points';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<DetailTab>('overview');
  const [summaryView, setSummaryView] = useState<SummaryView>('short');
  const [question, setQuestion] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: doc, isLoading } = useQuery<Document>({
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
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => documentsApi.restore(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      qc.invalidateQueries({ queryKey: ['documents'] });
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
          <h2 className="text-slate-900 dark:text-slate-100 font-semibold text-lg">Document not found</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">The document you are looking for does not exist or has been deleted.</p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/documents')}>
            Back to documents
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
      <div className="space-y-8">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/documents')}>
            <ArrowLeft className="w-4 h-4" />
            Documents
          </Button>
          <span className="text-slate-300">/</span>
          <span className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{doc.originalName}</span>
        </div>

        <Card className="overflow-hidden border-surface-200 bg-gradient-to-br from-white via-surface-50 to-brand-50/40">
          <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">
                    Document intelligence
                  </p>
                  <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                    {doc.originalName}
                  </h1>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      {formatBytes(doc.size)}
                    </span>
                    <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                      {formatDate(doc.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => ocrMutation.mutate()} isLoading={ocrMutation.isPending}>
                  <Scan className="w-4 h-4" />
                  OCR
                </Button>
                <Button variant="secondary" onClick={() => reindexMutation.mutate()} isLoading={reindexMutation.isPending}>
                  <RefreshCw className="w-4 h-4" />
                  Re-index
                </Button>
                {!doc.archived ? (
                  <Button variant="secondary" onClick={() => archiveMutation.mutate()} isLoading={archiveMutation.isPending}>
                    <Archive className="w-4 h-4" />
                    Archive
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => restoreMutation.mutate()} isLoading={restoreMutation.isPending}>
                    <Undo2 className="w-4 h-4" />
                    Restore
                  </Button>
                )}
                <Button onClick={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending}>
                  <Sparkles className="w-4 h-4" />
                  Refresh summaries
                </Button>
                <Button variant="danger" onClick={() => setShowDelete(true)} className="ml-auto">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card className="border-surface-200 bg-white/90 p-5">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">AI state</p>
                <div className="mt-4 space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Conversations</span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">{conversations.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Pages</span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">{doc.pageCount || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Summary ready</span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100">{summaryData.detailed ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </Card>

              <Card className="border-surface-200 bg-slate-950 text-white">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">Preview</p>
                <p className="mt-3 text-sm font-medium text-white/80">
                  Open the original document and jump to cited pages from the conversation sources.
                </p>
                {previewUrl && (
                  <Button
                    variant="secondary"
                    className="mt-4 border-white/10 bg-white/10 text-white hover:bg-white/15"
                    onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open original
                  </Button>
                )}
              </Card>
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-surface-200 bg-surface-100 p-2">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'highlights', label: 'Highlights', icon: Highlighter },
            { id: 'summary', label: 'Summaries', icon: Sparkles },
            { id: 'chat', label: 'AI Chat', icon: FileSearch },
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
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Document preview</h2>
              <div className="mt-5 overflow-hidden rounded-3xl border border-surface-200 bg-slate-50">
                {doc.mimeType === 'application/pdf' && previewUrl ? (
                  <iframe
                    title="Document preview"
                    src={previewUrl}
                    className="h-[720px] w-full bg-white"
                  />
                ) : (
                  <div className="flex h-[320px] items-center justify-center text-sm font-medium text-slate-500">
                    Inline preview is available for PDF documents.
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-surface-200">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Latest AI evidence</h2>
              <div className="mt-5 space-y-4">
                {!activeAssistantMessage?.sources?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm font-medium text-slate-500">
                    Ask a question in the AI Chat tab to generate source-backed evidence.
                  </div>
                ) : (
                  activeAssistantMessage.sources.map((source, index) => (
                    <div key={`${source.chunkId}-${index}`} className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{source.documentName}</p>
                        <Button variant="ghost" size="sm" onClick={() => openSourcePage(source.pageNumber)}>
                          Open source
                        </Button>
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">{source.text}</p>
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
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Relevant passages</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Highlighted from the latest assistant answer. This is a safe first step toward full PDF-level highlighting.
                </p>
              </div>
              {activeAssistantMessage?.sources?.[0]?.pageNumber && (
                <Button variant="secondary" onClick={() => openSourcePage(activeAssistantMessage.sources?.[0]?.pageNumber)}>
                  <ExternalLink className="w-4 h-4" />
                  Open cited page
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr,1.1fr]">
              <div className="space-y-4">
                {(activeAssistantMessage?.highlights || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm font-medium text-slate-500">
                    No AI highlight available yet. Ask a question first to extract relevant passages.
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
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Extracted text with dynamic highlighting</p>
                </div>
                <div className="max-h-[720px] overflow-auto rounded-2xl bg-white p-6">
                  <p
                    className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{
                      __html: highlightText(doc.extractedText || 'No extracted text available.', highlightTerms),
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
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Multi-format summaries</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Short brief, detailed synthesis, and key points, all generated from the existing OCR text.
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
                    {mode === 'short' ? 'Short' : mode === 'detailed' ? 'Detailed' : 'Key points'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              {summaryView === 'key_points' ? (
                summaryData.keyPoints.length ? (
                  <div className="grid gap-3">
                    {summaryData.keyPoints.map((point, index) => (
                      <div key={index} className="rounded-2xl border border-surface-200 bg-white px-4 py-4 text-sm font-medium leading-7 text-slate-700 dark:text-slate-300">
                        {point}
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySummary onGenerate={() => summaryMutation.mutate('all')} isLoading={summaryMutation.isPending} />
                )
              ) : summaryData[summaryView] ? (
                <div className="rounded-3xl border border-brand-500/15 bg-gradient-to-br from-brand-50/70 to-white px-6 py-6 text-sm leading-8 text-slate-700 dark:text-slate-200">
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
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">History</p>
                  <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Document threads</h2>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    const conversation = await conversationsApi.create({
                      title: 'New document thread',
                      scope: 'document',
                      documentId: id,
                    });
                    setSelectedConversationId(conversation._id);
                    qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  New
                </Button>
              </div>

              <div className="mt-5 space-y-3">
                {conversations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm font-medium text-slate-500">
                    No conversation yet for this document.
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
                placeholder="Ask this specific document anything: clauses, dates, obligations, exceptions..."
                emptyTitle="Document-specific assistant"
                emptyDescription="This thread is scoped to the current document and keeps the full conversation history."
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
        title="Delete Document"
        message={`Delete "${doc.originalName}" and all related OCR, embeddings, summaries, and conversations?`}
        confirmLabel="Delete"
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
}) => (
  <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
    <FileText className="mx-auto w-10 h-10 text-slate-300" />
    <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">No summary generated yet</p>
    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
      Generate the short, detailed, and key-point views from the current OCR text.
    </p>
    <Button className="mt-5" onClick={onGenerate} isLoading={isLoading}>
      <Sparkles className="w-4 h-4" />
      Generate summaries
    </Button>
  </div>
);
