'use client';

import Link from 'next/link';
import { FileText, Image, Calendar, HardDrive, MoreVertical, Trash2, Archive } from 'lucide-react';
import { cn, formatBytes, formatDateShort, truncate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import type { Document } from '@/types';

interface DocumentCardProps {
  document: Document;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}

const mimeIcon = (mime: string) => {
  if (mime === 'application/pdf') return <FileText className="w-5 h-5 text-red-400" />;
  return <Image className="w-5 h-5 text-blue-400" />;
};

export const DocumentCard = ({ document: doc, onDelete, onArchive }: DocumentCardProps) => {
  return (
    <div className={cn(
      'group bg-white rounded-2xl p-5 shadow-sm border border-slate-200',
      'hover:shadow-md hover:border-brand-200 hover:translate-y-[-2px] transition-all duration-300',
    )}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-brand-50 transition-colors">
          {mimeIcon(doc.mimeType)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/documents/${doc._id}`}
              className="text-slate-900 font-bold text-sm leading-snug hover:text-brand-600 transition-colors line-clamp-2"
            >
              {doc.originalName}
            </Link>

            {/* Action menu */}
            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!doc.archived && onArchive && (
                <button
                  onClick={() => onArchive(doc._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all border border-transparent hover:border-amber-100"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(doc._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center flex-wrap gap-4 mt-3">
            <StatusBadge status={doc.status} />
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <HardDrive className="w-3.5 h-3.5 opacity-70" />
              {formatBytes(doc.size)}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-tight">
              <Calendar className="w-3.5 h-3.5 opacity-70" />
              {formatDateShort(doc.createdAt)}
            </span>
          </div>

          {/* Summary preview */}
          {doc.summary && (
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed italic">
                "{truncate(doc.summary, 120)}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
