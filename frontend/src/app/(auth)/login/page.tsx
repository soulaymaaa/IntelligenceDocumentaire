'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Brain, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';

import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<React.ReactNode>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const msg = getErrorMessage(err);
      if (msg.toLowerCase().includes('verify your email')) {
        setError(
          <span>
            {msg}.{' '}
            <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="underline font-bold hover:text-red-800 transition-colors">
              Verify now
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
      {/* Left panel — branding */}
      <div className="hidden lg:flex w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden bg-surface-100 border-r border-surface-200">
        <div className="absolute inset-0 bg-brand-gradient opacity-[0.03] dark:opacity-[0.07]" />
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="relative text-center">
          <div className="w-24 h-24 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-8 flex items-center justify-center">
            <Brain className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-5xl font-extrabold text-slate-900 dark:text-slate-100 mb-6 tracking-tight">DocIntel</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xl max-w-sm font-medium leading-relaxed">
            Transform your documents with AI-powered OCR, semantic search, and intelligent Q&A.
          </p>
          <div className="mt-12 grid grid-cols-2 gap-5 text-left">
            {[
              { label: 'OCR Extraction',   desc: 'PDF & image text extraction' },
              { label: 'Semantic Search',  desc: 'Find anything with AI' },
              { label: 'AI Summaries',     desc: 'Instant document summaries' },
              { label: 'RAG Answers',      desc: 'Ask questions, get answers' },
            ].map((f) => (
              <div key={f.label} className="bg-card rounded-2xl p-4 shadow-sm border border-surface-200/60">
                <p className="text-slate-900 dark:text-slate-100 text-sm font-bold">{f.label}</p>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1 font-medium leading-normal">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-card relative">
        <div className="absolute top-8 right-8">
          <ThemeToggle />
        </div>

        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-12 lg:hidden">
            <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-brand-500/20">
              <Brain className="w-5.5 h-5.5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500">DocIntel</span>
          </div>

          <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Welcome back</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium">Enter your password, then validate the email code to finish signing in</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email address"
              type="email"
              id="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4.5 h-4.5" />}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              id="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4.5 h-4.5" />}
              allowPasswordToggle
              required
              autoComplete="current-password"
            />

            <div className="flex justify-end -mt-2">
              <Link href="/forgot-password" className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold">
                {error}
              </div>
            )}

            {/* Demo credentials hint */}
            <div className="px-4 py-3 rounded-xl bg-brand-500/5 border border-brand-500/20 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
              <strong className="text-brand-700 dark:text-brand-400">Demo account:</strong> demo@example.com / Demo1234!
            </div>

            <Button type="submit" isLoading={isLoading} className="w-full justify-center h-12 text-base">
              Continue <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
          </form>

          <p className="mt-8 text-center text-sm font-bold text-slate-500">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
