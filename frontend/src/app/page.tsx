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
  FolderKanban,
  Sparkles,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';
import { Footer } from '@/components/layout/Footer';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { useLanguage } from '@/providers/LanguageProvider';

const featureIcons = [Upload, ScanText, FileSearch, MessageSquareText];
const heroIcons = [FolderKanban, Sparkles, Shield];

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { copy } = useLanguage();

  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_rgb(246,250,249),_rgb(255,255,255))] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.10),_transparent_24%),linear-gradient(180deg,_rgb(7,20,25),_rgb(5,15,20))] dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <header className="flex flex-1 flex-col gap-4 rounded-[30px] border border-surface-200 bg-white/86 px-5 py-5 shadow-[0_18px_38px_-26px_rgba(15,118,110,0.24)] backdrop-blur md:px-6 xl:flex-row xl:items-center xl:justify-between xl:py-4 dark:bg-slate-900/86">
            <Link href="/" className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-[22px] bg-brand-gradient text-white shadow-[0_14px_30px_-12px_rgba(8,145,178,0.55)]">
                <div className="absolute inset-0 rounded-[22px] bg-white/10" />
                <Brain className="relative h-6 w-6" />
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-600/80 dark:text-brand-300/80">
                  {copy.home.proofLabel}
                </p>
                <p className="mt-1 text-[1.7rem] font-extrabold leading-none tracking-tight text-slate-900 dark:text-slate-100">
                  DocIntel
                </p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                  {copy.common.brandTagline}
                </p>
              </div>
            </Link>

            <div className="flex flex-wrap items-center gap-2.5">
              {!isLoading && isAuthenticated ? (
                <Link href="/dashboard">
                  <Button className="min-w-[170px] justify-center shadow-[0_10px_24px_-14px_rgba(8,145,178,0.65)]">
                    {copy.common.dashboard}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="secondary" className="min-w-[108px] justify-center bg-white/80 dark:bg-slate-900">
                      {copy.home.login}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="min-w-[148px] justify-center shadow-[0_12px_26px_-14px_rgba(8,145,178,0.72)]">
                      {copy.home.getStarted}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </header>

          <div className="flex items-center justify-end">
            <div className="flex items-center gap-2 rounded-[24px] border border-surface-200 bg-white/92 p-1.5 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.18)] backdrop-blur dark:bg-slate-900/92">
              <LanguageToggle />
              <div className="h-8 w-px bg-surface-200" />
              <ThemeToggle />
            </div>
          </div>
        </div>

        <section className="relative py-16 sm:py-20">
          <div className="absolute left-1/2 top-16 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
                <ShieldCheck className="w-4 h-4" />
                {copy.home.modernPlatform}
              </div>

              <h1 className="mt-8 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
                {copy.home.title}
              </h1>

              <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
                {copy.home.description}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-4">
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

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {copy.home.statLabels.map((label, index) => (
                  <div key={label} className="rounded-2xl border border-surface-200 bg-white/70 px-4 py-4 shadow-sm backdrop-blur dark:bg-slate-900/70">
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{index === 0 ? '24/7' : index === 1 ? 'Top-K' : 'RAG'}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -right-8 top-6 h-24 w-24 rounded-full bg-cyan-400/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[32px] border border-surface-200 bg-white/80 p-5 shadow-[0_30px_80px_-30px_rgba(8,145,178,0.35)] backdrop-blur dark:bg-slate-900/80">
                <div className="rounded-[28px] bg-[linear-gradient(145deg,_rgba(15,118,110,0.95),_rgba(8,145,178,0.9),_rgba(34,197,94,0.85))] p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.25em] text-white/70">{copy.home.proofLabel}</p>
                      <h2 className="mt-3 text-2xl font-extrabold tracking-tight">DocIntel</h2>
                    </div>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
                      <Brain className="h-7 w-7" />
                    </div>
                  </div>

                  <div className="mt-8 grid gap-4">
                    {[
                      {
                        icon: heroIcons[0],
                        title: copy.home.heroCards.library,
                        description: copy.home.heroCards.libraryDesc,
                      },
                      {
                        icon: heroIcons[1],
                        title: copy.home.heroCards.ai,
                        description: copy.home.heroCards.aiDesc,
                      },
                      {
                        icon: heroIcons[2],
                        title: copy.home.heroCards.secure,
                        description: copy.home.heroCards.secureDesc,
                      },
                    ].map(({ icon: Icon, title, description }) => (
                      <div key={title} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 backdrop-blur-sm">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-extrabold">{title}</p>
                            <p className="mt-1 text-xs font-medium leading-5 text-white/75">{description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.home.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Card key={feature.title} className="border-surface-200 bg-white/85 shadow-sm dark:bg-slate-900/80" hover glow>
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

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-surface-200 bg-white/85 p-8 shadow-sm backdrop-blur dark:bg-slate-900/80">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-300">
              DocIntel Workflow
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {copy.home.processTitle}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
              {copy.home.processDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {copy.home.processSteps.map((step, index) => (
              <div key={step.title} className="rounded-[28px] border border-surface-200 bg-white/85 p-6 shadow-sm backdrop-blur dark:bg-slate-900/80">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                  <span className="text-sm font-extrabold">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-20 max-w-5xl overflow-hidden rounded-[36px] border border-surface-200 bg-slate-950 px-8 py-10 text-white shadow-xl shadow-slate-900/20">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/80">DocIntel</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
                {copy.home.ctaTitle}
              </h2>
              <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-300">
                {copy.home.ctaDescription}
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="space-y-3 text-sm font-medium text-slate-200">
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>{copy.home.features[0].title}</span>
                  <span className="text-cyan-300">Ready</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>{copy.home.features[1].title}</span>
                  <span className="text-cyan-300">Indexed</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                  <span>{copy.home.features[2].title}</span>
                  <span className="text-cyan-300">Live</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-4">
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
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
