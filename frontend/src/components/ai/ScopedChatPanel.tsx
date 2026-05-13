'use client';

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn, truncate } from '@/lib/utils';
import type { Conversation } from '@/types';

const MIN_CHAT_WIDTH = 320;
const MAX_CHAT_WIDTH = 560;
const DEFAULT_CHAT_WIDTH = 380;

const clampChatWidth = (width: number) =>
  Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, width));

interface ScopedChatPanelProps {
  title: string;
  subtitle: string;
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  children: ReactNode;
  storageKey: string;
  newLabel?: string;
  className?: string;
}

export const ScopedChatPanel = ({
  title,
  subtitle,
  conversations,
  selectedConversationId,
  onSelectConversation,
  onNewConversation,
  children,
  storageKey,
  newLabel = 'New',
  className,
}: ScopedChatPanelProps) => {
  const [width, setWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [hasLoadedWidth, setHasLoadedWidth] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const widthRef = useRef(DEFAULT_CHAT_WIDTH);

  useEffect(() => {
    const storedWidth = Number(localStorage.getItem(storageKey));
    if (storedWidth) {
      const nextWidth = clampChatWidth(storedWidth);
      setWidth(nextWidth);
      widthRef.current = nextWidth;
    }
    setHasLoadedWidth(true);
  }, [storageKey]);

  useEffect(() => {
    widthRef.current = width;
    if (hasLoadedWidth) localStorage.setItem(storageKey, String(width));
  }, [hasLoadedWidth, storageKey, width]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;

    event.preventDefault();
    setIsResizing(true);

    const startX = event.clientX;
    const startWidth = widthRef.current;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const nextWidth = clampChatWidth(startWidth + startX - moveEvent.clientX);
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <aside
      className={cn(
        'group relative w-full lg:sticky lg:top-24 lg:w-[var(--chat-panel-width)]',
        className
      )}
      style={{ '--chat-panel-width': `${width}px` } as CSSProperties}
    >
      <div
        onPointerDown={startResize}
        className="absolute -left-2 top-0 z-10 hidden h-full w-4 cursor-ew-resize lg:block"
        aria-hidden="true"
      />

      <div
        className={cn(
          'flex h-[calc(100vh-150px)] min-h-[500px] flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[linear-gradient(180deg,#07101f_0%,#050916_100%)] shadow-2xl shadow-slate-950/25 transition-shadow',
          isResizing && 'shadow-cyan-950/30'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/45 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold leading-5 text-slate-50">
                {title}
              </h2>
              <p className="truncate text-[11px] font-medium leading-4 text-slate-500">
                {subtitle}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onNewConversation}
            className="h-8 shrink-0 rounded-xl border-slate-700/80 bg-slate-900/80 px-2.5 text-xs text-slate-200 shadow-none hover:border-cyan-500/40 hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {newLabel}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        {conversations.length > 1 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto border-t border-white/10 bg-slate-950/80 px-3 py-2.5">
            {conversations.map((conv) => (
              <button
                key={conv._id}
                type="button"
                onClick={() => onSelectConversation(conv._id)}
                className={cn(
                  'whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  selectedConversationId === conv._id
                    ? 'border-cyan-500/70 bg-cyan-500/15 text-cyan-100'
                    : 'border-slate-800 bg-slate-900/70 text-slate-500 hover:border-slate-700 hover:text-slate-200'
                )}
              >
                {truncate(conv.title, 20)}
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
