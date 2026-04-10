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

const features = [
  {
    icon: Upload,
    title: 'Upload simple',
    description: 'Ajoute tes PDF et images en quelques secondes.',
  },
  {
    icon: ScanText,
    title: 'OCR intelligent',
    description: 'Transforme les documents en texte exploitable automatiquement.',
  },
  {
    icon: FileSearch,
    title: 'Recherche semantique',
    description: 'Retrouve vite les passages importants dans toute ta bibliotheque.',
  },
  {
    icon: MessageSquareText,
    title: 'Chat avec sources',
    description: 'Pose des questions et vois les extraits utilises par l IA.',
  },
];

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_rgb(246,250,249),_rgb(255,255,255))] text-slate-900 dark:bg-[linear-gradient(180deg,_rgb(7,20,25),_rgb(5,15,20))] dark:text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-3xl border border-surface-200 bg-white/80 px-5 py-4 shadow-sm backdrop-blur dark:bg-slate-900/80">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-500/20">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">DocIntel</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">OCR  Search  RAG</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!isLoading && isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button>Dashboard</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="secondary">Connexion</Button>
                </Link>
                <Link href="/register">
                  <Button>Commencer</Button>
                </Link>
              </>
            )}
          </div>
        </header>

        <section className="py-24 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[28px] bg-brand-gradient text-white shadow-2xl shadow-brand-500/20">
            <Brain className="h-9 w-9" />
          </div>

          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
            <ShieldCheck className="w-4 h-4" />
            Plateforme documentaire moderne
          </div>

          <h1 className="mx-auto mt-8 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Analyse tes documents avec une interface simple, claire et intelligente.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
            DocIntel centralise tes fichiers, extrait leur contenu, facilite la recherche et te permet d interroger tes documents avec une IA sourcée.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {!isLoading && isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button size="lg">
                    Ouvrir mon espace
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/documents">
                  <Button variant="secondary" size="lg">Mes documents</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/register">
                  <Button size="lg">
                    Creer un compte
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">Se connecter</Button>
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">
            {isAuthenticated
              ? `Bienvenue${user?.name ? `, ${user.name}` : ''}. Ton espace est pret.`
              : 'Commence rapidement et structure ton travail documentaire sans complexite inutile.'}
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-surface-200 bg-white/85 shadow-sm dark:bg-slate-900/80">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
              <p className="mt-3 text-sm font-medium leading-7 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </Card>
          ))}
        </section>

        <section className="mx-auto mt-20 max-w-4xl rounded-[32px] border border-surface-200 bg-slate-950 px-8 py-10 text-center text-white shadow-xl shadow-slate-900/20">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/80">DocIntel</p>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight">
            Une experience documentaire plus simple, plus rapide, plus moderne
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium leading-7 text-slate-300">
            Upload, OCR, recherche, resumes et chat IA dans un meme environnement, sans surcharge visuelle.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link href={isAuthenticated ? '/dashboard' : '/register'}>
              <Button size="lg">
                {isAuthenticated ? 'Acceder au dashboard' : 'Essayer maintenant'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="secondary" size="lg">Explorer la recherche</Button>
            </Link>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
