'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, KeyRound, LogIn, LockKeyhole } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { getErrorMessage } from '@/lib/utils';
import { useLanguage } from '@/providers/LanguageProvider';

function ResetPasswordOptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { copy } = useLanguage();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [verifiedSession, setVerifiedSession] = useState({ email: '', code: '' });

  const email = searchParams.get('email') || verifiedSession.email;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = sessionStorage.getItem('verified-reset-session');
    if (!raw) {
      router.push('/forgot-password');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed.email || !parsed.code) {
        router.push('/forgot-password');
        return;
      }
      setVerifiedSession({ email: parsed.email, code: parsed.code });
    } catch {
      router.push('/forgot-password');
    }
  }, [router]);

  const handleLoginNow = async () => {
    if (!verifiedSession.email || !verifiedSession.code) return;

    setError('');
    setIsLoading(true);

    try {
      await authApi.loginWithResetCode({ email: verifiedSession.email, code: verifiedSession.code });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('verified-reset-session');
        sessionStorage.removeItem('reset-password-fallback');
      }
      router.push('/dashboard');
    } catch (err) {
      setError(getErrorMessage(err));
      setIsLoading(false);
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

      <div className="w-full max-w-md relative">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-8 flex items-center justify-center">
            <KeyRound className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{copy.auth.optionsTitle}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg font-medium leading-relaxed">
            {copy.auth.optionsSubtitle} <br />
            <span className="text-slate-900 dark:text-slate-100 font-bold">{email}</span>
          </p>
        </div>

        <div className="space-y-6">
          <div className="px-4 py-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            {copy.auth.optionsSuccess}
          </div>

          {error && (
            <div className="px-4 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          <Button type="button" isLoading={isLoading} onClick={handleLoginNow} className="w-full justify-center h-14 text-lg shadow-lg shadow-brand-500/20">
            <LogIn className="w-5 h-5" />
            {copy.auth.loginWithoutChange}
          </Button>

          <Link href={`/reset-password/new-password?email=${encodeURIComponent(email)}`} className="block">
            <Button type="button" variant="secondary" className="w-full justify-center h-14 text-lg">
              <LockKeyhole className="w-5 h-5" />
              {copy.auth.newPasswordChoice}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>

          <div className="pt-4 text-center">
            <Link href="/login" className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              {copy.common.backToLogin}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordOptionsPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordOptionsContent />
    </Suspense>
  );
}
