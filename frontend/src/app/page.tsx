'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  FileSearch,
  Files,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Upload,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/lib/auth-context';

const features = [
  {
    icon: Upload,
    title: 'Upload rapide',
    description: 'Importe des PDF, JPG et PNG avec drag and drop et lance automatiquement le traitement.',
  },
  {
    icon: Sparkles,
    title: 'OCR + IA',
    description: 'Extrait le texte, génère des résumés intelligents et prépare les documents pour le RAG.',
  },
  {
    icon: FileSearch,
    title: 'Recherche sémantique',
    description: 'Retrouve les passages importants même sans connaître les mots exacts du document.',
  },
  {
    icon: MessageSquareText,
    title: 'Chat conversationnel',
    description: 'Pose des questions comme dans ChatGPT, conserve l’historique et affiche les sources citées.',
  },
];

const steps = [
  'Ajoute tes documents dans la bibliothèque.',
  'Laisse l’OCR et l’indexation préparer le contenu.',
  'Recherche, résume et interroge tes fichiers avec des réponses sourcées.',
];

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.18),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(180deg,_rgb(248,250,252),_rgb(255,255,255))] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_rgb(15,23,42),_rgb(2,6,23))] dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 lg:px-10">
        <header className="flex items-center justify-between rounded-3xl border border-white/60 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/70">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-cyan-500 text-white shadow-lg shadow-brand-500/25">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">DocIntel</p>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                OCR • Search • RAG
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {!isLoading && isAuthenticated ? (
              <Link href="/dashboard">
                <Button>
                  Aller au dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
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

        <section className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.1fr,0.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-500/20 bg-brand-500/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">
              <ShieldCheck className="w-4 h-4" />
              Plateforme documentaire intelligente
            </div>

            <h1 className="mt-6 max-w-4xl text-5xl font-extrabold leading-tight tracking-tight sm:text-6xl">
              Centralise tes documents, comprends-les plus vite et interroge-les avec une IA vraiment utile.
            </h1>

            <p className="mt-6 max-w-2xl text-lg font-medium leading-8 text-slate-600 dark:text-slate-300">
              DocIntel combine l’upload, l’OCR, la recherche sémantique, les résumés intelligents et le chat RAG avec sources pour transformer une bibliothèque de fichiers en espace de travail exploitable.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              {!isLoading && isAuthenticated ? (
                <>
                  <Link href="/dashboard">
                    <Button size="lg">
                      Ouvrir mon espace
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/documents">
                    <Button variant="secondary" size="lg">Voir mes documents</Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/register">
                    <Button size="lg">
                      Créer un compte
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="secondary" size="lg">Se connecter</Button>
                  </Link>
                </>
              )}
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {steps.map((step) => (
                <div key={step} className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 text-sm font-semibold leading-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
                  <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  {step}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <Card className="overflow-hidden border-white/60 bg-white/80 shadow-xl shadow-slate-200/40 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-600 dark:text-brand-300">
                    Workspace IA
                  </p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight">Une vue moderne pour travailler tes documents</h2>
                </div>
                <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-cyan-500 p-3 text-white shadow-lg shadow-brand-500/25">
                  <Files className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                {features.map(({ icon: Icon, title, description }) => (
                  <div key={title} className="rounded-2xl border border-surface-200 bg-white/90 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-extrabold tracking-tight">{title}</p>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                          {description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-white/60 bg-slate-950 text-white shadow-lg shadow-slate-900/15 dark:border-slate-800">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-300/80">Recherche</p>
                <p className="mt-3 text-3xl font-extrabold">RAG avec sources</p>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-300">
                  Chaque réponse affiche les passages utilisés, le score de pertinence et l’historique conversationnel.
                </p>
              </Card>

              <Card className="border-brand-500/15 bg-gradient-to-br from-brand-50 to-cyan-50 shadow-lg shadow-brand-500/10 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-700 dark:text-brand-300">Accueil personnalisé</p>
                <p className="mt-3 text-3xl font-extrabold">Bienvenue{user?.name ? `, ${user.name}` : ''}</p>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-300">
                  {isAuthenticated
                    ? 'Ton espace est prêt. Tu peux reprendre tes analyses, tes conversations et tes documents.'
                    : 'Commence par créer un compte ou connecte-toi pour accéder à ton dashboard intelligent.'}
                </p>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
