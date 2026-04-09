'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, FileText, RefreshCw, Trash2, Archive,
  Scan, Zap, MessageSquare, AlignLeft, BookOpen,
  Copy, Check, ExternalLink, AlertTriangle, Brain, Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/Badge';
import { ConfirmModal } from '@/components/ui/Modal';
import { Spinner, InlineLoader } from '@/components/ui/Spinner';
import { Textarea } from '@/components/ui/Input';
import { documentsApi, aiApi } from '@/lib/api';
import { formatBytes, formatDate, getErrorMessage } from '@/lib/utils';
import type { RagAnswer, Document } from '@/types';

type Tab = 'overview' | 'text' | 'summary' | 'ask';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('overview');
  const [showDelete, setShowDelete] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [askError, setAskError] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: doc, isLoading, error } = useQuery<Document, Error>({
    queryKey: ['document', id],
    queryFn: () => documentsApi.get(id),
    refetchInterval: (query: any) => {
      const data = query.state.data;
      return data?.status === 'processing_ocr' || data?.status === 'pending' ? 3000 : false;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => documentsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['documents'] }); router.push('/documents'); },
  });

  const archiveMutation = useMutation({
    mutationFn: () => documentsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
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
    mutationFn: () => aiApi.generateSummary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['document', id] }),
  });

  const handleAsk = async () => {
    if (!question.trim()) return;
    setAskError('');
    setAnswer(null);
    setIsAsking(true);
    try {
      const result = await aiApi.ask(id, question);
      setAnswer(result);
    } catch (err) {
      setAskError(getErrorMessage(err));
    } finally {
      setIsAsking(false);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TABS: Array<{ id: Tab; label: string; icon: any }> = [
    { id: 'overview', label: 'Overview',       icon: BookOpen },
    { id: 'text',     label: 'Extracted Text', icon: AlignLeft },
    { id: 'summary',  label: 'Summary',        icon: FileText },
    { id: 'ask',      label: 'Ask AI',         icon: MessageSquare },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      </AppLayout>
    );
  }

  if (error || !doc) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <h2 className="text-white font-semibold text-lg">Document not found</h2>
          <Button variant="secondary" className="mt-4" onClick={() => router.push('/documents')}>
            Back to documents
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <Button variant="ghost" size="sm" onClick={() => router.push('/documents')} className="font-bold text-slate-500 hover:text-brand-600 hover:bg-brand-50">
          <ArrowLeft className="w-4 h-4 mr-1" /> Documents
        </Button>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 text-sm font-bold truncate max-w-xs">{doc.originalName}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-3xl p-8 mb-8 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center shrink-0 shadow-sm">
            <FileText className="w-8 h-8 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-3 flex-wrap">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight truncate flex-1">{doc.originalName}</h1>
              <StatusBadge status={doc.status} />
            </div>
            <div className="flex flex-wrap gap-5 mt-3 text-sm font-medium text-slate-500">
              <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 opacity-70" /> {formatBytes(doc.size)}</span>
              {doc.pageCount && <span className="flex items-center gap-1.5"><AlignLeft className="w-4 h-4 opacity-70" /> {doc.pageCount} pages</span>}
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 opacity-70" /> {formatDate(doc.createdAt)}</span>
            </div>
            {doc.errorMessage && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-3 text-red-600 text-sm font-bold">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                {doc.errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mt-8 pt-8 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={() => ocrMutation.mutate()} isLoading={ocrMutation.isPending} className="bg-white border-slate-200 text-slate-700">
            <Scan className="w-4 h-4" /> Run OCR Analysis
          </Button>
          {doc.status === 'indexed' && (
            <Button variant="secondary" size="sm" onClick={() => reindexMutation.mutate()} isLoading={reindexMutation.isPending} className="bg-white border-slate-200 text-slate-700">
              <RefreshCw className="w-4 h-4" /> Force Re-index
            </Button>
          )}
          {!doc.archived && (
            <Button variant="secondary" size="sm" onClick={() => archiveMutation.mutate()} isLoading={archiveMutation.isPending} className="bg-white border-slate-200 text-slate-700">
              <Archive className="w-4 h-4" /> Move to Archive
            </Button>
          )}
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)} className="ml-auto">
            <Trash2 className="w-4 h-4" /> Delete Document
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 bg-slate-100/80 border border-slate-200 rounded-2xl p-1.5 mb-8 overflow-x-auto shadow-inner">
        {TABS.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              tab === tabId
                ? 'bg-white text-brand-700 shadow-sm border border-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
          {[
            { label: 'File Name',     value: doc.originalName },
            { label: 'Status',        value: <StatusBadge status={doc.status} /> },
            { label: 'Size',          value: formatBytes(doc.size) },
            { label: 'MIME Type',     value: doc.mimeType },
            { label: 'Page Count',    value: doc.pageCount ?? '—' },
            { label: 'Uploaded',      value: formatDate(doc.createdAt) },
            { label: 'Last Updated',  value: formatDate(doc.updatedAt) },
            { label: 'Archived',      value: doc.archived ? 'Yes' : 'No' },
          ].map(({ label, value }) => (
            <Card key={label} className="py-5 bg-white border-slate-200">
              <p className="text-[10px] text-slate-400 uppercase tracking-[0.1em] font-extrabold mb-2 opacity-80">{label}</p>
              <div className="text-slate-900 text-sm font-bold tracking-tight">{value}</div>
            </Card>
          ))}
        </div>
      )}

      {tab === 'text' && (
        <Card className="animate-fade-in bg-white border-slate-200 p-8">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Extracted Content</h3>
            {doc.extractedText && (
              <Button variant="ghost" size="sm" onClick={() => copyText(doc.extractedText!)} className="text-brand-600 hover:bg-brand-50 font-bold">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Text'}
              </Button>
            )}
          </div>
          {!doc.extractedText ? (
            <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                <Scan className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-900 font-bold text-lg">No content extracted</p>
              <p className="text-slate-500 text-sm mt-1 mb-6">Run the OCR analysis to extract text from this document.</p>
              <Button onClick={() => ocrMutation.mutate()} isLoading={ocrMutation.isPending}>
                <Scan className="w-4 h-4 mr-1" /> Start OCR Now
              </Button>
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
              <pre className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono max-h-[60vh] overflow-y-auto">
                {doc.extractedText}
              </pre>
            </div>
          )}
        </Card>
      )}

      {tab === 'summary' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-white border-slate-200 p-8">
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Intelligence Abstract</h3>
              <Button
                size="sm" variant={doc.summary ? 'secondary' : 'primary'}
                onClick={() => summaryMutation.mutate()}
                isLoading={summaryMutation.isPending}
                disabled={!doc.extractedText}
                className={doc.summary ? 'bg-white border-slate-200' : 'shadow-lg shadow-brand-500/20'}
              >
                <Zap className="w-4 h-4" />
                {doc.summary ? 'Regenerate Abstract' : 'Generate Intelligence Abstract'}
              </Button>
            </div>
            {summaryMutation.isPending ? (
              <InlineLoader text="Synthesizing document insights with AI…" />
            ) : !doc.summary ? (
              <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                  <Zap className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-900 font-bold text-lg">No summary generated</p>
                <p className="text-slate-500 text-sm mt-1">
                  {!doc.extractedText ? 'Extraction required before summarizing' : 'Request an AI-powered executive summary for this file'}
                </p>
              </div>
            ) : (
              <div className="bg-brand-50/30 rounded-2xl p-8 border border-brand-100 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-brand-500" />
                <p className="text-slate-800 leading-loose text-lg font-medium italic">
                  "{doc.summary}"
                </p>
              </div>
            )}
            {summaryMutation.error && (
              <p className="text-red-600 font-bold text-sm mt-4 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                {getErrorMessage(summaryMutation.error)}
              </p>
            )}
          </Card>
        </div>
      )}

      {tab === 'ask' && (
        <div className="space-y-6 animate-fade-in">
          <Card className="bg-white border-slate-200 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 tracking-tight">Cognitive Query Interface</h3>
            {!doc.extractedText ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                  <MessageSquare className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-900 font-bold text-lg">Query engine disabled</p>
                <p className="text-slate-500 text-sm mt-1">Extract text from your document to start questioning it with AI.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  placeholder="e.g. Find the specific clauses related to liability and summarize the termination conditions."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={4}
                  className="bg-slate-50 border-slate-200 focus:bg-white text-lg font-medium placeholder:text-slate-400"
                  onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleAsk(); }}
                />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">Ctrl</span> + <span className="px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200">Enter</span> to query
                  </div>
                  <Button onClick={handleAsk} isLoading={isAsking} disabled={!question.trim()} size="lg" className="shadow-lg shadow-brand-500/20 px-8">
                    <Zap className="w-5 h-5 mr-1" /> Ask Cognitive Engine
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {isAsking && (
            <Card className="bg-slate-50/50 border-slate-200 shadow-sm">
              <InlineLoader text="Processing query through deep semantic indexing…" />
            </Card>
          )}

          {askError && (
            <Card className="bg-red-50 border-red-100">
              <p className="text-red-700 font-bold flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> {askError}
              </p>
            </Card>
          )}

          {answer && (
            <div className="animate-slide-up space-y-6">
              <Card className="bg-white border-2 border-brand-100 shadow-xl shadow-brand-500/10 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                   <div className="w-12 h-12 rounded-2xl bg-brand- gradient flex items-center justify-center opacity-10">
                     <Brain className="w-8 h-8 text-brand-600" />
                   </div>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/30">
                    <MessageSquare className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[11px] text-brand-600 font-extrabold uppercase tracking-[0.2em] mb-4">Deep Insight Engine Response</p>
                    <p className="text-slate-800 text-xl font-medium leading-relaxed leading-extra">{answer.answer}</p>
                  </div>
                </div>

                {answer.sources?.length > 0 && (
                  <div className="mt-10 pt-10 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                      <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-[0.2em]">
                        Verified Evidence Sources ({answer.sources.length})
                      </p>
                      <div className="h-0.5 flex-1 bg-slate-50 mx-4" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {answer.sources.map((src, i) => (
                        <div key={i} className="px-5 py-5 rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-slate-200 transition-all group">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-extrabold text-brand-600 uppercase tracking-widest bg-brand-50 px-2.5 py-1 rounded-full border border-brand-100">Source Fragment {i + 1}</span>
                            <span className="text-[10px] items-center flex gap-1 font-bold text-slate-400">confidence: {(src.score * 100).toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed line-clamp-4 italic">"{src.text}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Delete confirm */}
      <ConfirmModal
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
        title="Delete Document"
        message={`Are you sure you want to permanently delete "${doc.originalName}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
      />
    </AppLayout>
  );
}
