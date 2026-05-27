'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';
import { LogoMark } from '@/components/branding/LogoMark';

export default function LoginPage() {
  const { login } = useAuth();
  const { copy } = useLanguage();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<React.ReactNode>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const loggedUser = await login(email, password);
      // Redirect based on role
      if (loggedUser?.role === 'admin') {
        router.push('/portal');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes('verify your email')) {
        setError(
          <span>
            {msg}.{' '}
            <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="underline font-bold hover:text-red-800 transition-colors">
              {copy.auth.verifyNow}
            </Link>
          </span>
        );
      } else {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex transition-colors">
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden bg-surface-100 border-r border-surface-200">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.03] dark:opacity-[0.07]" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="relative text-center">
          <Link href="/" className="inline-flex flex-col items-center group">
            <LogoMark className="h-auto w-[72px] max-w-full mx-auto" />
            <span className="mt-2 text-[28px] font-extrabold tracking-[-0.06em] text-slate-900 dark:text-slate-100">
              DocIntel
            </span>
          </Link>
          <p className="text-slate-600 dark:text-slate-400 text-xl max-w-sm font-medium leading-relaxed">
            {copy.auth.leftPanelDescription}
          </p>
          <div className="mt-12 grid grid-cols-2 gap-5 text-left">
            {copy.auth.leftPanelFeatures.map((feature) => (
              <div key={feature.label} className="bg-card rounded-2xl p-4 shadow-sm border border-surface-200/60">
                <p className="text-slate-900 dark:text-slate-100 text-sm font-bold">{feature.label}</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 font-medium leading-normal">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card relative">
        <div className="absolute top-8 right-8 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 inline-flex flex-col items-center gap-2 lg:hidden group">
            <LogoMark className="h-auto w-[60px] max-w-full transition-transform duration-200 group-hover:scale-[1.03]" />
            <span className="text-[24px] font-extrabold tracking-[-0.06em] text-slate-900 dark:text-slate-100">
              DocIntel
            </span>
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{copy.auth.loginTitle}</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium">{copy.auth.loginSubtitle}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label={copy.auth.emailAddress}
              type="email"
              id="email"
              placeholder="collab@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4.5 h-4.5" />}
              required
              autoComplete="email"
            />
            <Input
              label={copy.auth.password}
              type="password"
              id="password"
              placeholder={copy.auth.yourPassword}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4.5 h-4.5" />}
              allowPasswordToggle
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end -mt-2">
              <Link href="/forgot-password" className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                {copy.auth.forgotPassword}
              </Link>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
                {error}
              </div>
            )}

            <Button type="submit" isLoading={isLoading} className="w-full justify-center h-12 text-base">
              {copy.common.continue} <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </form>

          <p className="mt-8 text-center text-sm font-bold text-slate-500">
            {copy.auth.noAccount}{' '}
            <Link href="/register" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold transition-colors">
              {copy.auth.createOne}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
