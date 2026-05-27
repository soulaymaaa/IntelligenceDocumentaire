'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, ArrowRight, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getErrorMessage } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { LogoMark } from '@/components/branding/LogoMark';

export default function AdminLoginPage() {
  const { login, user, logout } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const loggedUser = await login(email, password);
      // Check if the logged-in user is an admin
      if (loggedUser?.role === 'admin') {
        // Admin user: go to admin console
        router.push('/portal');
      } else {
        // Non-admin: show error and optionally logout
        setError('Accès refusé : seul le rôle administrateur peut se connecter ici.');
        // Optionally, log out the non-admin user to clear session
        await logout();
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex text-white relative items-center justify-center p-6">
      {/* Sleek dark backgrounds with glowing gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-10 -left-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-10 -right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />

      <div className="absolute top-8 right-8 flex items-center gap-3">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md bg-slate-950/40 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 relative shadow-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <LogoMark className="h-14 w-auto text-indigo-500 mb-4" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-3">
            <ShieldAlert className="w-3.5 h-3.5" /> Portal Administration
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Espace Admin</h1>
          <p className="text-slate-400 mt-2 text-sm">Identifiez-vous pour gérer la plateforme</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Adresse Email"
            type="email"
            id="email"
            placeholder="admin@platform.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4.5 h-4.5 text-slate-400" />}
            required
            autoComplete="email"
            className="bg-slate-900 border-slate-850 text-white placeholder:text-slate-500 focus:border-indigo-500"
          />
          <Input
            label="Mot de passe"
            type="password"
            id="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4.5 h-4.5 text-slate-400" />}
            allowPasswordToggle
            required
            autoComplete="current-password"
            className="bg-slate-900 border-slate-850 text-white placeholder:text-slate-500 focus:border-indigo-500"
          />

          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold">
              {error}
            </div>
          )}

          <Button type="submit" isLoading={isLoading} className="w-full justify-center h-12 text-sm font-semibold bg-indigo-600 hover:bg-indigo-555 transition-colors">
            Se connecter <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <Link href="/login" className="hover:text-indigo-400 font-medium transition-colors">
            Retour à l'espace utilisateur
          </Link>
        </div>
      </div>
    </div>
  );
}
