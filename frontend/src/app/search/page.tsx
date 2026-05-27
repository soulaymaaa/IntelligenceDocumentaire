'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, ChevronRight, Clock3, FileSearch, Plus, Search, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversationPanel } from '@/components/ai/ConversationPanel';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { searchApi, conversationsApi } from '@/lib/api';
import { formatDateShort, getErrorMessage, truncate } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';
import type { Conversation, SearchResult } from '@/types';

export default function SearchPage() {
  const { copy, language } = useLanguage();
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', 'global'],
    queryFn: () => conversationsApi.list({ scope: 'global' }),
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

  const semanticSearchMutation = useMutation({
    mutationFn: (query: string) => searchApi.semantic(query, 8),
  });

  const askMutation = useMutation({
    mutationFn: async (content: string) => {
      const conversation =
        activeConversation ||
        (await conversationsApi.create({ title: content.slice(0, 60), scope: 'global' }));

      return conversationsApi.sendMessage(conversation._id, { question: content, topK: 6, responseLanguage: language });
    },
    onSuccess: ({ conversation }) => {
      setSelectedConversationId(conversation._id);
      qc.invalidateQueries({ queryKey: ['conversations', 'global'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation._id] });
      setQuestion('');
    },
  });

  const startNewConversation = async () => {
    const conversation = await conversationsApi.create({ title: copy.documents.detail.chat.new + ' ' + (conversations.length + 1), scope: 'global' });
    setSelectedConversationId(conversation._id);
    qc.invalidateQueries({ queryKey: ['conversations', 'global'] });
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    await askMutation.mutateAsync(question);
  };

  return (
    <AppLayout>
      <div className="grid gap-8 xl:grid-cols-[320px,1fr]">
        <div className="space-y-6">
          <Card className="hero-banner border-surface-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600/80 dark:text-white/75">
                  {copy.search.workspace.title}
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {copy.search.workspace.subtitle}
                </h1>
              </div>
              <Brain className="h-10 w-10 text-brand-600 dark:text-white/80" />
            </div>
            <p className="mt-4 text-sm font-medium leading-6 text-slate-600 dark:text-white/85">
              {copy.search.workspace.description}
            </p>
          </Card>

          <Card className="border-surface-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  {copy.documents.detail.conversations}
                </p>
                <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  {copy.search.conversations.threads}
                </h2>
              </div>
              <Button size="sm" onClick={startNewConversation}>
                <Plus className="w-4 h-4" />
                {copy.documents.detail.chat.new}
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {conversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm font-medium text-slate-500">
                  {copy.search.conversations.noConversations}
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
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {truncate(conversation.title, 48)}
                      </p>
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      <Clock3 className="w-3.5 h-3.5" />
                      {formatDateShort(conversation.lastMessageAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          <Card className="border-surface-200">
            <div className="flex items-center gap-2">
              <FileSearch className="w-5 h-5 text-brand-600" />
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                {copy.search.retrieval.title}
              </h2>
            </div>
            <div className="mt-4 flex gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={copy.search.retrieval.placeholder}
                className="input-base"
              />
              <Button
                onClick={() => semanticSearchMutation.mutate(searchQuery)}
                disabled={!searchQuery.trim()}
              >
                <Search className="w-4 h-4" />
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {(semanticSearchMutation.data || []).slice(0, 4).map((result: SearchResult) => (
                <Link
                  key={result.chunkId}
                  href={`/documents/${result.documentId}`}
                  className="block rounded-2xl border border-surface-200 px-4 py-4 transition-all hover:border-brand-500/20 hover:bg-surface-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{result.documentName}</p>
                    <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-700">
                      {(result.score * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-300">
                    {truncate(result.text, 170)}
                  </p>
                </Link>
              ))}
              {semanticSearchMutation.isError && (
                <p className="text-sm font-bold text-red-600">
                  {getErrorMessage(semanticSearchMutation.error)}
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <ConversationPanel
            conversation={activeConversation || null}
            question={question}
            onQuestionChange={setQuestion}
            onSend={handleAsk}
            isSending={askMutation.isPending}
            placeholder={copy.search.chat.placeholder}
            emptyTitle={copy.search.chat.emptyTitle}
            emptyDescription={copy.search.chat.emptyDescription}
          />

          {askMutation.isError && (
            <Card className="border-red-200 bg-red-50 text-sm font-bold text-red-700">
              {getErrorMessage(askMutation.error)}
            </Card>
          )}

          <Card className="hero-banner border-surface-200">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-brand-600 dark:text-cyan-300" />
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600/80 dark:text-cyan-200/80">
                  {copy.search.footer.tag}
                </p>
                <p className="mt-1 text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {copy.search.footer.title}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
