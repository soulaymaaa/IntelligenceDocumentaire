'use client';

import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { QRCodeModal } from '@/components/ui/QRCodeModal';
import { useLanguage } from '@/providers/LanguageProvider';
import { cn } from '@/lib/utils';

interface QRTriggerProps {
  className?: string;
  url?: string;
  title?: string;
  description?: string;
  label?: string;
  buttonTitle?: string;
}

export const QRTrigger = ({ className, url, title, description, label, buttonTitle }: QRTriggerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { copy } = useLanguage();

  const qrUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'inline-flex items-center justify-center rounded-xl text-slate-400 transition-all active:scale-95 group hover:text-brand-500 hover:bg-brand-50 hover:shadow-sm hover:shadow-brand-500/10',
          label ? 'gap-2 px-4 py-2.5 text-sm font-semibold' : 'p-2.5',
          className
        )}
        title={buttonTitle || copy.qr.openOnMobile}
        aria-label={buttonTitle || label || copy.qr.openOnMobile}
      >
        <QrCode className="w-5 h-5 transition-transform group-hover:rotate-12" />
        {label && <span>{label}</span>}
      </button>

      <QRCodeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        url={qrUrl}
        title={title}
        description={description}
      />
    </>
  );
};
