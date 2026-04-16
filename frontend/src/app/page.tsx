'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  FileSearch,
  MessageSquareText,
  ScanText,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { Footer } from '@/components/layout/Footer';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';

const featureIcons = [Upload, ScanText, FileSearch, MessageSquareText];

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { copy } = useLanguage();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgb(246,250,249),_rgb(255,255,255))] text-slate-900 dark:bg-[linear-gradient(180deg,_rgb(7,20,25),_rgb(5,15,20))] dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <header className="flex flex-1 items-center justify-between rounded-3xl border border-surface-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur dark:bg-slate-900/80">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-500/20">
                <Brain className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-extrabold tracking-tight">DocIntel</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{copy.common.brandTagline}</p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              {!isLoading && isAuthenticated ? (
                <Link href="/dashboard">
                  <Button>{copy.common.dashboard}</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="secondary">{copy.home.login}</Button>
                  </Link>
                  <Link href="/register">
                    <Button>{copy.home.getStarted}</Button>
                  </Link>
                </>
              )}
            </div>
          </header>

          <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white p-1 shadow-sm dark:bg-slate-900">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        <section className="py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-brand-gradient text-white shadow-2xl shadow-brand-500/20">
            <Brain className="h-9 w-9" />
          </div>

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            <ShieldCheck className="w-4 h-4" />
            {copy.home.modernPlatform}
          </div>

          <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            {copy.home.title}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
            {copy.home.description}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {!isLoading && isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button size="lg">
                    {copy.home.openWorkspace}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/documents">
                  <Button variant="secondary" size="lg">{copy.home.myDocuments}</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg">
                    {copy.home.createAccount}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">{copy.home.signIn}</Button>
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            {isAuthenticated
              ? `${copy.home.welcomeUser}${user?.name ? `, ${user.name}` : ''}. ${copy.home.workspaceReady}`
              : copy.home.quickStart}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.home.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Card key={feature.title} className="border-surface-200 bg-white/85 shadow-sm dark:bg-slate-900/80">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{feature.title}</h2>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </section>

        <section className="mx-auto mt-20 max-w-4xl rounded-[32px] border border-surface-200 bg-slate-950 px-8 py-10 text-center text-white shadow-xl shadow-slate-900/20">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/80">DocIntel</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
            {copy.home.ctaTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-300">
            {copy.home.ctaDescription}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href={isAuthenticated ? '/dashboard' : '/register'}>
              <Button size="lg">
                {isAuthenticated ? copy.home.accessDashboard : copy.home.tryNow}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="secondary" size="lg">{copy.home.exploreSearch}</Button>
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
