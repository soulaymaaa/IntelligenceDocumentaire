'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, ArrowRight, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import Link from 'next/link';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { verify } = useAuth();
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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [hasRecoveredFallback, setHasRecoveredFallback] = useState(false);

  const handleAlreadyVerified = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('verify-email-fallback');
    }
    setError('');
    setSuccess('This email is already verified. Redirecting you to login...');
    setTimeout(() => router.push(`/login?email=${encodeURIComponent(email)}`), 1200);
  };

  useEffect(() => {
    if (!email) {
      router.push('/register');
    }
  }, [email, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('verify-email-fallback');
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
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    const recoverMissingDevCode = async () => {
      if (!email || deliveryMode !== 'fallback' || devCode || hasRecoveredFallback) return;

      setHasRecoveredFallback(true);
      try {
        const result = await authApi.resendVerification(email);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            'verify-email-fallback',
            JSON.stringify({
              email,
              devCode: result.devVerificationCode || '',
              previewUrl: result.emailPreviewUrl || '',
              delivery: result.deliveredToInbox ? '' : 'fallback',
            })
          );
        }
        setFallbackData({
          email,
          devCode: result.devVerificationCode || '',
          previewUrl: result.emailPreviewUrl || '',
          delivery: result.deliveredToInbox ? '' : 'fallback',
        });
        if (result.devVerificationCode) {
          setSuccess(`Temporary code recovered automatically: ${result.devVerificationCode}`);
          setResendCooldown(60);
        }
      } catch (err) {
        const message = getErrorMessage(err).toLowerCase();
        if (message.includes('already verified')) {
          handleAlreadyVerified();
          return;
        }
        setError('Unable to recover the fallback code automatically. Click "Resend".');
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

    setError('');
    setIsLoading(true);
    try {
      await verify(email, code);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('verify-email-fallback');
      }
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.toLowerCase().includes('already verified')) {
        handleAlreadyVerified();
        return;
      }
      setError(message);
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setError('');
    setSuccess('');
    setIsResending(true);
    try {
      const result = await authApi.resendVerification(email);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(
          'verify-email-fallback',
          JSON.stringify({
            email,
            devCode: result.devVerificationCode || '',
            previewUrl: result.emailPreviewUrl || '',
            delivery: result.deliveredToInbox ? '' : 'fallback',
          })
        );
      }
      setFallbackData({
        email,
        devCode: result.devVerificationCode || '',
        previewUrl: result.emailPreviewUrl || '',
        delivery: result.deliveredToInbox ? '' : 'fallback',
      });
      setSuccess(
        result.deliveredToInbox
          ? 'A new verification code has been sent to your email.'
          : `Email delivery fallback is active in development. Your new code is: ${result.devVerificationCode || 'check backend logs'}.`
      );
      setResendCooldown(60);
    } catch (err) {
      const message = getErrorMessage(err);
      if (message.toLowerCase().includes('already verified')) {
        handleAlreadyVerified();
        return;
      }
      setError(message);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-8 relative overflow-hidden transition-colors">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-8 flex items-center justify-center">
            <Mail className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Verify email</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg font-medium leading-relaxed">
            We&apos;ve sent a 6-digit verification code to <br />
            <span className="text-slate-900 dark:text-slate-100 font-bold">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {deliveryMode === 'fallback' && (
            <div className="px-4 py-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-300 text-sm font-bold leading-relaxed">
              No real email was delivered in this development environment.
              {devCode && (
                <div className="mt-2">
                  Temporary code: <span className="font-extrabold tracking-[0.2em]">{devCode}</span>
                </div>
              )}
              {previewUrl && (
                <div className="mt-2">
                  Preview email: <a href={previewUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">open test mail</a>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="text-center text-3xl tracking-[0.5em] font-extrabold h-16 bg-surface-100 border-surface-200 focus:bg-card"
              required
              maxLength={6}
              autoFocus
            />
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
              The code will expire in 15 minutes
            </p>
          </div>

          {error && (
            <div className="px-4 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center gap-3 animate-shake">
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          {success && (
            <div className="px-4 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {success}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full justify-center h-14 text-lg shadow-lg shadow-brand-500/20">
            Verify & Continue <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldown > 0}
              className="text-sm font-bold text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Didn\'t receive code? Resend'}
            </button>
          </div>
        </form>

        <div className="mt-12 pt-8 border-t border-surface-200 text-center">
          <Link href="/register" className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            Wrong email address? Go back
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailContent />
    </Suspense>
  );
}
