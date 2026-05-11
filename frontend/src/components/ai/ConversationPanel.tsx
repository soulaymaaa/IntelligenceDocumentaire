'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Bot,
  ChevronRight,
  FileText,
  MessageSquare,
  Send,
  ShieldCheck,
  Sparkles,
  User2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
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

const confidenceConfig = {
  high: { cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30', label: 'Haute' },
  medium: { cls: 'bg-amber-500/10 text-amber-700 border-amber-400/30', label: 'Moyenne' },
  low: { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Faible' },
};

// ── Single message bubble ─────────────────────────────────────────────────────

const MessageBubble = ({ message }: { message: ConversationMessage }) => {
  const isUser = message.role === 'user';
  const conf = !isUser && message.confidence ? confidenceConfig[message.confidence] : null;

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-sm',
          isUser
            ? 'bg-brand-600 text-white border-brand-500'
            : 'bg-white text-slate-600 border-surface-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
        )}
      >
        {isUser ? <User2 className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className={cn('flex min-w-0 max-w-[82%] flex-col gap-2', isUser && 'items-end')}>
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 shadow-sm text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm bg-brand-600 text-white border-brand-500/70'
              : 'rounded-tl-sm bg-white dark:bg-slate-900 border-surface-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Metadata — assistant only */}
        {!isUser && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {message.relevanceScore !== undefined && message.relevanceScore > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-300/40 bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                <Zap className="w-2.5 h-2.5" />
                {message.relevanceScore}% pertinence
              </span>
            )}
            {conf && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  conf.cls
                )}
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                Confiance {conf.label}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{formatDate(message.createdAt)}</span>
          </div>
        )}

        {/* Highlighted passages */}
        {!isUser && message.highlights && message.highlights.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.highlights.slice(0, 2).map((h, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200/80 bg-amber-50/60 dark:bg-amber-950/15 dark:border-amber-800/30 px-3 py-2"
              >
                <p
                  className="text-xs leading-5 text-slate-600 dark:text-slate-400"
                  dangerouslySetInnerHTML={{
                    __html: highlightText(h.snippet, h.matchedTerms),
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Source cards */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {message.sources.slice(0, 4).map((src, i) => (
              <div
                key={src.chunkId}
                className="rounded-xl border border-surface-200 dark:border-slate-700 bg-surface-50/80 dark:bg-slate-800/50 p-3"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="rounded-full bg-brand-50 dark:bg-brand-950/30 border border-brand-200/60 dark:border-brand-800/40 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-700 dark:text-brand-400">
                    Source {i + 1}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {(src.score * 100).toFixed(0)}%
                  </span>
                </div>
                <Link
                  href={`/documents/${src.documentId}`}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400 mb-1.5 transition-colors"
                >
                  <FileText className="w-3 h-3 shrink-0 text-brand-500" />
                  <span className="truncate">{src.documentName}</span>
                  <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-40" />
                </Link>
                <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400 line-clamp-3">
                  {src.text.slice(0, 160)}…
                </p>
                {src.pageNumber && (
                  <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    p. {src.pageNumber}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator = () => (
  <div className="flex gap-3">
    <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-surface-200 bg-white shadow-sm dark:bg-slate-800 dark:border-slate-700">
      <Bot className="w-4 h-4 text-slate-500" />
    </div>
    <div className="rounded-2xl rounded-tl-sm border border-surface-200 bg-white dark:bg-slate-900 dark:border-slate-700 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── Main panel ────────────────────────────────────────────────────────────────

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
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  return (
    <div className="flex flex-col rounded-2xl border border-surface-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden" style={{ minHeight: 520 }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3 border-b border-surface-200 dark:border-slate-700 bg-surface-50/80 dark:bg-slate-800/60 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-none">
              {conversation?.title || emptyTitle || 'Assistant IA'}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              RAG · Sources tracées
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-slate-400">En ligne</span>
        </div>
      </div>

      {/* ── Messages area ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5" style={{ maxHeight: 560 }}>
        {messages.length === 0 && !isSending ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-200/60 bg-brand-50 dark:bg-brand-950/30 dark:border-brand-800/40 text-brand-600">
              <MessageSquare className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {emptyTitle || 'Commencez une conversation'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                {emptyDescription ||
                  'Posez une question sur vos documents — les réponses sont ancrées sur vos sources.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.role}-${i}`} message={msg} />
            ))}
            {isSending && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area (always at the bottom) ── */}
      <div className="border-t border-surface-200 dark:border-slate-700 bg-surface-50/80 dark:bg-slate-800/60 px-4 py-4">
        <div className="flex gap-3 items-end">
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={placeholder || 'Posez une question sur vos documents…'}
            className="flex-1 resize-none bg-white dark:bg-slate-900 text-sm leading-relaxed min-h-[52px] max-h-[160px]"
            style={{ height: 'auto' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey) {
                e.preventDefault();
                if (question.trim() && !isSending) onSend();
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (question.trim() && !isSending) onSend();
              }
            }}
          />
          <Button
            onClick={onSend}
            isLoading={isSending}
            disabled={!question.trim() || isSending}
            className="h-10 w-10 shrink-0 rounded-xl p-0 flex items-center justify-center"
            title="Envoyer (Entrée)"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="mt-2 text-[10px] font-medium text-slate-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3" />
          Entrée pour envoyer · Maj+Entrée pour nouvelle ligne · Sources et score inclus
        </p>
      </div>
    </div>
  );
};
