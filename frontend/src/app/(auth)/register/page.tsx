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

  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasSpecialOrDigit = /[\d\W]/.test(password);
  const strengthScore = [hasMinLength, hasLetter, hasSpecialOrDigit].filter(Boolean).length;

  const isPasswordSecure = (pass: string) => {
    return pass.length >= 8 && /[a-zA-Z]/.test(pass) && /[\d\W]/.test(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordSecure(password)) {
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
    <div className="min-h-screen bg-card flex transition-colors">
      {/* Left panel - identical design to login page */}
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
          <p className="text-slate-600 dark:text-slate-400 text-xl max-w-sm font-medium leading-relaxed mt-4">
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

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card relative">
        <div className="absolute top-8 right-8 flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          {/* Logo only visible on mobile/tablet */}
          <Link href="/" className="mb-12 inline-flex items-center gap-3 lg:hidden group">
            <LogoMark className="h-auto w-[64px] max-w-full transition-transform duration-200 group-hover:scale-[1.03]" />
            <div className="min-w-0 leading-tight">
              <span className="block text-[28px] font-extrabold tracking-[-0.06em] text-brand-600 dark:text-cyan-300">
                DocIntel
              </span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Espace de travail sécurisé
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
              placeholder="Sophie Martin"
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
              placeholder="collab@entreprise.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-5 h-5" />}
              required
              autoComplete="email"
            />
            <div>
              <Input
                label={copy.auth.password}
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock className="w-5 h-5" />}
                allowPasswordToggle
                required
                autoComplete="new-password"
              />
              
              {password.length > 0 && (
                <div className="mt-3 space-y-2 animate-fade-in bg-slate-50 dark:bg-slate-900/30 p-3 rounded-xl border border-surface-200/50">
                  {/* Strength Bar */}
                  <div className="flex items-center justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-500 dark:text-slate-400">Sécurité du mot de passe :</span>
                    <span className={
                      strengthScore === 3 ? 'text-emerald-500 dark:text-emerald-400 font-extrabold' :
                      strengthScore === 2 ? 'text-amber-500 dark:text-amber-400 font-extrabold' : 'text-red-500 dark:text-red-400 font-extrabold'
                    }>
                      {strengthScore === 3 ? 'Fort' :
                       strengthScore === 2 ? 'Moyen' : 'Faible'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 h-1 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      strengthScore >= 1 ? (strengthScore === 3 ? 'bg-emerald-500' : strengthScore === 2 ? 'bg-amber-500' : 'bg-red-500') : 'bg-transparent'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      strengthScore >= 2 ? (strengthScore === 3 ? 'bg-emerald-500' : 'bg-amber-500') : 'bg-transparent'
                    }`} />
                    <div className={`h-full rounded-full transition-all duration-300 ${
                      strengthScore === 3 ? 'bg-emerald-500' : 'bg-transparent'
                    }`} />
                  </div>

                  {/* Checklist */}
                  <div className="space-y-1.5 mt-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${hasMinLength ? 'bg-emerald-500 scale-125' : 'bg-slate-300 dark:bg-slate-650'}`} />
                      <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-bold transition-colors' : 'text-slate-500 transition-colors'}>
                        Au moins 8 caractères
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${hasLetter ? 'bg-emerald-500 scale-125' : 'bg-slate-300 dark:bg-slate-650'}`} />
                      <span className={hasLetter ? 'text-emerald-600 dark:text-emerald-400 font-bold transition-colors' : 'text-slate-500 transition-colors'}>
                        Au moins une lettre (a-z, A-Z)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full transition-all ${hasSpecialOrDigit ? 'bg-emerald-500 scale-125' : 'bg-slate-300 dark:bg-slate-650'}`} />
                      <span className={hasSpecialOrDigit ? 'text-emerald-600 dark:text-emerald-400 font-bold transition-colors' : 'text-slate-500 transition-colors'}>
                        Au moins un chiffre ou caractère spécial
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {password.length === 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
                  {copy.auth.passwordHelp}
                </p>
              )}
            </div>

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
    </div>
  );
}
