'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, KeyRound, Mail } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useRouter } from 'next/navigation';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const result = await authApi.forgotPassword(email);

      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          'reset-password-fallback',
          JSON.stringify({
            email,
            devCode: result.devResetCode || '',
            previewUrl: result.emailPreviewUrl || '',
            delivery: result.deliveredToInbox ? '' : 'fallback',
          })
        );
      }

      const params = new URLSearchParams({ email });
      if (result.devResetCode) params.set('devCode', result.devResetCode);
      if (result.emailPreviewUrl) params.set('previewUrl', result.emailPreviewUrl);
      if (!result.deliveredToInbox) params.set('delivery', 'fallback');

      router.push(`/reset-password?${params.toString()}`);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-8 relative overflow-hidden transition-colors">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-8 flex items-center justify-center">
            <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Forgot password</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg font-medium leading-relaxed">
            Enter your email and we&apos;ll send you a reset code.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            required
          />

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold">
              {success}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full justify-center h-12 text-base">
            Send reset code <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        </form>

        <p className="mt-8 text-center text-sm font-bold text-slate-500">
          Remembered your password?{' '}
          <Link href="/login" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold transition-colors">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
