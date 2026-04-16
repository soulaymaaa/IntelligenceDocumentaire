'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, KeyRound } from 'lucide-react';
import { authApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { getErrorMessage } from '@/lib/utils';

function NewPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await authApi.resetPassword({
        email: verifiedSession.email,
        code: verifiedSession.code,
        newPassword,
      });
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('verified-reset-session');
        sessionStorage.removeItem('reset-password-fallback');
      }
      setSuccess('Password reset successfully. Redirecting to login...');
      setTimeout(() => router.push(`/login?email=${encodeURIComponent(email)}`), 1200);
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
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">New password</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-4 text-lg font-medium leading-relaxed">
            Create a new password for <br />
            <span className="text-slate-900 dark:text-slate-100 font-bold">{email}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="New password"
            type="password"
            placeholder="At least 8 characters"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            minLength={8}
            required
          />

          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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

          <div className="pt-4 text-center">
            <Link href={`/reset-password/options?email=${encodeURIComponent(email)}`} className="text-sm font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              Back to options
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={null}>
      <NewPasswordContent />
    </Suspense>
  );
}
