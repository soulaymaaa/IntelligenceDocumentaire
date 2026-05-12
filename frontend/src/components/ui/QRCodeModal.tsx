'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Smartphone, Link as LinkIcon } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '@/lib/utils';

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
  title = 'Mobile Access',
  description = 'Scan this code with your phone to open this page instantly.',
}: QRCodeModalProps) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md overflow-hidden">
      <div className="flex flex-col items-center gap-6 py-4">
        {/* QR Code Container */}
        <div className="relative group">
          <div className="absolute -inset-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative p-6 bg-white rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50">
            <QRCodeSVG
              value={url}
              size={200}
              level="H"
              includeMargin={false}
              className="rounded-lg"
              imageSettings={{
                src: "/icon.svg",
                x: undefined,
                y: undefined,
                height: 40,
                width: 40,
                excavate: true,
              }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="text-center space-y-2">
          <p className="text-slate-600 text-sm font-medium leading-relaxed max-w-[280px]">
            {description}
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-3 pt-4 border-t border-slate-100/50">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 text-xs font-mono break-all">
            <LinkIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate flex-1">{url}</span>
            <button
              onClick={copyToClipboard}
              className="p-1.5 rounded-lg hover:bg-white hover:text-brand-600 transition-all shadow-sm"
              title="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <div className="flex items-center gap-3 p-4 rounded-2xl bg-brand-50/50 border border-brand-100/50">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-600">
                   <Smartphone className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wider">iOS</span>
                   <span className="text-[10px] text-brand-600/70 font-medium">Camera App</span>
                </div>
             </div>
             <div className="flex items-center gap-3 p-4 rounded-2xl bg-cyan-50/50 border border-cyan-100/50">
                <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center text-cyan-600">
                   <Smartphone className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-cyan-700 uppercase tracking-wider">Android</span>
                   <span className="text-[10px] text-cyan-600/70 font-medium">QR Scanner</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
