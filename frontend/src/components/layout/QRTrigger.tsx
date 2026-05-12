'use client';

import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { QRCodeModal } from '@/components/ui/QRCodeModal';
import { cn } from '@/lib/utils';

interface QRTriggerProps {
  className?: string;
  url?: string;
  title?: string;
  description?: string;
}

export const QRTrigger = ({ className, url, title, description }: QRTriggerProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fallback to current URL if not provided
  const qrUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className={cn(
          'p-2.5 rounded-xl text-slate-400 hover:text-brand-500 hover:bg-brand-50 hover:shadow-sm hover:shadow-brand-500/10 transition-all active:scale-95 group',
          className
        )}
        title="Open on Mobile"
      >
        <QrCode className="w-5 h-5 transition-transform group-hover:rotate-12" />
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
