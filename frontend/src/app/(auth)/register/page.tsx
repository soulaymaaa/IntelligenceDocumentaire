'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';
import { LogoMark } from '@/components/branding/LogoMark';

export default function RegisterPage() {
  const { register } = useAuth();
  const { copy } = useLanguage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError(copy.auth.passwordMin);
      return;
    }
    setIsLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-8 relative overflow-hidden transition-colors">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      <div className="absolute top-8 right-8 flex items-center gap-3">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        <Link href="/" className="mb-12 inline-flex items-center gap-3 group">
          <LogoMark className="h-auto w-[64px] max-w-full transition-transform duration-200 group-hover:scale-[1.03]" />
          <div className="min-w-0 leading-tight">
            <span className="block text-[28px] font-extrabold tracking-[-0.06em] text-brand-600 dark:text-cyan-300">
              DocIntel
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
              Rejoindre la plateforme
            </span>
          </div>
        </Link>

        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{copy.auth.registerTitle}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium">{copy.auth.registerSubtitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label={copy.auth.fullName}
            type="text"
            id="name"
            placeholder="Jane Smith"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User className="w-5 h-5" />}
            required
            minLength={2}
            autoComplete="name"
          />
          <Input
            label={copy.auth.emailAddress}
            type="email"
            id="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            required
            autoComplete="email"
          />
          <Input
            label={copy.auth.password}
            type="password"
            id="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
            allowPasswordToggle
            required
            minLength={8}
            autoComplete="new-password"
          />

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full justify-center h-12 text-base">
            {copy.auth.getStarted} <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        </form>

        <p className="mt-8 text-center text-sm font-bold text-slate-500">
          {copy.auth.alreadyHaveAccount}{' '}
          <Link href="/login" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold transition-colors">
            {copy.home.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
