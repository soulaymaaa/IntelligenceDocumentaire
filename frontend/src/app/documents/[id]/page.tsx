'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  Archive,
  ArrowLeft,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FileText,
  GitBranch,
  Highlighter,
  RefreshCw,
  Scan,
  Sparkles,
  Pencil,
  Check,
  X,
  Trash2,
  Undo2,
  Languages,
  Download,
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
import { useLanguage } from '@/providers/LanguageProvider';
import { QRTrigger } from '@/components/layout/QRTrigger';
import type { Conversation, Document, MindMapNode, MindMapPayload, SummaryPayload } from '@/types';

type DetailTab = 'overview' | 'highlights' | 'summary' | 'mind_map' | 'chat' | 'translate';
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

const translationLanguages = [
  { value: 'French', label: 'Français' },
  { value: 'English', label: 'Anglais' },
  { value: 'Spanish', label: 'Espagnol' },
  { value: 'German', label: 'Allemand' },
  { value: 'Italian', label: 'Italien' },
  { value: 'Portuguese', label: 'Portugais' },
  { value: 'Arabic', label: 'Arabe' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

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
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showMoveFolder, setShowMoveFolder] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('French');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const translationRef = useRef<HTMLDivElement>(null);

  const { data: doc, isLoading, error } = useQuery<Document>({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    refetchInterval: (query: any) => {
      const current = query.state.data as Document | undefined;
      return current?.status === 'pending' || current?.status === 'processing_ocr' ? 3000 : false;
    },
  });

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => documentsApi.listFolders(),
  });

  useEffect(() => {
    if (doc) setEditedName(doc.originalName);
  }, [doc]);

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

  const mindMapMutation = useMutation({
    mutationFn: () => aiApi.generateMindMap(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const translateMutation = useMutation({
    mutationFn: (lang: string) => aiApi.translate(id, lang),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const renameMutation = useMutation({
    mutationFn: (newName: string) => documentsApi.rename(id, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      setIsEditingName(false);
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: (folderId: string | null) => documentsApi.moveToFolder(id, folderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['document', id] });
      setShowMoveFolder(false);
    },
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => {
      if (selectedConversationId) {
        return conversationsApi.sendMessage(selectedConversationId, { question: q, documentId: id });
      }
      return aiApi.ask(id, q);
    },
    onSuccess: () => {
      setQuestion('');
      qc.invalidateQueries({ queryKey: ['conversation', selectedConversationId] });
      qc.invalidateQueries({ queryKey: ['conversations', 'document', id] });
    },
  });

  const downloadTranslationAsPdf = async () => {
    if (!translationRef.current || !doc) return;
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(translationRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Translation_${targetLanguage}_${doc.originalName}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const canGenerateMindMap = !!doc?.extractedText && doc.extractedText.length > 200;
  const canTranslate = !!doc?.extractedText && doc.extractedText.length > 50;
const summaryData = useMemo<SummaryPayload>(
    () => ({
      short: doc?.summaryShort || '',
      detailed: doc?.summaryDetailed || doc?.summary || '',
      keyPoints: doc?.summaryBullets || [],
    }),
    [doc]
  );

  const mindMapData = useMemo(() => doc?.mindMap as any, [doc]);

  const translatedText = useMemo(() => {
    return doc?.translations?.find((t) => t.language === targetLanguage)?.text || '';
  }, [doc, targetLanguage]);

  const targetLanguageLabel = useMemo(() => {
    return translationLanguages.find((l) => l.value === targetLanguage)?.label || targetLanguage;
  }, [targetLanguage]);

  const activeTranslation = useMemo(() => {
    return doc?.translations?.find((t) => t.language === targetLanguage);
  }, [doc, targetLanguage]);

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
              <div className="flex items-center gap-3 mt-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 break-words">
                  {doc.originalName}
                </h1>
                <QRTrigger 
                  title="Mobile View" 
                  description="Continue reading this document on your phone. Perfect for reading on the go!"
                />
              </div>
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

<div className="rounded-3xl border border-surface-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/80">
                <div className="mb-4 flex items-center gap-2">
                  <AlignLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{copy.documents.detail.highlights.extractedText}</p>
                </div>
                <div className="max-h-[720px] overflow-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-inner shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-950/80 dark:shadow-black/20">
                  <p
                    className="whitespace-pre-wrap text-sm font-medium leading-8 text-slate-900 dark:text-slate-100"
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

        {tab === 'mind_map' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.mindMap.description}
                </p>
              </div>
              <Button
                className="h-11 justify-center rounded-xl px-5 font-bold"
                onClick={() => mindMapMutation.mutate()}
                disabled={!canGenerateMindMap}
                isLoading={mindMapMutation.isPending}
              >
                <GitBranch className="w-4 h-4" />
                {mindMapData ? copy.documents.detail.mindMap.regenerate : copy.documents.detail.mindMap.generate}
              </Button>
            </div>

            <div className="mt-6">
              {!canGenerateMindMap ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <AlertTriangle className="mx-auto w-10 h-10 text-amber-500" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.noText}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.mindMap.noTextHelper}
                  </p>
                </div>
              ) : mindMapMutation.isPending ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-surface-200 bg-surface-50">
                  <Spinner size="lg" />
                  <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {copy.documents.detail.mindMap.inProgress}
                  </p>
                </div>
              ) : mindMapData ? (
                <MindMapCanvas mindMap={mindMapData} />
              ) : (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <GitBranch className="mx-auto w-10 h-10 text-slate-300" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.mindMap.empty}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.mindMap.emptyHelper}
                  </p>
                </div>
              )}

              {mindMapMutation.isError && (
                <p className="mt-4 text-sm font-bold text-red-600">{getErrorMessage(mindMapMutation.error)}</p>
              )}
            </div>
          </Card>
        )}

{tab === 'translate' && (
          <Card className="border-surface-200">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.translation.title}</h2>
                <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {copy.documents.detail.translation.description}
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-[360px] sm:flex-row sm:items-end">
                <label className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                  <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                    {copy.documents.detail.translation.targetLanguage}
                  </span>
                  <select
                    value={targetLanguage}
                    onChange={(event) => setTargetLanguage(event.target.value)}
                    className="h-11 w-full rounded-xl border border-surface-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm outline-none transition-colors focus:border-brand-500 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {translationLanguages.map((language) => (
                      <option key={language.value} value={language.value}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  className="h-11 justify-center rounded-xl px-5 font-bold"
                  onClick={() => translateMutation.mutate(targetLanguage)}
                  disabled={!canTranslate}
                  isLoading={translateMutation.isPending}
                >
                  <Languages className="w-4 h-4" />
                  {copy.documents.detail.translation.translate}
                </Button>
              </div>
            </div>

            {(doc.translations || []).length > 0 && (
              <div className="mt-6">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  {copy.documents.detail.translation.available}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(doc.translations || []).map((translation, index) => {
                    const label =
                      translationLanguages.find((language) => language.value.toLowerCase() === translation.language.toLowerCase())?.label ||
                      translation.language;

                    return (
                      <button
                        key={`${translation.language}-${index}`}
                        onClick={() => setTargetLanguage(translation.language)}
                        className={`rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                          translation.language.toLowerCase() === targetLanguage.toLowerCase()
                            ? 'border-brand-500/30 bg-brand-50 text-brand-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300'
                            : 'border-surface-200 bg-white text-slate-600 hover:bg-surface-50 dark:bg-slate-950 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-6">
              {!canTranslate ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <AlertTriangle className="mx-auto w-10 h-10 text-amber-500" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.translation.noText}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.translation.noTextHelper}
                  </p>
                </div>
              ) : translateMutation.isPending && translateMutation.variables === targetLanguage ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-surface-200 bg-surface-50">
                  <Spinner size="lg" />
                  <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {copy.documents.detail.translation.inProgress}
                  </p>
                </div>
              ) : translatedText ? (
                <div className="rounded-3xl border border-brand-500/15 bg-gradient-to-br from-brand-50/80 to-white px-6 py-6 dark:border-brand-500/25 dark:from-slate-950/90 dark:to-slate-900/90">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600 dark:text-cyan-400">
                      {copy.documents.detail.translation.result} - {targetLanguageLabel}
                    </p>
                    <div className="flex items-center gap-3">
                      {activeTranslation && (
                        <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-green-700 dark:bg-green-500/10 dark:text-green-300">
                          {copy.documents.detail.translation.cached}
                        </span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 rounded-lg px-3 text-[10px] font-black uppercase tracking-widest bg-white/50 hover:bg-white dark:bg-white/5 dark:hover:bg-white/10"
                        onClick={downloadTranslationAsPdf}
                        isLoading={isGeneratingPdf}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        {copy.documents.detail.translation.download}
                      </Button>
                    </div>
                  </div>
                  <div ref={translationRef} className="p-4 rounded-2xl bg-white/40 dark:bg-black/20">
                    <p className="whitespace-pre-wrap text-sm font-medium leading-8 text-slate-800 dark:text-slate-100">
                      {translatedText}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <Languages className="mx-auto w-10 h-10 text-slate-300" />
                  <p className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-100">{copy.documents.detail.translation.empty}</p>
                  <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                    {copy.documents.detail.translation.emptyHelper}
                  </p>
                </div>
              )}

              {translateMutation.isError && (
                <p className="mt-4 text-sm font-bold text-red-600">{getErrorMessage(translateMutation.error)}</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Chat tab ────────────────────────────────────────── */}
        {tab === 'chat' && (
          <div className="grid gap-6 xl:grid-cols-[300px_1fr]">
            {/* Conversation sidebar */}
            <Card className="border-surface-200 h-fit">
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
                          ? 'border-brand-500/30 bg-brand-50/80 dark:bg-brand-500/20 shadow-sm'
                          : 'border-surface-200 bg-white dark:bg-slate-900/40 hover:border-brand-500/20 hover:bg-surface-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {conversation.title}
                      </p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        {formatDate(conversation.lastMessageAt)}
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
placeholder={copy.documents.detail.chat.placeholder}
                emptyTitle={copy.documents.detail.chat.assistant}
                emptyDescription={copy.documents.detail.chat.description}
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

const MindMapCanvas = ({ mindMap }: { mindMap: MindMapPayload }) => {
  const root: MindMapNode = mindMap.root || {
    title: mindMap.title,
    summary: mindMap.summary,
    children: [],
  };
  const branches = root.children || [];

  return (
    <div className="rounded-3xl border border-surface-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50/60 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-3xl rounded-3xl border border-cyan-500/25 bg-cyan-500 px-5 py-5 text-slate-950 shadow-xl shadow-cyan-500/10 dark:bg-cyan-400">
        <div className="flex items-start gap-3">
          <div className="mt-1 rounded-2xl bg-white/80 p-2 text-cyan-700">
            <GitBranch className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-black leading-tight">{root.title || mindMap.title}</p>
            {(root.summary || mindMap.summary) && (
              <p className="mt-2 text-sm font-semibold leading-7 text-slate-800">
                {root.summary || mindMap.summary}
              </p>
            )}
          </div>
        </div>
      </div>

      {branches.length > 0 && (
        <>
          <div className="mx-auto h-8 w-px bg-cyan-500/40" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {branches.map((branch, index) => (
              <MindMapBranch key={`${branch.title}-${index}`} branch={branch} index={index} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const mindMapColors = [
  'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-100',
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100',
  'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100',
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100',
  'border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100',
];

const MindMapBranch = ({
  branch,
  index,
}: {
branch: MindMapNode;
  index: number;
}) => {
  const children = branch.children || [];
  const colorClass = mindMapColors[index % mindMapColors.length];

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorClass}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-sm font-black shadow-sm dark:bg-white/10">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-base font-black leading-snug">{branch.title}</p>
          {branch.summary && (
            <p className="mt-2 text-sm font-semibold leading-6 opacity-75">
              {branch.summary}
            </p>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="mt-4 space-y-2">
          {children.map((child, childIndex) => (
            <MindMapChild key={`${child.title}-${childIndex}`} node={child} depth={0} />
          ))}
        </div>
      )}
    </div>
  );
};

const MindMapChild = ({ node, depth }: { node: MindMapNode; depth: number }) => {
  const children = node.children || [];

  return (
    <div className={`${depth > 0 ? 'ml-4 border-l border-current/20 pl-3' : ''}`}>
      <div className="rounded-xl border border-current/10 bg-white/70 px-3 py-2 text-slate-800 shadow-sm dark:bg-slate-950/40 dark:text-slate-100">
        <p className="text-sm font-black leading-snug">{node.title}</p>
        {node.summary && (
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
            {node.summary}
          </p>
        )}
      </div>

      {children.length > 0 && depth < 2 && (
        <div className="mt-2 space-y-2">
          {children.map((child, index) => (
            <MindMapChild key={`${child.title}-${index}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {children.length > 0 && depth >= 2 && (
        <p className="mt-2 rounded-lg bg-white/50 px-3 py-2 text-xs font-bold opacity-70 dark:bg-white/5">
          + {children.length}
        </p>
      )}
    </div>
  );
};
