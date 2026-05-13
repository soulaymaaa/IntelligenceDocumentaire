'use client';

import { useState } from 'react';
import Link from 'next/link';
<<<<<<< HEAD
import { FileText, Image, Calendar, HardDrive, Trash2, Archive, Undo2, MessageSquareText, FolderInput, X, Pencil, Check, Presentation, FileSpreadsheet } from 'lucide-react';
import { cn, formatBytes, formatDateShort, truncate } from '@/lib/utils';
import { StatusBadge } from '@/components/ui/Badge';
import type { Document, Dossier } from '@/types';

interface DocumentCardProps {
  document: Document;
  dossiers?: Dossier[];
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onRename?: (id: string, newName: string) => Promise<void>;
  onMove?: (id: string, dossierId: string | null) => void;
}

const mimeIcon = (mime: string, filename: string) => {
  const m = mime?.toLowerCase() || '';
  const f = filename?.toLowerCase() || '';

  if (m.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
  if (m.includes('word') || f.endsWith('.docx') || f.endsWith('.doc')) return <FileText className="w-5 h-5 text-blue-500" />;
  if (m.includes('spreadsheet') || m.includes('excel') || f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv')) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  if (m.includes('presentation') || m.includes('powerpoint') || f.endsWith('.pptx') || f.endsWith('.ppt')) return <Presentation className="w-5 h-5 text-orange-500" />;
  if (m.includes('image')) return <Image className="w-5 h-5 text-purple-500" />;
  
  return <FileText className="w-5 h-5 text-slate-400" />;
};

export const DocumentCard = ({ 
  document: doc, 
  dossiers = [], 
  onDelete, 
  onArchive, 
  onRestore, 
  onRename,
  onMove 
}: DocumentCardProps) => {
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newName, setNewName] = useState(doc.originalName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDossier = dossiers.find((d) => d._id === doc.dossierId || d._id === doc.folderId);

  const handleRename = async () => {
    if (!onRename || newName.trim() === '' || newName === doc.originalName) {
      setIsEditing(false);
      setNewName(doc.originalName);
      return;
    }

    setIsSubmitting(true);
    try {
      await onRename(doc._id, newName.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to rename document:', error);
      setNewName(doc.originalName);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setNewName(doc.originalName);
    }
  };

  return (
    <div className={cn(
      'group bg-white rounded-2xl p-5 shadow-sm border border-slate-200 relative',
      'hover:shadow-md hover:border-brand-200 hover:translate-y-[-2px] transition-all duration-300',
    )}>
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-inner group-hover:bg-brand-50 transition-colors">
          {mimeIcon(doc.mimeType, doc.originalName)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            {isEditing ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
                />
                <button
                  onClick={handleRename}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setIsEditing(false); setNewName(doc.originalName); }}
                  disabled={isSubmitting}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href={`/documents/${doc._id}`}
                className="text-slate-900 font-bold text-sm leading-snug hover:text-brand-600 transition-colors line-clamp-2"
              >
                {doc.originalName}
              </Link>
            )}

            {/* Action menu */}
            <div className={cn(
              "flex items-center gap-1.5 shrink-0 transition-opacity",
              isEditing ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
            )}>
              {onRename && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all border border-transparent hover:border-brand-100"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
              {onMove && (
                <button
                  onClick={() => setShowFolderPicker((v) => !v)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-all border border-transparent hover:border-brand-100"
                  title="Move to dossier"
                >
                  <FolderInput className="w-4 h-4" />
                </button>
              )}
              {!doc.archived && onArchive && (
                <button
                  onClick={() => onArchive(doc._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-all border border-transparent hover:border-amber-100"
                  title="Archive"
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {doc.archived && onRestore && (
                <button
                  onClick={() => onRestore(doc._id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100"
                  title="Restore"
                >
                  <Undo2 className="w-4 h-4" />
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
            {currentDossier && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: currentDossier.color + '22', color: currentDossier.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentDossier.color }} />
                {currentDossier.name}
              </span>
            )}
          </div>

          {/* Summary preview */}
          {doc.summary && (
            <div className="mt-3.5 p-3 rounded-xl bg-slate-50/80 border border-slate-100/50">
              <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed italic">
                "{truncate(doc.summary, 120)}"
              </p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              {doc.archived ? 'Archived' : 'Active'}
            </span>
            <Link
              href={`/documents/${doc._id}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 transition-colors hover:text-brand-700"
            >
              <MessageSquareText className="w-3.5 h-3.5" />
              Open workspace
            </Link>
          </div>
        </div>
      </div>

      {/* Folder picker dropdown */}
      {showFolderPicker && onMove && (
        <div className="absolute right-4 top-12 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-2 min-w-[160px]">
          <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-slate-100 dark:border-slate-700">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Dossier</span>
            <button onClick={() => setShowFolderPicker(false)} className="text-slate-300 hover:text-slate-500">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {(doc.dossierId || doc.folderId) && (
            <button
              onClick={() => { onMove(doc._id, null); setShowFolderPicker(false); }}
              className="w-full text-left px-2.5 py-1.5 text-xs rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              Remove from dossier
            </button>
          )}
          {dossiers.map((d) => (
            <button
              key={d._id}
              onClick={() => { onMove(doc._id, d._id); setShowFolderPicker(false); }}
              className={cn(
                'w-full text-left px-2.5 py-1.5 text-xs rounded-lg flex items-center gap-2 transition-colors',
                (doc.dossierId === d._id || doc.folderId === d._id)
                  ? 'font-bold text-brand-600 bg-brand-50'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.name}</span>
            </button>
          ))}
          {dossiers.length === 0 && (
            <p className="px-2.5 py-1.5 text-[11px] text-slate-400 italic">No dossiers yet</p>
          )}
        </div>
      )}
    </div>
  );
};
