'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{
    devLoginCode?: string;
    emailPreviewUrl?: string;
    deliveredToInbox: boolean;
  }>;
  register: (name: string, email: string, password: string) => Promise<{
    devVerificationCode?: string;
    emailPreviewUrl?: string;
    deliveredToInbox: boolean;
  }>;
  verify: (email: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      refreshUser().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [refreshUser]);

  const storeFallback = (key: string, value: Record<string, string | boolean | undefined>) => {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, JSON.stringify(value));
  };

  const login = async (email: string, password: string) => {
    const result = await authApi.login({ email, password });

    storeFallback('verify-login-fallback', {
      email,
      devCode: result.devLoginCode,
      previewUrl: result.emailPreviewUrl,
      delivery: result.deliveredToInbox ? '' : 'fallback',
    });

    const params = new URLSearchParams({ email });
    if (result.devLoginCode) params.set('devCode', result.devLoginCode);
    if (result.emailPreviewUrl) params.set('previewUrl', result.emailPreviewUrl);
    if (!result.deliveredToInbox) params.set('delivery', 'fallback');

    router.push(`/verify-login?${params.toString()}`);
    return result;
  };

  const register = async (name: string, email: string, password: string) => {
    const result = await authApi.register({ name, email, password });

    storeFallback('verify-email-fallback', {
      email,
      devCode: result.devVerificationCode,
      previewUrl: result.emailPreviewUrl,
      delivery: result.deliveredToInbox ? '' : 'fallback',
    });

    const params = new URLSearchParams({ email });
    if (result.devVerificationCode) params.set('devCode', result.devVerificationCode);
    if (result.emailPreviewUrl) params.set('previewUrl', result.emailPreviewUrl);
    if (!result.deliveredToInbox) params.set('delivery', 'fallback');

    router.push(`/verify-email?${params.toString()}`);
    return result;
  };

  const verify = async (email: string, code: string) => {
    const { user } = await authApi.verifyEmail({ email, code });
    setUser(user);
    router.push('/dashboard');
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        verify,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
