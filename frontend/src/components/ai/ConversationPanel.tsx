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
import { useLanguage } from '@/providers/LanguageProvider';
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
  variant?: 'default' | 'embedded';
}

const confidenceConfig = {
  high: { cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/30', label: 'Haute' },
  medium: { cls: 'bg-amber-500/10 text-amber-700 border-amber-400/30', label: 'Moyenne' },
  low: { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: 'Faible' },
};

const MessageBubble = ({ message, compact = false }: { message: ConversationMessage; compact?: boolean }) => {
  const { language } = useLanguage();
  const isUser = message.role === 'user';
  const confidenceLabels =
    language === 'fr'
      ? { high: 'Haute', medium: 'Moyenne', low: 'Faible' }
      : { high: 'High', medium: 'Medium', low: 'Low' };
  const conf = !isUser && message.confidence
    ? { ...confidenceConfig[message.confidence], label: confidenceLabels[message.confidence] }
    : null;

  return (
    <div className={cn('flex', compact ? 'gap-2' : 'gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'mt-0.5 flex shrink-0 items-center justify-center border shadow-sm',
          compact ? 'h-7 w-7 rounded-lg' : 'h-8 w-8 rounded-xl',
          isUser
            ? 'border-brand-500 bg-brand-600 text-white'
            : 'border-surface-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        )}
      >
        {isUser ? <User2 className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} /> : <Bot className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
      </div>

      <div className={cn('flex min-w-0 flex-col gap-2', compact ? 'max-w-[88%]' : 'max-w-[82%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl border shadow-sm',
            compact ? 'px-3 py-2 text-xs leading-5' : 'px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'rounded-tr-sm border-brand-500/70 bg-brand-600 text-white'
              : 'rounded-tl-sm border-surface-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && (
          <div className="flex flex-wrap items-center gap-1.5 px-1">
            {message.relevanceScore !== undefined && message.relevanceScore > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-brand-300/40 bg-brand-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-700 dark:bg-brand-950/30 dark:text-brand-300">
                <Zap className="h-2.5 w-2.5" />
                {message.relevanceScore}% {language === 'fr' ? 'pertinence' : 'relevance'}
              </span>
            )}
            {conf && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  conf.cls
                )}
              >
                <ShieldCheck className="h-2.5 w-2.5" />
                {language === 'fr' ? 'Confiance' : 'Confidence'} {conf.label}
              </span>
            )}
            <span className="text-[10px] text-slate-400">{formatDate(message.createdAt)}</span>
          </div>
        )}

        {!isUser && message.highlights && message.highlights.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            {message.highlights.slice(0, 2).map((h, i) => (
              <div
                key={i}
                className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-950/15"
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

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="grid w-full gap-2 sm:grid-cols-2">
            {message.sources.slice(0, 4).map((src, i) => (
              <div
                key={src.chunkId}
                className="rounded-xl border border-surface-200 bg-surface-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="rounded-full border border-brand-200/60 bg-brand-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-700 dark:border-brand-800/40 dark:bg-brand-950/30 dark:text-brand-400">
                    Source {i + 1}
                  </span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    {(src.score * 100).toFixed(0)}%
                  </span>
                </div>
                <Link
                  href={`/documents/${src.documentId}`}
                  className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-slate-700 transition-colors hover:text-brand-600 dark:text-slate-300 dark:hover:text-brand-400"
                >
                  <FileText className="h-3 w-3 shrink-0 text-brand-500" />
                  <span className="truncate">{src.documentName}</span>
                  <ChevronRight className="h-2.5 w-2.5 shrink-0 opacity-40" />
                </Link>
                <p className="line-clamp-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  {src.text.slice(0, 160)}...
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

const TypingIndicator = ({ compact = false }: { compact?: boolean }) => (
  <div className={cn('flex', compact ? 'gap-2' : 'gap-3')}>
    <div className={cn('flex items-center justify-center border border-surface-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800', compact ? 'h-7 w-7 rounded-lg' : 'h-8 w-8 rounded-xl')}>
      <Bot className={cn('text-slate-500', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
    </div>
    <div className={cn('rounded-2xl rounded-tl-sm border border-surface-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900', compact ? 'px-3 py-2.5' : 'px-4 py-3')}>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn('animate-bounce rounded-full bg-slate-300 dark:bg-slate-600', compact ? 'h-1.5 w-1.5' : 'h-2 w-2')}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  </div>
);

export const ConversationPanel = ({
  conversation,
  question,
  onQuestionChange,
  onSend,
  isSending,
  placeholder,
  emptyTitle,
  emptyDescription,
  variant = 'default',
}: ConversationPanelProps) => {
  const { language } = useLanguage();
  const messages = conversation?.messages || [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEmbedded = variant === 'embedded';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isSending]);

  return (
    <div
      className={cn(
        'flex min-h-0 flex-col overflow-hidden',
        isEmbedded
          ? 'h-full bg-transparent'
          : 'rounded-3xl border border-surface-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900'
      )}
      style={isEmbedded ? undefined : { minHeight: 520 }}
    >
      {!isEmbedded && (
        <div className="flex items-center justify-between gap-3 border-b border-surface-200 bg-surface-50/80 px-5 py-3.5 dark:border-slate-700 dark:bg-slate-800/60">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-brand-500/20 bg-brand-600 text-white shadow-sm">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                {conversation?.title || emptyTitle || 'Assistant IA'}
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                {language === 'fr' ? 'RAG / Sources tracees' : 'RAG / Traced sources'}
              </p>
            </div>
          </div>
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-bold">
              {language === 'fr' ? 'En ligne' : 'Online'}
            </span>
          </div>
        </div>
      )}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          isEmbedded ? 'px-4 py-4' : 'px-5 py-6',
          isEmbedded ? 'bg-transparent' : 'bg-white dark:bg-slate-900'
        )}
        style={isEmbedded ? undefined : { maxHeight: 560 }}
      >
        {messages.length === 0 && !isSending ? (
          <div className="flex min-h-full flex-col items-center justify-center text-center">
            <div
              className={cn(
                'mb-3 flex items-center justify-center border',
                isEmbedded ? 'h-11 w-11 rounded-xl' : 'h-14 w-14 rounded-2xl',
                isEmbedded
                  ? 'border-slate-700/80 bg-slate-900/60 text-slate-500'
                  : 'border-brand-200/60 bg-brand-50 text-brand-600 dark:border-brand-800/40 dark:bg-brand-950/30'
              )}
            >
              <MessageSquare className={cn(isEmbedded ? 'h-5 w-5' : 'h-6 w-6')} />
            </div>
            <p
              className={cn(
                isEmbedded ? 'text-xs font-bold' : 'text-sm font-extrabold tracking-tight',
                isEmbedded ? 'text-slate-100' : 'text-slate-800 dark:text-slate-200'
              )}
            >
              {emptyTitle || 'Commencez une conversation'}
            </p>
            <p
              className={cn(
                'mt-1.5 max-w-xs',
                isEmbedded ? 'text-xs leading-5' : 'text-sm leading-6',
                isEmbedded ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {emptyDescription ||
                'Posez une question sur vos documents. Les reponses restent ancrees sur vos sources.'}
            </p>
          </div>
        ) : (
          <div className={cn(isEmbedded ? 'space-y-3.5' : 'space-y-5')}>
            {messages.map((msg, i) => (
              <MessageBubble key={`${msg.role}-${i}`} message={msg} compact={isEmbedded} />
            ))}
            {isSending && <TypingIndicator compact={isEmbedded} />}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        className={cn(
          'border-t',
          isEmbedded
            ? 'border-white/10 bg-slate-950/90 px-3 py-3'
            : 'border-surface-200 bg-surface-50/80 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/60'
        )}
      >
        <div
          className={cn(
            'flex items-end border shadow-sm',
            isEmbedded
              ? 'gap-2 rounded-xl border-slate-800 bg-slate-900/70 p-1.5 shadow-none'
              : 'gap-3 rounded-2xl border-surface-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900'
          )}
        >
          <Textarea
            rows={2}
            value={question}
            onChange={(e) => onQuestionChange(e.target.value)}
            placeholder={placeholder || 'Posez une question sur vos documents...'}
            className={cn(
              'max-h-[160px] flex-1 resize-none border-0 bg-transparent shadow-none outline-none focus:border-transparent focus:ring-0',
              isEmbedded ? 'min-h-[42px] px-2.5 py-2 text-xs leading-5' : 'min-h-[52px] px-3 py-2 text-sm leading-relaxed',
              isEmbedded
                ? 'text-slate-100 placeholder:text-slate-500'
                : 'text-slate-900 placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500'
            )}
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
            className={cn(
              'flex shrink-0 items-center justify-center rounded-xl p-0',
              isEmbedded ? 'h-9 w-9 bg-cyan-600 text-white shadow-none hover:bg-cyan-500' : 'h-11 w-11'
            )}
            title={language === 'fr' ? 'Envoyer (Entree)' : 'Send (Enter)'}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p
          className={cn(
            'flex items-center gap-1.5 px-1 font-semibold',
            isEmbedded ? 'mt-2 text-[9px] leading-4' : 'mt-3 text-[10px]',
            isEmbedded ? 'text-slate-600' : 'text-slate-400'
          )}
        >
          <ShieldCheck className="h-3 w-3" />
          {language === 'fr'
            ? 'Entree pour envoyer / Maj+Entree pour nouvelle ligne / Sources et score inclus'
            : 'Enter to send / Shift+Enter for a new line / Sources and score included'}
        </p>
      </div>
    </div>
  );
};
