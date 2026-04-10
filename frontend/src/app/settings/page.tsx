'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, KeyRound, Mail, ShieldCheck, User2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/lib/auth-context';
import { authApi } from '@/lib/api';
import { getErrorMessage } from '@/lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      setMessage('Password updated successfully.');
      setError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (err) => {
      setError(getErrorMessage(err));
      setMessage('');
    },
  });

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    await changePasswordMutation.mutateAsync({ currentPassword, newPassword });
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-6xl space-y-8">
        <Card className="border-surface-200 bg-gradient-to-br from-slate-950 via-slate-900 to-brand-950 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-200/70">Account center</p>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Settings & security</h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-300">
            Manage your profile information, review authentication state, and keep your account secure.
          </p>
        </Card>

        <div className="grid gap-8 lg:grid-cols-[0.95fr,1.05fr]">
          <div className="space-y-6">
            <Card className="border-surface-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-600">
                  <User2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Profile</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current account identity</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Full name</p>
                  <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{user?.name || 'Unknown user'}</p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Email</p>
                  <p className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">{user?.email || 'Unknown email'}</p>
                </div>
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Role</p>
                  <p className="mt-2 text-base font-bold capitalize text-slate-900 dark:text-slate-100">{user?.role || 'user'}</p>
                </div>
              </div>
            </Card>

            <Card className="border-surface-200">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Security status</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Current protections enabled on your account</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  { icon: Mail, label: 'Email verification', value: 'Enabled' },
                  { icon: KeyRound, label: 'Login code challenge', value: 'Enabled' },
                  { icon: ShieldCheck, label: 'Password reset flow', value: 'Enabled' },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-4 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                    <div className="rounded-xl bg-white p-2 text-brand-600 shadow-sm">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{label}</p>
                    </div>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="border-surface-200">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-brand-500/20 bg-brand-500/10 p-3 text-brand-600">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Change password</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Update your password without leaving the platform</p>
              </div>
            </div>

            <form onSubmit={handlePasswordChange} className="mt-6 space-y-5">
              <Input
                label="Current password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                allowPasswordToggle
                required
              />
              <Input
                label="New password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                allowPasswordToggle
                required
                minLength={8}
              />
              <Input
                label="Confirm new password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                allowPasswordToggle
                required
                minLength={8}
              />

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-bold text-red-600">
                  {error}
                </div>
              )}

              {message && (
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-600">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  {message}
                </div>
              )}

              <Button type="submit" isLoading={changePasswordMutation.isPending} className="w-full justify-center h-12 text-base">
                Update password
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
