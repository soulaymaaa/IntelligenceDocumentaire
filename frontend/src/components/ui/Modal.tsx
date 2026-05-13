'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal = ({ isOpen, onClose, title, children, className }: ModalProps) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm dark:bg-slate-950/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          'relative glass w-full max-w-lg animate-slide-up rounded-2xl border border-surface-200 shadow-xl',
          className
        )}
      >
        <div className="flex items-center justify-between border-b border-surface-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-all hover:bg-surface-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-9rem)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  isLoading?: boolean;
  danger?: boolean;
}

export const ConfirmModal = ({
  isOpen, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', isLoading, danger = false,
}: ConfirmModalProps) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} className="max-w-md">
    <p className="mb-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{message}</p>
    <div className="flex justify-end gap-3">
      <Button variant="secondary" onClick={onClose} disabled={isLoading}>
        Cancel
      </Button>
      <Button
        variant={danger ? 'danger' : 'primary'}
        onClick={onConfirm}
        isLoading={isLoading}
      >
        {confirmLabel}
      </Button>
    </div>
  </Modal>
);
