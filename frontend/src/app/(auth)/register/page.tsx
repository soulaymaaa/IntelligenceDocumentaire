'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail, Lock, User, Brain, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';

import { ThemeToggle } from '@/components/layout/ThemeToggle';

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
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
      {/* Decorative background elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />

      {/* Theme Toggle */}
      <div className="absolute top-8 right-8">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md relative">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-12 h-12 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-brand-700 to-brand-500 tracking-tight">DocIntel</span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Join Platform</p>
          </div>
        </div>

        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Create account</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium">Start analyzing documents with AI in minutes</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="Full name"
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
            label="Email address"
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
            label="Password"
            type="password"
            id="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
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
            Get Started <ArrowRight className="w-5 h-5 ml-1" />
          </Button>
        </form>

        <p className="mt-8 text-center text-sm font-bold text-slate-500">
          Already have an account?{' '}
          <Link href="/login" className="text-brand-600 dark:text-brand-400 hover:text-brand-700 font-bold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
