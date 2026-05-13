'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Link as LinkIcon, Smartphone } from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '@/providers/LanguageProvider';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  description?: string;
}

export const QRCodeModal = ({
  isOpen,
  onClose,
  url,
  title,
  description,
}: QRCodeModalProps) => {
  const { copy } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const modalTitle = title ?? copy.qr.title;
  const modalDescription = description ?? copy.qr.description;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!mounted) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle} className="max-w-md">
      <div className="flex flex-col items-center gap-5 py-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/40 dark:border-slate-700 dark:bg-white dark:shadow-black/20">
          <QRCodeSVG
            value={url}
            size={220}
            level="H"
            includeMargin
            bgColor="#ffffff"
            fgColor="#0f172a"
            className="rounded-lg"
          />
        </div>

        <p className="text-center text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-300 max-w-[300px]">
          {modalDescription}
        </p>

        <div className="w-full space-y-3 border-t border-surface-200 pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 text-xs font-mono text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            <LinkIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{url}</span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-all hover:bg-white hover:text-brand-600 dark:hover:bg-slate-700"
              title={copy.qr.copyLink}
              aria-label={copy.qr.copyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="space-y-2 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/5">
            <p className="flex items-start gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
              {copy.qr.helpScan}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{copy.qr.helpOpen}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};
