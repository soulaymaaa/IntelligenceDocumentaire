'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound, RefreshCw } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fallbackData, setFallbackData] = useState({
    email: '',
    devCode: '',
    previewUrl: '',
    delivery: '',
  });

  const email = searchParams.get('email') || fallbackData.email || '';
  const devCode = searchParams.get('devCode') || fallbackData.devCode || '';
  const previewUrl = searchParams.get('previewUrl') || fallbackData.previewUrl || '';
  const deliveryMode = searchParams.get('delivery') || fallbackData.delivery || '';

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasRecoveredFallback, setHasRecoveredFallback] = useState(false);

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
        setError('Le code de secours n’a pas pu etre recupere automatiquement. Clique sur "Resend".');
      }
    };

    recoverMissingDevCode();
  }, [email, deliveryMode, devCode, hasRecoveredFallback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authApi.resetPassword({ email, code, newPassword });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('reset-password-fallback');
      }
      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1200);
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
          ? 'A new reset code has been sent to your email.'
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

      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-8 flex items-center justify-center">
            <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Reset password</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg font-medium leading-relaxed">
            Enter the reset code sent to <br />
            <span className="text-slate-900 dark:text-slate-100 font-bold">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {deliveryMode === 'fallback' && (
            <div className="px-4 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm font-bold leading-relaxed">
              Aucun vrai email n&apos;a ete distribue dans cet environnement de developpement.
              {devCode && (
                <div className="mt-2">
                  Code temporaire: <span className="font-extrabold tracking-[0.2em]">{devCode}</span>
                </div>
              )}
              {previewUrl && (
                <div className="mt-2">
                  Preview mail: <a href={previewUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">ouvrir le mail de test</a>
                </div>
              )}
            </div>
          )}

          <Input
            type="text"
            placeholder="Enter 6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="text-center text-3xl tracking-[0.5em] font-extrabold h-16 bg-surface-100 border-surface-200 focus:bg-card"
            maxLength={6}
            required
          />

          <Input
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            allowPasswordToggle
            minLength={8}
            required
          />

          {error && (
            <div className="px-4 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {success}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full justify-center h-14 text-lg shadow-lg shadow-brand-500/20">
            Save new password <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-sm font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Didn’t receive code? Resend'}
            </button>
          </div>
        </form>

        <div className="mt-12 pt-8 border-t border-surface-200 text-center">
          <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
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
