'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  FileSearch,
  FileText,
  Highlighter,
  Languages,
  RefreshCw,
  Scan,
  Sparkles,
  Trash2,
  Undo2,
  XCircle,
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

type DetailTab = 'overview' | 'highlights' | 'summary' | 'chat' | 'translation';
type SupportedLang = 'ar' | 'en' | 'fr';
type SourceLang = SupportedLang | 'auto';

const LANG_LABELS: Record<SupportedLang, { label: string; native: string; dir: 'ltr' | 'rtl' }> = {
  ar: { label: 'Arabic', native: 'العربية', dir: 'rtl' },
  en: { label: 'English', native: 'English', dir: 'ltr' },
  fr: { label: 'Français', native: 'Français', dir: 'ltr' },
};
type SummaryView = 'short' | 'detailed' | 'key_points';

// ── PDF Preview with error handling ──────────────────────────────────────────

const PdfPreview = ({ url, originalName }: { url: string; originalName: string }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (status === 'loading') setStatus('error');
    }, 6000);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="relative h-[680px] w-full overflow-hidden rounded-2xl border border-surface-200 bg-slate-50">
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 z-10">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-500">Chargement du document…</p>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 z-10 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500">
            <XCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Aperçu non disponible</p>
            <p className="mt-1 text-sm text-slate-500">
              Le backend doit être démarré sur{' '}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono">localhost:3001</code>
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="w-4 h-4" />
            Ouvrir dans un nouvel onglet
          </Button>
        </div>
      )}

      <iframe
        ref={iframeRef}
        title={`Aperçu — ${originalName}`}
        src={url}
        className="h-full w-full bg-white"
        onLoad={() => setStatus('ok')}
        onError={() => setStatus('error')}
        style={{ display: status === 'error' ? 'none' : 'block' }}
      />
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<DetailTab>('overview');
  const [summaryView, setSummaryView] = useState<SummaryView>('short');
  const [question, setQuestion] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Translation state
  const [sourceLang, setSourceLang] = useState<SourceLang>('auto');
  const [targetLang, setTargetLang] = useState<SupportedLang>('fr');
  const [translationResult, setTranslationResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
    mutationFn: (mode: 'short' | 'detailed' | 'key_points' | 'all') =>
      aiApi.generateSummary(id, mode),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const translateMutation = useMutation({
    mutationFn: () => aiApi.translate(id, targetLang, sourceLang),
    onSuccess: (data) => setTranslationResult(data.translation),
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

  const summaryData = useMemo<SummaryPayload>(
    () => ({
      short: doc?.summaryShort || '',
      detailed: doc?.summaryDetailed || doc?.summary || '',
      keyPoints: doc?.summaryBullets || [],
    }),
    [doc]
  );

  const activeAssistantMessage = useMemo(() => {
    const messages = activeConversation?.messages || [];
    return [...messages].reverse().find((m) => m.role === 'assistant');
  }, [activeConversation]);

  const previewUrl = getDocumentPreviewUrl(doc?.filename);
  const highlightTerms =
    activeAssistantMessage?.highlights?.flatMap((h) => h.matchedTerms) || [];

  if (isLoading || !doc) {
    return (
      <AppLayout>
        <div className="flex h-64 items-center justify-center">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg text-slate-900 dark:text-slate-100">Document introuvable</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Le document que vous cherchez n'existe pas ou a été supprimé.
          </p>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/documents')}>
            Retour aux documents
          </Button>
        </div>
      </AppLayout>
    );
  }

  const openSourcePage = (pageNumber?: number) => {
    const url = getDocumentPreviewUrl(doc.filename, pageNumber);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const TABS = [
    { id: 'overview', label: 'Aperçu', icon: BookOpen },
    { id: 'highlights', label: 'Passages', icon: Highlighter },
    { id: 'summary', label: 'Résumés', icon: Sparkles },
    { id: 'translation', label: 'Traduction', icon: Languages },
    { id: 'chat', label: 'Chat IA', icon: FileSearch },
  ] as const;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push('/documents')}>
            <ArrowLeft className="w-4 h-4" />
            Documents
          </Button>
          <span className="text-slate-300 dark:text-slate-600">/</span>
          <span className="truncate max-w-[260px] text-sm font-semibold text-slate-700 dark:text-slate-200">
            {doc.originalName}
          </span>
        </div>

        {/* Hero card */}
        <Card className="overflow-hidden border-surface-200 bg-gradient-to-br from-white via-surface-50 to-brand-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-brand-950/20">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Left: meta + actions */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-brand-500">
                Intelligence Documentaire
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 break-words">
                {doc.originalName}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusBadge status={doc.status} />
                <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                  {formatBytes(doc.size)}
                </span>
                <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                  {formatDate(doc.createdAt)}
                </span>
                {doc.pageCount && (
                  <span className="rounded-full border border-surface-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                    {doc.pageCount} page{doc.pageCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => ocrMutation.mutate()}
                  isLoading={ocrMutation.isPending}
                >
                  <Scan className="w-4 h-4" />
                  OCR
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => reindexMutation.mutate()}
                  isLoading={reindexMutation.isPending}
                >
                  <RefreshCw className="w-4 h-4" />
                  Réindexer
                </Button>
                {!doc.archived ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => archiveMutation.mutate()}
                    isLoading={archiveMutation.isPending}
                  >
                    <Archive className="w-4 h-4" />
                    Archiver
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => restoreMutation.mutate()}
                    isLoading={restoreMutation.isPending}
                  >
                    <Undo2 className="w-4 h-4" />
                    Restaurer
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => summaryMutation.mutate('all')}
                  isLoading={summaryMutation.isPending}
                >
                  <Sparkles className="w-4 h-4" />
                  Générer résumés
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setShowDelete(true)}
                  className="ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </Button>
              </div>
            </div>

            {/* Right: stats + preview button */}
            <div className="space-y-4">
              <Card className="border-surface-200 bg-white/80 dark:bg-slate-800/60 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                  État IA
                </p>
                <div className="mt-4 space-y-3">
                  {[
                    { label: 'Conversations', value: conversations.length },
                    { label: 'Pages', value: doc.pageCount ?? 'N/D' },
                    {
                      label: 'Résumé',
                      value: summaryData.detailed ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-extrabold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Prêt
                        </span>
                      ) : (
                        <span className="text-slate-400 font-bold">Non généré</span>
                      ),
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="font-extrabold text-slate-900 dark:text-slate-100">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {previewUrl && (
                <Card className="border-surface-200 bg-slate-950 text-white p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">
                    Document original
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/70 leading-6">
                    Ouvrir le fichier source et naviguer vers les pages citées.
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-4 border-white/10 bg-white/10 text-white hover:bg-white/20"
                    onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ouvrir l'original
                  </Button>
                </Card>
              )}
            </div>
          </div>
        </Card>

        {/* Tab bar */}
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-surface-200 bg-surface-100/80 dark:bg-slate-800/50 dark:border-slate-700 p-1.5">
          {TABS.map(({ id: tabId, label, icon: Icon }) => (
            <button
              key={tabId}
              onClick={() => setTab(tabId as DetailTab)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
                tab === tabId
                  ? 'border border-surface-200 bg-white text-brand-700 shadow-sm dark:bg-slate-900 dark:border-slate-700 dark:text-brand-400'
                  : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 dark:hover:bg-slate-700/60 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab ────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-surface-200">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Aperçu du document
              </h2>
              <div className="mt-4">
                {doc.mimeType === 'application/pdf' && previewUrl ? (
                  <PdfPreview url={previewUrl} originalName={doc.originalName} />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-surface-200 bg-slate-50 text-sm font-medium text-slate-400">
                    Aperçu inline disponible pour les PDF uniquement.
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-surface-200">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Dernières preuves IA
              </h2>
              <div className="mt-4 space-y-3">
                {!activeAssistantMessage?.sources?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm font-medium text-slate-400">
                    Posez une question dans l'onglet <strong>Chat IA</strong> pour générer des preuves avec sources.
                  </div>
                ) : (
                  activeAssistantMessage.sources.map((source, i) => (
                    <div
                      key={`${source.chunkId}-${i}`}
                      className="rounded-2xl border border-surface-200 bg-white dark:bg-slate-900 px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {source.documentName}
                        </p>
                        <Button variant="ghost" size="sm" onClick={() => openSourcePage(source.pageNumber)}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 line-clamp-3">
                        {source.text}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="rounded-full bg-brand-50 text-brand-700 border border-brand-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          Score {(source.score * 100).toFixed(1)}%
                        </span>
                        {source.pageNumber && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Page {source.pageNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ── Highlights tab ──────────────────────────────────── */}
        {tab === 'highlights' && (
          <Card className="border-surface-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Passages pertinents
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Extraits mis en évidence à partir de la dernière réponse de l'assistant.
                </p>
              </div>
              {activeAssistantMessage?.sources?.[0]?.pageNumber && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => openSourcePage(activeAssistantMessage.sources?.[0]?.pageNumber)}
                >
                  <ExternalLink className="w-4 h-4" />
                  Page citée
                </Button>
              )}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3">
                {!activeAssistantMessage?.highlights?.length ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-sm text-center font-medium text-slate-400">
                    Aucun passage disponible. Posez d'abord une question dans Chat IA.
                  </div>
                ) : (
                  activeAssistantMessage.highlights.map((highlight, i) => (
                    <div
                      key={`${highlight.sourceIndex}-${i}`}
                      className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-4"
                    >
                      <p
                        className="text-sm leading-7 text-slate-700 dark:text-slate-300"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(highlight.snippet, highlight.matchedTerms),
                        }}
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl border border-surface-200 bg-slate-50 dark:bg-slate-900/50 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                    Texte extrait avec surlignage
                  </p>
                </div>
                <div className="max-h-[640px] overflow-auto rounded-xl bg-white dark:bg-slate-950 p-5">
                  <p
                    className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-300"
                    dangerouslySetInnerHTML={{
                      __html: highlightText(
                        doc.extractedText || 'Aucun texte extrait disponible.',
                        highlightTerms
                      ),
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Summary tab ─────────────────────────────────────── */}
        {tab === 'summary' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Résumés multi-format
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Résumé court, synthèse détaillée et points clés générés depuis le texte OCR.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'short', label: 'Court' },
                    { key: 'detailed', label: 'Détaillé' },
                    { key: 'key_points', label: 'Points clés' },
                  ] as const
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setSummaryView(key)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                      summaryView === key
                        ? 'bg-brand-600 text-white shadow-sm'
                        : 'bg-surface-100 text-slate-600 hover:bg-surface-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              {summaryView === 'key_points' ? (
                summaryData.keyPoints.length ? (
                  <div className="grid gap-3">
                    {summaryData.keyPoints.map((point, i) => (
                      <div
                        key={i}
                        className="flex gap-3 rounded-2xl border border-surface-200 bg-white dark:bg-slate-900 px-5 py-4"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-black text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                          {i + 1}
                        </span>
                        <p className="text-sm font-medium leading-7 text-slate-700 dark:text-slate-300">
                          {point}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptySummary
                    onGenerate={() => summaryMutation.mutate('all')}
                    isLoading={summaryMutation.isPending}
                  />
                )
              ) : summaryData[summaryView] ? (
                <div className="rounded-2xl border border-brand-500/15 bg-gradient-to-br from-brand-50/60 to-white dark:from-brand-950/30 dark:to-slate-900 px-6 py-6 text-sm leading-8 text-slate-700 dark:text-slate-200">
                  {summaryData[summaryView]}
                </div>
              ) : (
                <EmptySummary
                  onGenerate={() => summaryMutation.mutate('all')}
                  isLoading={summaryMutation.isPending}
                />
              )}

              {summaryMutation.isError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {getErrorMessage(summaryMutation.error)}
                </div>
              )}

              {summaryMutation.isSuccess && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Résumés générés avec succès.
                </div>
              )}
            </div>
          </Card>
        )}

        {/* ── Translation tab ─────────────────────────────────── */}
        {tab === 'translation' && (
          <Card className="border-surface-200">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Traduction du document
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Traduit le texte extrait par OCR. Fonctionne avec des documents longs.
                </p>
              </div>
            </div>

            {/* Language picker */}
            <div className="mt-6 flex flex-wrap items-end gap-4">
              {/* Source language */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  De
                </label>
                <div className="flex gap-2">
                  {(['auto', 'ar', 'en', 'fr'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setSourceLang(lang)}
                      className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all border ${
                        sourceLang === lang
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {lang === 'auto'
                        ? '🔍 Auto'
                        : lang === 'ar'
                        ? '🇸🇦 AR'
                        : lang === 'en'
                        ? '🇬🇧 EN'
                        : '🇫🇷 FR'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Arrow */}
              <div className="flex items-center pb-2 text-slate-300 dark:text-slate-600">
                <ArrowRight className="w-5 h-5" />
              </div>

              {/* Target language */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Vers
                </label>
                <div className="flex gap-2">
                  {(['ar', 'en', 'fr'] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setTargetLang(lang);
                        setTranslationResult(null);
                      }}
                      className={`rounded-xl px-3.5 py-2 text-sm font-bold transition-all border ${
                        targetLang === lang
                          ? 'bg-brand-600 text-white border-transparent shadow-sm shadow-brand-500/25'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-300'
                      }`}
                    >
                      {lang === 'ar'
                        ? '🇸🇦 العربية'
                        : lang === 'en'
                        ? '🇬🇧 English'
                        : '🇫🇷 Français'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Translate button */}
              <Button
                onClick={() => {
                  setTranslationResult(null);
                  translateMutation.mutate();
                }}
                isLoading={translateMutation.isPending}
                disabled={!doc.extractedText || translateMutation.isPending}
                className="shadow-md shadow-brand-500/20 mb-0.5"
              >
                <Languages className="w-4 h-4" />
                {translateMutation.isPending ? 'Traduction en cours…' : 'Traduire'}
              </Button>
            </div>

            {/* No extracted text warning */}
            {!doc.extractedText && (
              <div className="mt-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 px-5 py-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                    Texte non extrait
                  </p>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-0.5">
                    Lancez l'OCR sur ce document pour extraire le texte avant de le traduire.
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {translateMutation.isError && (
              <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {getErrorMessage(translateMutation.error)}
              </div>
            )}

            {/* Loading skeleton */}
            {translateMutation.isPending && !translationResult && (
              <div className="mt-6 space-y-3 animate-pulse">
                {[90, 80, 95, 70, 85].map((w, i) => (
                  <div
                    key={i}
                    className="h-4 rounded-full bg-slate-200 dark:bg-slate-700"
                    style={{ width: `${w}%` }}
                  />
                ))}
              </div>
            )}

            {/* Translation result */}
            {translationResult && (
              <div className="mt-6">
                {/* Result header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      Traduit en{' '}
                      <span className="text-brand-600 dark:text-brand-400">
                        {LANG_LABELS[targetLang].native}
                      </span>
                    </span>
                    <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {translationResult.length.toLocaleString()} chars
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(translationResult);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-all border border-transparent hover:border-brand-200"
                  >
                    <ClipboardCopy className="w-3.5 h-3.5" />
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>

                {/* Text area */}
                <div
                  dir={LANG_LABELS[targetLang].dir}
                  lang={targetLang}
                  className={`max-h-[600px] overflow-y-auto rounded-2xl border border-surface-200 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 text-sm leading-8 text-slate-700 dark:text-slate-200 whitespace-pre-wrap ${
                    targetLang === 'ar'
                      ? 'font-[system-ui] text-base tracking-normal'
                      : ''
                  }`}
                  style={targetLang === 'ar' ? { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif' } : {}}
                >
                  {translationResult}
                </div>

                {/* Download */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => {
                      const blob = new Blob([translationResult], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${doc.originalName.replace(/\.[^.]+$/, '')}_${targetLang}.txt`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="text-xs font-bold text-slate-400 hover:text-brand-600 transition-colors underline underline-offset-2"
                  >
                    Télécharger en .txt
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* ── Chat tab ────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            {/* Conversation sidebar */}
            <Card className="border-surface-200 h-fit">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                    Historique
                  </p>
                  <h2 className="mt-1.5 text-base font-extrabold text-slate-900 dark:text-slate-100">
                    Fils de discussion
                  </h2>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    const conv = await conversationsApi.create({
                      title: 'Nouveau fil',
                      scope: 'document',
                      documentId: id,
                    });
                    setSelectedConversationId(conv._id);
                    qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
                  }}
                >
                  <Sparkles className="w-4 h-4" />
                  Nouveau
                </Button>
              </div>

              <div className="mt-4 space-y-2">
                {conversations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm text-center font-medium text-slate-400">
                    Aucune conversation pour ce document.
                  </div>
                ) : (
                  conversations.map((conv: Conversation) => (
                    <button
                      key={conv._id}
                      onClick={() => setSelectedConversationId(conv._id)}
                      className={`w-full rounded-xl border px-4 py-3.5 text-left transition-all ${
                        selectedConversationId === conv._id
                          ? 'border-brand-500/30 bg-brand-50/80 dark:bg-brand-950/30 shadow-sm'
                          : 'border-surface-200 bg-white hover:bg-surface-50 dark:bg-slate-900 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {conv.title}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {formatDate(conv.lastMessageAt)}
                      </p>
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Chat panel */}
            <div className="space-y-3">
              <ConversationPanel
                conversation={activeConversation || null}
                question={question}
                onQuestionChange={setQuestion}
                onSend={() => askMutation.mutate(question)}
                isSending={askMutation.isPending}
                placeholder="Posez une question sur ce document : clauses, dates, obligations, résultats…"
                emptyTitle="Assistant du document"
                emptyDescription="Ce fil est limité au document courant et conserve tout l'historique de conversation."
              />

              {askMutation.isError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {getErrorMessage(askMutation.error)}
                </div>
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
        title="Supprimer le document"
        message={`Supprimer "${doc.originalName}" ainsi que tous les OCR, embeddings, résumés et conversations associés ?`}
        confirmLabel="Supprimer"
        danger
      />
    </AppLayout>
  );
}

// ── Empty summary state ───────────────────────────────────────────────────────

const EmptySummary = ({
  onGenerate,
  isLoading,
}: {
  onGenerate: () => void;
  isLoading?: boolean;
}) => (
  <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 dark:bg-slate-900/40 px-6 py-12 text-center">
    <FileText className="mx-auto w-10 h-10 text-slate-300" />
    <p className="mt-4 text-base font-bold text-slate-900 dark:text-slate-100">
      Aucun résumé généré
    </p>
    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
      Générez les vues courte, détaillée et points clés à partir du texte OCR.
    </p>
    <Button className="mt-5" onClick={onGenerate} isLoading={isLoading}>
      <Sparkles className="w-4 h-4" />
      Générer les résumés
    </Button>
  </div>
);
