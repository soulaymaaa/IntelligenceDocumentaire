'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { documentsApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

interface UploadZoneProps {
  onUploadComplete?: () => void;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

export const UploadZone = ({ onUploadComplete }: UploadZoneProps) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    const newFiles: UploadFile[] = accepted.map((f) => ({
      file: f,
      id: Math.random().toString(36).slice(2),
      status: 'pending',
      progress: 0,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    if (rejected.length > 0) {
      console.warn('Rejected files:', rejected);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadAll = async () => {
    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) return;

    setIsUploading(true);
    try {
      // Upload all pending files at once
      const fileObjs = pending.map((f) => f.file);

      // Mark as uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'pending' ? { ...f, status: 'uploading' } : f
        )
      );

      await documentsApi.upload(fileObjs, (progress) => {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'uploading' ? { ...f, progress } : f
          )
        );
      });

      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading' ? { ...f, status: 'done', progress: 100 } : f
        )
      );

      onUploadComplete?.();

      // Clear done files after a delay
      setTimeout(() => {
        setFiles((prev) => prev.filter((f) => f.status !== 'done'));
      }, 2000);

    } catch (err) {
      setFiles((prev) =>
        prev.map((f) =>
          f.status === 'uploading'
            ? { ...f, status: 'error', error: getErrorMessage(err) }
            : f
        )
      );
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 group',
          isDragActive
            ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 scale-[1.01]'
            : 'border-slate-200 bg-slate-50 hover:border-brand-400 hover:bg-white hover:shadow-md'
        )}
      >
        <input {...getInputProps()} />
        <div className={cn(
          'flex flex-col items-center gap-5 transition-transform duration-300',
          isDragActive && 'scale-105'
        )}>
          <div className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-sm border',
            isDragActive ? 'bg-brand-500 text-white border-brand-400' : 'bg-white text-slate-400 border-slate-100 group-hover:text-brand-500 group-hover:border-brand-200'
          )}>
            <Upload className={cn('w-10 h-10', isDragActive ? 'animate-bounce' : '')} />
          </div>
          <div>
            <p className="text-slate-900 font-extrabold text-xl tracking-tight">
              {isDragActive ? 'Drop your files now' : 'Select files to analyze'}
            </p>
            <p className="text-slate-500 text-sm mt-2 font-medium">
              Drag and drop your documents here or <span className="text-brand-600 font-bold decoration-2 underline-offset-4 hover:underline">browse files</span>
            </p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-extrabold tracking-widest uppercase">
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 shadow-sm">PDF</span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 shadow-sm">JPG</span>
            <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-500 shadow-sm">PNG</span>
            <span className="text-slate-400 ml-2 font-bold lowercase tracking-normal">Max 50 MB per file</span>
          </div>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-3 mt-6">
          <div className="flex items-center justify-between px-1">
             <p className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Queue ({files.length})</p>
             <button onClick={() => setFiles([])} className="text-[10px] font-extrabold text-red-500 hover:text-red-700 uppercase tracking-widest">Clear All</button>
          </div>
          {files.map((uf) => (
            <div
              key={uf.id}
              className={cn(
                'flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm transition-all animate-fade-in',
                uf.status === 'error' && 'border-red-200 bg-red-50/30',
                uf.status === 'done' && 'border-emerald-200 bg-emerald-50/30'
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                uf.status === 'done' ? 'bg-emerald-100 text-emerald-600' : 
                uf.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
              )}>
                <File className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                   <p className="text-sm text-slate-900 truncate font-bold">{uf.file.name}</p>
                   <span className="text-[10px] font-extrabold text-slate-400 tabular-nums">{formatBytes(uf.file.size)}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {uf.status === 'uploading' && (
                    <div className="flex-1 flex items-center gap-3">
                       <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.5)]"
                            style={{ width: `${uf.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-brand-600 tabular-nums">{uf.progress}%</span>
                    </div>
                  )}
                  {uf.error && <span className="text-xs text-red-600 font-bold flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {uf.error}</span>}
                  {uf.status === 'done' && <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Success</span>}
                  {uf.status === 'pending' && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ready to upload</span>}
                </div>
              </div>
              <div className="shrink-0 ml-2">
                {uf.status === 'pending' && (
                  <button onClick={() => removeFile(uf.id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                )}
                {uf.status === 'uploading' && <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />}
                {uf.status === 'done' && <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600"><CheckCircle className="w-5 h-5" /></div>}
                {uf.status === 'error' && <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600"><AlertCircle className="w-5 h-5" /></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pendingCount > 0 && (
        <Button onClick={uploadAll} isLoading={isUploading} className="w-full justify-center">
          <Upload className="w-4 h-4" />
          Upload {pendingCount} file{pendingCount !== 1 ? 's' : ''}
        </Button>
      )}
    </div>
  );
};
