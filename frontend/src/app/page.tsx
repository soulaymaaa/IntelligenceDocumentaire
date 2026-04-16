'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  ShieldCheck,
  ScanText,
  FileSearch,
  MessageSquareText,
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
const heroCardIcons = [FileSearch, Brain, ShieldCheck];

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const { copy } = useLanguage();
  const heroCards = [
    { title: copy.home.heroCards.library, description: copy.home.heroCards.libraryDesc },
    { title: copy.home.heroCards.ai, description: copy.home.heroCards.aiDesc },
    { title: copy.home.heroCards.secure, description: copy.home.heroCards.secureDesc },
  ];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f4f7fd] text-slate-900 dark:bg-[linear-gradient(180deg,_rgb(7,20,25),_rgb(5,15,20))] dark:text-slate-100">
      <div className="relative w-full px-6 py-8 sm:px-8 lg:px-10 xl:px-14 2xl:px-16">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_34%),radial-gradient(circle_at_top_left,_rgba(34,197,94,0.10),_transparent_26%)]" />

        <header className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-1 items-center justify-between rounded-[34px] border border-white/80 bg-white/88 px-6 py-5 shadow-[0_24px_60px_-34px_rgba(59,130,246,0.22)] backdrop-blur">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-brand-gradient text-white shadow-[0_16px_32px_-16px_rgba(8,145,178,0.6)]">
                  <Brain className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-[1.8rem] font-extrabold leading-none tracking-tight text-slate-900">DocIntel</p>
                  <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                    {copy.common.brandTagline}
                  </p>
                </div>
              </Link>
            </div>

            <div className="hidden items-center gap-3 xl:flex">
              <nav className="mr-3 flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-50/85 px-3 py-2 text-sm font-semibold text-slate-500">
                {copy.home.navItems.map((item) => (
                  <span
                    key={item}
                    className="rounded-full px-3 py-1 transition-colors duration-200 hover:bg-white hover:text-slate-900"
                  >
                    {item}
                  </span>
                ))}
              </nav>

              {!isLoading && isAuthenticated ? (
                <Link href="/dashboard">
                  <Button className="min-w-[180px] justify-center">{copy.common.dashboard}</Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="secondary" className="min-w-[132px] justify-center rounded-full bg-white">
                      {copy.home.login}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button className="min-w-[170px] justify-center rounded-full">
                      {copy.home.getStarted}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-end">
            <div className="flex items-center gap-2 rounded-[28px] border border-white/80 bg-white/92 p-1.5 shadow-[0_24px_44px_-30px_rgba(59,130,246,0.22)] backdrop-blur">
              <LanguageToggle />
              <div className="h-8 w-px bg-slate-200" />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <section className="relative z-10 grid gap-12 pt-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:pt-16">
          <div className="max-w-[720px] pt-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/15 bg-white/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-700 shadow-[0_10px_24px_-22px_rgba(8,145,178,0.45)]">
              <ShieldCheck className="h-4 w-4" />
              {copy.home.modernPlatform}
            </div>

            <h1 className="mt-7 max-w-4xl text-[clamp(2.8rem,5.7vw,5rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-[#10295c]">
              {copy.home.title}
            </h1>

            <p className="mt-7 max-w-[760px] text-base font-medium leading-8 text-slate-600">
              {copy.home.description}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {copy.home.statLabels.map((label) => (
                <div
                  key={label}
                  className="rounded-full border border-white/80 bg-white/82 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-slate-600 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.22)]"
                >
                  {label}
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              {!isLoading && isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button size="lg" className="rounded-full px-8">
                      {copy.home.openWorkspace}
                    </Button>
                  </Link>
                  <Link href="/documents">
                    <Button variant="secondary" size="lg" className="rounded-full px-8 bg-white">
                      {copy.home.myDocuments}
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register">
                    <Button size="lg" className="rounded-full px-10">
                      {copy.home.primaryCta}
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="secondary" size="lg" className="rounded-full border-white bg-white px-10">
                      {copy.home.secondaryCta}
                    </Button>
                  </Link>
                </>
              )}
            </div>

            <p className="mt-6 text-sm font-medium text-slate-500">
              {isAuthenticated
                ? `${copy.home.welcomeUser}${user?.name ? `, ${user.name}` : ''}. ${copy.home.workspaceReady}`
                : copy.home.quickStart}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {heroCards.map((card, index) => {
                const Icon = heroCardIcons[index];
                return (
                  <div
                    key={card.title}
                    className="rounded-[26px] border border-white/80 bg-white/84 p-5 shadow-[0_20px_40px_-30px_rgba(15,23,42,0.24)] backdrop-blur"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-4 text-sm font-extrabold tracking-tight text-slate-900">{card.title}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative flex min-h-[620px] items-center justify-center overflow-visible pr-6 xl:pr-12">
            <div className="absolute top-[8%] right-[8%] h-24 w-24 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute bottom-[-160px] right-[-110px] h-[520px] w-[520px] rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,_#1d4ed8,_#3b82f6,_#60a5fa,_#1d4ed8)] opacity-95 blur-[1px]" />
            <div className="absolute bottom-[-36px] right-[42px] h-[300px] w-[300px] rounded-full border-[36px] border-white/75" />

            <div className="absolute left-[2%] top-[26%] z-0 rounded-[28px] border border-white/80 bg-white/78 p-3 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)] backdrop-blur">
              <div className="relative w-[250px] overflow-hidden rounded-[24px]">
                <img
                  src="/hero-card.jpg"
                  alt="Passport preview"
                  className="h-[390px] w-full object-cover object-center"
                />
              </div>
            </div>

            <div className="absolute left-[16%] top-[17%] z-30 rounded-[18px] border border-white/85 bg-white px-4 py-3 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.34)]">
              <div className="flex items-center gap-3">
                <img
                  src="/hero-card.jpg"
                  alt="Profile preview"
                  className="h-14 w-14 rounded-2xl object-cover object-[18%_72%]"
                />
                <div>
                  <p className="text-xs font-extrabold text-slate-900">EMMA</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    <span className="text-[11px] font-medium text-slate-500">Canada</span>
                  </div>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-sky-500">Resident Card</p>
                </div>
              </div>
            </div>

            <div className="absolute left-[-1%] top-[48%] z-30 rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.26)]">
              <ScanText className="h-8 w-8 text-brand-600" />
            </div>

            <div className="absolute right-[1%] top-[34%] z-30 rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.26)]">
              <ShieldCheck className="h-8 w-8 text-blue-500" />
            </div>

            <div className="absolute right-[4%] top-[10%] z-30 hidden rounded-[24px] border border-white/85 bg-white/90 px-4 py-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.28)] backdrop-blur sm:block">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-600">
                {copy.home.proofLabel}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{copy.home.heroCards.secure}</p>
                  <p className="text-xs font-medium text-slate-500">{copy.home.regionLabel}</p>
                </div>
              </div>
            </div>

            <div className="absolute left-[36%] top-[76%] z-30 rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_24px_56px_-34px_rgba(15,23,42,0.26)]">
              <ScanText className="h-7 w-7 text-blue-500" />
            </div>

            <div className="relative z-10 -translate-y-16 xl:translate-x-2 xl:-translate-y-12">
              <div className="relative h-[600px] w-[315px] rounded-[48px] border-[8px] border-white bg-[#9ba7ba] p-[8px] shadow-[0_42px_100px_-42px_rgba(15,23,42,0.46)]">
                <div className="relative h-full w-full overflow-hidden rounded-[40px] bg-[#8794a8]">
                  <img
                    src="/hero-passport.jpg"
                    alt="Passport preview"
                    className="absolute inset-0 h-full w-full object-contain bg-white object-center"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.12))]" />
                  <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-slate-900/20 to-transparent" />
                  <div className="absolute left-1/2 top-4 h-1.5 w-16 -translate-x-1/2 rounded-full bg-white/45" />
                  <div className="absolute right-5 top-5 text-xs font-black text-white/80">*</div>
                  <div className="pointer-events-none absolute inset-x-4 top-[136px] bottom-[104px] rounded-[24px] border border-cyan-200/25">
                    <div className="absolute left-2 top-2 h-8 w-8 rounded-tl-2xl border-l-[3px] border-t-[3px] border-cyan-300/95" />
                    <div className="absolute right-2 top-2 h-8 w-8 rounded-tr-2xl border-r-[3px] border-t-[3px] border-cyan-300/95" />
                    <div className="absolute bottom-2 left-2 h-8 w-8 rounded-bl-2xl border-b-[3px] border-l-[3px] border-cyan-300/95" />
                    <div className="absolute bottom-2 right-2 h-8 w-8 rounded-br-2xl border-b-[3px] border-r-[3px] border-cyan-300/95" />
                  </div>

                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.home.features.map((feature, index) => {
            const Icon = featureIcons[index];
            return (
              <Card key={feature.title} className="rounded-[28px] border-white/70 bg-white/82 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.22)]" hover glow>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900">{feature.title}</h2>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">
                  {feature.description}
                </p>
              </Card>
            );
          })}
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] border border-white/70 bg-white/84 p-8 shadow-[0_20px_42px_-32px_rgba(15,23,42,0.22)] backdrop-blur">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-600">
              DocIntel Workflow
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
              {copy.home.processTitle}
            </h2>
            <p className="mt-4 max-w-xl text-sm font-medium leading-7 text-slate-500">
              {copy.home.processDescription}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {copy.home.processSteps.map((step, index) => (
              <div key={step.title} className="rounded-[28px] border border-white/70 bg-white/84 p-6 shadow-[0_20px_42px_-32px_rgba(15,23,42,0.22)] backdrop-blur">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700">
                  <span className="text-sm font-extrabold">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-extrabold tracking-tight text-slate-900">{step.title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-slate-500">{step.description}</p>
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
