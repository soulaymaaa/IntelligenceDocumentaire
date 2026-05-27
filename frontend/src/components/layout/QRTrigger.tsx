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
}

export const QRTrigger = ({ className, url, title, description }: QRTriggerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { copy } = useLanguage();

  const qrUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'rounded-xl p-2.5 text-slate-500 transition-all hover:bg-brand-50 hover:text-brand-600 hover:shadow-sm active:scale-95 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-400',
          className
        )}
        title={copy.qr.openOnMobile}
        aria-label={copy.qr.openOnMobile}
      >
        <QrCode className="h-5 w-5" />
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
