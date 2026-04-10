'use client';

import Link from 'next/link';
import { Bot, ChevronRight, FileText, MessageSquare, Send, ShieldCheck, Sparkles, User2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Input';
import { cn, formatDate, highlightText } from '@/lib/utils';
import type { Conversation, ConversationMessage } from '@/types';

interface ConversationPanelProps {
  conversation: Conversation | null;
  question: string;
  onQuestionChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  placeholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

const confidenceClasses = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  low: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const MessageBubble = ({ message }: { message: ConversationMessage }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn('flex gap-4', isAssistant ? 'items-start' : 'items-start flex-row-reverse')}>
      <div
        className={cn(
          'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border',
          isAssistant
            ? 'bg-brand-600 text-white border-brand-500'
            : 'bg-surface-100 text-slate-700 border-surface-200'
        )}
      >
        {isAssistant ? <Bot className="w-5 h-5" /> : <User2 className="w-5 h-5" />}
      </div>

      <div className={cn('max-w-[85%] space-y-4', isAssistant ? '' : 'items-end')}>
        <div
          className={cn(
            'rounded-3xl border px-5 py-4 shadow-sm',
            isAssistant
              ? 'bg-white dark:bg-slate-900 border-surface-200'
              : 'bg-brand-600 text-white border-brand-500/70'
          )}
        >
          <p className={cn('text-sm leading-7 whitespace-pre-wrap', isAssistant ? 'text-slate-700 dark:text-slate-200' : 'text-white')}>
            {message.content}
          </p>
        </div>

        {isAssistant && (message.relevanceScore !== undefined || message.confidence) && (
          <div className="flex flex-wrap gap-2">
            {message.relevanceScore !== undefined && (
              <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
                Relevance {message.relevanceScore}%
              </span>
            )}
            {message.confidence && (
              <span className={cn('rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest', confidenceClasses[message.confidence])}>
                Confidence {message.confidence}
              </span>
            )}
            <span className="rounded-full border border-surface-200 bg-surface-100 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              {formatDate(message.createdAt)}
            </span>
          </div>
        )}

        {isAssistant && message.highlights && message.highlights.length > 0 && (
          <div className="grid gap-3">
            {message.highlights.slice(0, 3).map((highlight, index) => (
              <div key={`${highlight.sourceIndex}-${index}`} className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm text-slate-700">
                <p
                  className="leading-6"
                  dangerouslySetInnerHTML={{ __html: highlightText(highlight.snippet, highlight.matchedTerms) }}
                />
              </div>
            ))}
          </div>
        )}

        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {message.sources.slice(0, 4).map((source, index) => (
              <Card key={`${source.chunkId}-${index}`} className="p-4 border-surface-200">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <span className="rounded-full border border-brand-500/20 bg-brand-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-700 dark:text-brand-300">
                    Source {index + 1}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Score {(source.score * 100).toFixed(1)}%
                  </span>
                </div>
                <Link
                  href={`/documents/${source.documentId}`}
                  className="mb-2 inline-flex items-center gap-1.5 text-sm font-bold text-slate-800 transition-colors hover:text-brand-600 dark:text-slate-100"
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate">{source.documentName}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                </Link>
                <p className="text-xs leading-6 text-slate-600 dark:text-slate-300">
                  {source.text.slice(0, 220)}
                  {source.text.length > 220 ? '...' : ''}
                </p>
                {source.pageNumber && (
                  <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                    Page {source.pageNumber}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export const ConversationPanel = ({
  conversation,
  question,
  onQuestionChange,
  onSend,
  isSending,
  placeholder,
  emptyTitle,
  emptyDescription,
}: ConversationPanelProps) => {
  const messages = conversation?.messages || [];

  return (
    <div className="space-y-5">
      <Card className="border-surface-200 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
              Conversational RAG
            </p>
            <h3 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {conversation?.title || emptyTitle || 'Start an intelligent conversation'}
            </h3>
            <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
              {emptyDescription || 'Ask questions naturally, keep the history, and inspect the evidence used by the model.'}
            </p>
          </div>
          <div className="hidden rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-600 dark:block">
            <Sparkles className="w-6 h-6" />
          </div>
        </div>

        <div className="mt-5">
          <Textarea
            rows={4}
            value={question}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder={placeholder || 'Ask a question about your documents'}
            className="bg-surface-50 dark:bg-slate-950/40"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                onSend();
              }
            }}
          />
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              Sources tracees et score de pertinence inclus
            </div>
            <Button onClick={onSend} isLoading={isSending} disabled={!question.trim()} size="lg">
              <Send className="w-4 h-4" />
              Send
            </Button>
          </div>
        </div>
      </Card>

      {!messages.length ? (
        <Card className="border-dashed border-surface-200 bg-gradient-to-br from-surface-50 via-white to-brand-50/40 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-brand-500/20 bg-brand-500/10 text-brand-600">
            <MessageSquare className="w-8 h-8" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">
            No messages yet
          </p>
          <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            The first response will create the conversation history automatically.
          </p>
        </Card>
      ) : (
        <div className="space-y-5">
          {messages.map((message, index) => (
            <MessageBubble key={`${message.role}-${message.createdAt}-${index}`} message={message} />
          ))}
        </div>
      )}
    </div>
  );
};
