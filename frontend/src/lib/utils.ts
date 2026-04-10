import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  }).format(new Date(date));
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.substring(0, max) + '…';
}

export function getErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosErr = error as any;
    return axiosErr.response?.data?.message || axiosErr.message || 'An error occurred';
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

export function getDocumentPreviewUrl(filename?: string, pageNumber?: number): string | null {
  if (!filename) return null;
  const base = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/uploads/${filename}`;
  return pageNumber ? `${base}#page=${pageNumber}` : base;
}

export function highlightText(text: string, terms: string[]): string {
  if (!terms.length) return text;

  const escapedTerms = terms
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (!escapedTerms.length) return text;

  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  return text.replace(regex, '<mark class="rounded bg-amber-200/80 px-1 text-slate-900">$1</mark>');
}
