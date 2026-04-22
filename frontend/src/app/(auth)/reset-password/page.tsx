'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, RefreshCw } from 'lucide-react';
import { authApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';

function ResetPasswordContent() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const { copy } = useLanguage();
  const [fallbackData, setFallbackData] = useState({
    email: '',
    devCode: '',
    previewUrl: '',
    delivery: '',
  });
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasRecoveredFallback, setHasRecoveredFallback] = useState(false);

  const email = searchParams.get('email') || fallbackData.email || '';
  const devCode = searchParams.get('devCode') || fallbackData.devCode || '';
  const previewUrl = searchParams.get('previewUrl') || fallbackData.previewUrl || '';
  const deliveryMode = searchParams.get('delivery') || fallbackData.delivery || '';

  useEffect(() => {
    if (!email) router.push('/forgot-password');
  }, [email, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('reset-password-fallback');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setFallbackData({
        email: parsed.email || '',
        devCode: parsed.devCode || '',
        previewUrl: parsed.previewUrl || '',
        delivery: parsed.delivery || '',
      });
    } catch {
      setFallbackData({ email: '', devCode: '', previewUrl: '', delivery: '' });
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const recoverMissingDevCode = async () => {
      if (!email || deliveryMode !== 'fallback' || devCode || hasRecoveredFallback) return;

      setHasRecoveredFallback(true);
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
        setFallbackData({
          email,
          devCode: result.devResetCode || '',
          previewUrl: result.emailPreviewUrl || '',
          delivery: result.deliveredToInbox ? '' : 'fallback',
        });
        if (result.devResetCode) {
          setSuccess(`Code temporaire recupere automatiquement: ${result.devResetCode}`);
          setResendCooldown(60);
        }
      } catch {
        setError('Le code de secours n a pas pu etre recupere automatiquement. Clique sur "Resend".');
      }
    };

    recoverMissingDevCode();
  }, [email, deliveryMode, devCode, hasRecoveredFallback]);

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authApi.verifyResetCode({ email, code });
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verified-reset-session', JSON.stringify({ email, code }));
      }
      setSuccess('Code verified successfully. Redirecting...');
      setTimeout(() => router.push(`/reset-password/options?email=${encodeURIComponent(email)}`), 800);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setSuccess('');
    setIsResending(true);

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
      setFallbackData({
        email,
        devCode: result.devResetCode || '',
        previewUrl: result.emailPreviewUrl || '',
        delivery: result.deliveredToInbox ? '' : 'fallback',
      });
      setSuccess(
        result.deliveredToInbox
          ? 'A new verification code has been sent to your email.'
          : `Email delivery fallback active in development. Your new reset code is: ${result.devResetCode || 'check backend logs'}.`
      );
      setResendCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-8 relative overflow-hidden transition-colors">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />

      <div className="absolute top-8 right-8 flex items-center gap-3">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20">
            <KeyRound className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Verify reset code
          </h1>
          <p className="mt-4 text-lg font-medium leading-relaxed text-slate-500 dark:text-slate-400">
            Enter the code sent to <br />
            <span className="font-bold text-slate-900 dark:text-slate-100">{email}</span>
          </p>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-6">
          {deliveryMode === 'fallback' && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-bold leading-relaxed text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              Aucun vrai email n&apos;a ete distribue dans cet environnement de developpement.
              {devCode && (
                <div className="mt-2">
                  Code temporaire: <span className="font-extrabold tracking-[0.2em]">{devCode}</span>
                </div>
              )}
              {previewUrl && (
                <div className="mt-2">
                  Preview mail:{' '}
                  <a href={previewUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    ouvrir le mail de test
                  </a>
                </div>
              )}
            </div>
          )}

          <Input
            type="text"
            placeholder={copy.auth.enter6DigitCode}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-3xl tracking-[0.5em] font-extrabold h-16 bg-surface-100 border-surface-200 focus:bg-card"
            required
            maxLength={6}
            autoFocus
          />

          <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500">
            {copy.auth.codeExpires}
          </p>

          {error && (
            <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-sm font-bold text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {success}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="h-14 w-full justify-center text-lg shadow-lg shadow-brand-500/20">
            Verify code <ArrowRight className="ml-2 h-5 w-5" />
          </Button>

          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="group inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-brand-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-brand-400"
            >
              <RefreshCw className={`h-4 w-4 ${isResending ? 'animate-spin' : 'transition-transform duration-500 group-hover:rotate-180'}`} />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Didn't receive code? Resend"}
            </button>
          </div>
        </form>

        <div className="mt-12 border-t border-surface-200 pt-8 text-center">
          <Link href="/login" className="text-sm font-bold text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
