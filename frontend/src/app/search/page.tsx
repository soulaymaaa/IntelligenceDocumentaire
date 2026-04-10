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
import type { Conversation, SearchResult } from '@/types';

export default function SearchPage() {
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

      return conversationsApi.sendMessage(conversation._id, { question: content, topK: 6 });
    },
    onSuccess: ({ conversation }) => {
      setSelectedConversationId(conversation._id);
      qc.invalidateQueries({ queryKey: ['conversations', 'global'] });
      qc.invalidateQueries({ queryKey: ['conversation', conversation._id] });
      setQuestion('');
    },
  });

  const startNewConversation = async () => {
    const conversation = await conversationsApi.create({ title: 'New global conversation', scope: 'global' });
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
          <Card className="border-surface-200 bg-gradient-to-br from-brand-600 via-brand-500 to-cyan-500 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/75">
                  AI Workspace
                </p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
                  Semantic + Chat
                </h1>
              </div>
              <Brain className="w-10 h-10 text-white/80" />
            </div>
            <p className="mt-4 text-sm font-medium leading-6 text-white/85">
              Explore your library with semantic retrieval, then switch into a persistent conversation with citations and relevance scoring.
            </p>
          </Card>

          <Card className="border-surface-200">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">
                  Conversations
                </p>
                <h2 className="mt-2 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
                  Recent threads
                </h2>
              </div>
              <Button size="sm" onClick={startNewConversation}>
                <Plus className="w-4 h-4" />
                New
              </Button>
            </div>

            <div className="mt-5 space-y-3">
              {conversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-6 text-sm font-medium text-slate-500">
                  No global conversation yet.
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
                Quick semantic retrieval
              </h2>
            </div>
            <div className="mt-4 flex gap-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Find relevant fragments"
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
            placeholder="Ask across all indexed documents, for example: Which contracts mention termination notice periods?"
            emptyTitle="Global AI assistant"
            emptyDescription="Keep long-running research threads, inspect supporting sources, and monitor the confidence of each response."
          />

          {askMutation.isError && (
            <Card className="border-red-200 bg-red-50 text-sm font-bold text-red-700">
              {getErrorMessage(askMutation.error)}
            </Card>
          )}

          <Card className="border-surface-200 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-cyan-300" />
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-200/80">
                  What changed
                </p>
                <p className="mt-1 text-lg font-extrabold tracking-tight">
                  Persistent history, source evidence, and relevance scoring
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
