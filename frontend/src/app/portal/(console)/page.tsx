'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users, Shield, ShieldCheck, Trash2, Search, Plus, UserPlus,
  RefreshCw, ShieldAlert, Check, Copy, Activity, Server,
  Database, CheckCircle2, AlertTriangle, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminPortalApi } from '@/lib/api';
import type { User, PaginationMeta } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export default function AdminDashboardPage() {
  // Global Metrics
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [deletedAccounts, setDeletedAccounts] = useState(0);
  const [adminCount, setAdminCount] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'users' | 'admins'>('users');

  // Lists & Paginations
  const [users, setUsers] = useState<User[]>([]);
  const [usersMeta, setUsersMeta] = useState<PaginationMeta | null>(null);
  const [pageUsers, setPageUsers] = useState(1);
  const [searchUsers, setSearchUsers] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [admins, setAdmins] = useState<User[]>([]);
  const [adminsMeta, setAdminsMeta] = useState<PaginationMeta | null>(null);
  const [pageAdmins, setPageAdmins] = useState(1);
  const [searchAdmins, setSearchAdmins] = useState('');
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  // Modals & Action confirmations
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
    danger?: boolean;
  } | null>(null);

  // Create User Form
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createSuccessData, setCreateSuccessData] = useState<{ email: string; pass: string } | null>(null);
  const [createError, setCreateError] = useState('');

  // Copy success indicator
  const [copiedText, setCopiedText] = useState(false);

  // Global error message
  const [errorMsg, setErrorMsg] = useState('');

  // 1. Fetch Metrics
  const fetchMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const data = await adminPortalApi.getMetrics();
      setTotalUsers(data.totalUsers);
      setActiveUsers(data.activeUsers);
      setDeletedAccounts(data.deletedAccounts);
    } catch (err) {
      console.error('Erreur lors du chargement des indicateurs', err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // 2. Fetch Users
  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const data = await adminPortalApi.getUsers({
        page: pageUsers,
        limit: 8,
        search: searchUsers,
        role: 'user'
      });
      setUsers(data.users);
      setUsersMeta(data.meta);
    } catch (err) {
      setErrorMsg('Erreur de chargement de la liste des utilisateurs.');
    } finally {
      setLoadingUsers(false);
    }
  }, [pageUsers, searchUsers]);

  // 3. Fetch Admins
  const fetchAdmins = useCallback(async () => {
    setLoadingAdmins(true);
    try {
      const data = await adminPortalApi.getUsers({
        page: pageAdmins,
        limit: 8,
        search: searchAdmins,
        role: 'admin'
      });
      setAdmins(data.users);
      setAdminsMeta(data.meta);
      setAdminCount(data.meta.total);
    } catch (err) {
      setErrorMsg('Erreur de chargement de la liste des administrateurs.');
    } finally {
      setLoadingAdmins(false);
    }
  }, [pageAdmins, searchAdmins]);

  // Load everything
  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchAdmins();
  }, [fetchAdmins]);

  const refreshAll = () => {
    setErrorMsg('');
    fetchMetrics();
    fetchUsers();
    fetchAdmins();
  };

  // Actions
  const handleToggleVerification = (user: User) => {
    const nextVerified = !user.isVerified;
    setConfirmConfig({
      title: nextVerified ? 'Vérifier le compte' : 'Dé-vérifier le compte',
      message: `Voulez-vous modifier le statut de vérification de ${user.name} ?`,
      action: async () => {
        const res = await adminPortalApi.updateUser(user._id, { isVerified: nextVerified });
        if (user.role === 'admin') {
          setAdmins(admins.map((u) => (u._id === user._id ? res.user : u)));
        } else {
          setUsers(users.map((u) => (u._id === user._id ? res.user : u)));
        }
        fetchMetrics();
      }
    });
    setIsConfirmOpen(true);
  };

  const handleToggleRole = (user: User) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    setConfirmConfig({
      title: nextRole === 'admin' ? 'Promouvoir au rôle Administrateur' : 'Rétrograder au rôle Utilisateur',
      message: `Êtes-vous sûr de vouloir changer le rôle de ${user.name} en ${nextRole === 'admin' ? 'Administrateur' : 'Utilisateur simple'} ?`,
      action: async () => {
        const res = await adminPortalApi.updateUser(user._id, { role: nextRole });
        if (nextRole === 'admin') {
          // Promoted from user to admin
          setUsers(users.filter((u) => u._id !== user._id));
          setAdmins([res.user, ...admins]);
        } else {
          // Demoted from admin to user
          setAdmins(admins.filter((u) => u._id !== user._id));
          setUsers([res.user, ...users]);
        }
        fetchMetrics();
        fetchAdmins();
      },
      danger: user.role === 'admin' // Warn if demoting an admin
    });
    setIsConfirmOpen(true);
  };

  const handleDeleteUser = (user: User) => {
    setConfirmConfig({
      title: 'Supprimer définitivement le compte',
      message: `Cette action est irréversible. Êtes-vous sûr de vouloir supprimer le compte de ${user.name} (${user.email}) et effacer l'ensemble de ses documents et données ?`,
      action: async () => {
        await adminPortalApi.deleteUser(user._id);
        if (user.role === 'admin') {
          setAdmins(admins.filter((u) => u._id !== user._id));
        } else {
          setUsers(users.filter((u) => u._id !== user._id));
        }
        fetchMetrics();
        fetchAdmins();
      },
      danger: true
    });
    setIsConfirmOpen(true);
  };

  // Secure Password Generator
  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Ensure complexity
    if (/[a-zA-Z]/.test(pass) && /[\d\W]/.test(pass)) {
      setNewUserPassword(pass);
    } else {
      generateSecurePassword();
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setIsCreatingUser(true);

    if (!newUserName.trim() || !newUserEmail.trim()) {
      setCreateError('Le nom et l\'adresse e-mail sont obligatoires.');
      setIsCreatingUser(false);
      return;
    }

    try {
      const generatedPass = newUserPassword || Math.random().toString(36).slice(-10) + 'A1!';
      await adminPortalApi.createUser({
        name: newUserName,
        email: newUserEmail.toLowerCase(),
        role: newUserRole,
        password: generatedPass
      });

      setCreateSuccessData({
        email: newUserEmail,
        pass: generatedPass
      });

      // Clear Form
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');

      // Refresh Tables
      refreshAll();
    } catch (err: any) {
      setCreateError(err.response?.data?.message || 'Erreur lors de la création de l\'utilisateur.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleCopyPassword = () => {
    if (createSuccessData?.pass) {
      navigator.clipboard.writeText(createSuccessData.pass);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2000);
    }
  };

  const executeConfirmedAction = async () => {
    if (confirmConfig?.action) {
      try {
        await confirmConfig.action();
      } catch (err: any) {
        alert(err.response?.data?.message || 'Une erreur est survenue lors de l\'action.');
      }
    }
    setIsConfirmOpen(false);
    setConfirmConfig(null);
  };

  // SVGs charts details
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const activeRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
  const activeOffset = circumference - (activeRate / 100) * circumference;

  const adminRate = totalUsers > 0 ? (adminCount / totalUsers) * 100 : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
      
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-brand-600/5 to-violet-600/5 dark:from-brand-500/10 dark:to-violet-500/5 border border-surface-200/60 dark:border-slate-850 p-6 rounded-3xl backdrop-blur-xl">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight gradient-text">
            Console d'Administration
          </h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
            Supervisez les accès, gérez les habilitations et analysez l'activité en temps réel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={refreshAll}
            className="h-10 px-3 border-surface-200 dark:border-slate-800 bg-card hover:bg-card-hover rounded-xl shadow-sm text-slate-650 hover:text-slate-900 dark:hover:text-slate-100"
            title="Actualiser les données"
          >
            <RefreshCw className={cn("w-4 h-4", (loadingMetrics || loadingUsers || loadingAdmins) && "animate-spin")} />
          </Button>
          <Button
            onClick={() => {
              setCreateSuccessData(null);
              setCreateError('');
              setIsCreateModalOpen(true);
            }}
            className="btn-primary h-10 px-4 rounded-xl flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Créer un utilisateur
          </Button>
        </div>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="p-1 hover:bg-red-500/10 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="glass relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 p-5 border-surface-200/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-300" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-500/10 text-brand-650 dark:text-brand-400 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Utilisateurs</p>
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">
                {loadingMetrics ? '...' : totalUsers}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="glass relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 p-5 border-surface-200/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-300" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-650 dark:text-emerald-400 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Membres Actifs</p>
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">
                {loadingMetrics ? '...' : activeUsers}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="glass relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 p-5 border-surface-200/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all duration-300" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-2xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Administrateurs</p>
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">
                {loadingAdmins ? '...' : adminCount}
              </h3>
            </div>
          </div>
        </Card>

        <Card className="glass relative overflow-hidden group hover:scale-[1.02] hover:shadow-lg transition-all duration-200 p-5 border-surface-200/50">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-all duration-300" />
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-500/10 text-red-650 dark:text-red-400 rounded-2xl">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Comptes Supprimés</p>
              <h3 className="text-2xl font-extrabold mt-1 text-slate-900 dark:text-white">
                {loadingMetrics ? '...' : deletedAccounts}
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {/* Two-Fragment Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Fragment 1 (Left column - Stats & Health) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="glass p-5 border-surface-200/50 flex flex-col justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Activity className="w-4.5 h-4.5 text-brand-600 dark:text-brand-400 animate-pulse" />
                Statistiques & Statuts
              </h4>

              {/* SVG Circular Progress Loader */}
              <div className="flex flex-col items-center py-6 border-b border-surface-200/60 dark:border-slate-800">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                    />
                    <circle
                      cx="56"
                      cy="56"
                      r={radius}
                      className="text-brand-500 dark:text-brand-400 transition-all duration-500 ease-out"
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={loadingMetrics ? circumference : activeOffset}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                      {loadingMetrics ? '...' : `${activeRate.toFixed(0)}%`}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Vérifié</span>
                  </div>
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 text-center">
                  Pourcentage de comptes vérifiés par e-mail
                </p>
              </div>

              {/* Progress Gauges */}
              <div className="space-y-4 py-5 border-b border-surface-200/60 dark:border-slate-800">
                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">Ration Administrateurs / Utilisateurs</span>
                    <span className="text-slate-900 dark:text-slate-200">{adminRate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${adminRate}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-500">Sécurité plateforme</span>
                    <span className="text-emerald-500">100% (SSL / JWT)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-full" />
                  </div>
                </div>
              </div>
            </div>

            {/* Health status visual indicators */}
            <div className="mt-4 pt-2">
              <h5 className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">État des services</h5>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-surface-200/30">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Serveur API (Nest)</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    En ligne
                  </span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl border border-surface-200/30">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Base de données</span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Connecté
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Fragment 2 (Right column - Users lists with tabbed fragments) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass p-6 border-surface-200/50">
            
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-surface-200/60 dark:border-slate-800">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-surface-200/60 dark:border-slate-800">
                <button
                  onClick={() => setActiveTab('users')}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'users'
                      ? "bg-white dark:bg-slate-800 text-brand-650 dark:text-brand-400 shadow-sm border border-surface-200/50"
                      : "text-slate-550 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Users className="w-3.5 h-3.5" />
                  Utilisateurs Simples ({loadingUsers ? '...' : usersMeta?.total ?? 0})
                </button>
                <button
                  onClick={() => setActiveTab('admins')}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    activeTab === 'admins'
                      ? "bg-white dark:bg-slate-800 text-brand-650 dark:text-brand-400 shadow-sm border border-surface-200/50"
                      : "text-slate-550 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Administrateurs ({loadingAdmins ? '...' : adminCount})
                </button>
              </div>

              {/* Dynamic Search per tab */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Rechercher par nom ou email..."
                  value={activeTab === 'users' ? searchUsers : searchAdmins}
                  onChange={(e) => {
                    if (activeTab === 'users') {
                      setSearchUsers(e.target.value);
                      setPageUsers(1);
                    } else {
                      setSearchAdmins(e.target.value);
                      setPageAdmins(1);
                    }
                  }}
                  className="w-full bg-card/65 border border-surface-200/60 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-500 transition-all"
                />
              </div>
            </div>

            {/* List Components (Fragments) */}
            <div className="mt-4">
              
              {/* Tab 1: Simple Users List */}
              {activeTab === 'users' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-surface-200/50 dark:border-slate-850 text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="pb-3 pt-2 pl-3">Profil</th>
                        <th className="pb-3 pt-2">Email</th>
                        <th className="pb-3 pt-2">Statut</th>
                        <th className="pb-3 pt-2">Inscrit le</th>
                        <th className="pb-3 pt-2 text-right pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-200/30 dark:divide-slate-850">
                      {loadingUsers ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-450">
                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Chargement des utilisateurs simples...
                          </td>
                        </tr>
                      ) : users.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-450">
                            Aucun utilisateur trouvé
                          </td>
                        </tr>
                      ) : (
                        users.map((user) => (
                          <tr key={user._id} className="hover:bg-slate-500/5 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3.5 pl-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 text-white flex items-center justify-center font-bold shadow-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="font-extrabold text-slate-900 dark:text-slate-100">{user.name}</span>
                              </div>
                            </td>
                            <td className="py-3.5 font-semibold text-slate-650 dark:text-slate-400">{user.email}</td>
                            <td className="py-3.5">
                              <button
                                onClick={() => handleToggleVerification(user)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors shadow-sm",
                                  user.isVerified
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                )}
                              >
                                <span className={cn("w-1 h-1 rounded-full", user.isVerified ? "bg-emerald-500" : "bg-amber-500")} />
                                {user.isVerified ? 'Vérifié' : 'En attente'}
                              </button>
                            </td>
                            <td className="py-3.5 font-bold text-slate-400">
                              {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-3.5 text-right pr-3">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => handleToggleRole(user)}
                                  title="Promouvoir en Admin"
                                  className="p-2 rounded-xl border border-surface-200 dark:border-slate-800 hover:border-brand-350 hover:bg-brand-500/10 dark:hover:bg-brand-500/10 text-slate-400 hover:text-brand-500 transition-all bg-card"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  title="Supprimer définitivement"
                                  className="p-2 rounded-xl border border-red-200 dark:border-slate-800/80 hover:border-red-500/50 hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-all bg-card"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Users Pagination */}
                  {usersMeta && usersMeta.pages > 1 && (
                    <div className="mt-4 pt-3 border-t border-surface-200/50 dark:border-slate-850 flex justify-between items-center text-[11px] text-slate-500 bg-transparent">
                      <div>
                        Page {pageUsers} sur {usersMeta.pages}
                      </div>
                      <div className="inline-flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={pageUsers === 1}
                          onClick={() => setPageUsers(pageUsers - 1)}
                          className="h-8 text-[10px] px-3.5 border-surface-200 dark:border-slate-800 bg-card rounded-xl text-slate-650"
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={pageUsers === usersMeta.pages}
                          onClick={() => setPageUsers(pageUsers + 1)}
                          className="h-8 text-[10px] px-3.5 border-surface-200 dark:border-slate-800 bg-card rounded-xl text-slate-650"
                        >
                          Suivant
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Admins List */}
              {activeTab === 'admins' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-surface-200/50 dark:border-slate-850 text-slate-400 font-extrabold uppercase tracking-wider">
                        <th className="pb-3 pt-2 pl-3">Profil</th>
                        <th className="pb-3 pt-2">Email</th>
                        <th className="pb-3 pt-2">Vérifié</th>
                        <th className="pb-3 pt-2">Inscrit le</th>
                        <th className="pb-3 pt-2 text-right pr-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-200/30 dark:divide-slate-850">
                      {loadingAdmins ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-450">
                            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            Chargement des administrateurs...
                          </td>
                        </tr>
                      ) : admins.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-10 text-slate-450">
                            Aucun administrateur trouvé
                          </td>
                        </tr>
                      ) : (
                        admins.map((user) => (
                          <tr key={user._id} className="hover:bg-slate-500/5 dark:hover:bg-slate-800/10 transition-colors">
                            <td className="py-3.5 pl-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center font-bold shadow-sm">
                                  {user.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col">
                                  <span className="font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    {user.name}
                                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/15 border border-violet-500/20 px-1.5 py-0.2 rounded-md">
                                      <Shield className="w-2.5 h-2.5" /> root
                                    </span>
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 font-semibold text-slate-650 dark:text-slate-400">{user.email}</td>
                            <td className="py-3.5">
                              <button
                                onClick={() => handleToggleVerification(user)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-colors shadow-sm",
                                  user.isVerified
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                                )}
                              >
                                <span className={cn("w-1 h-1 rounded-full", user.isVerified ? "bg-emerald-500" : "bg-amber-500")} />
                                {user.isVerified ? 'Vérifié' : 'En attente'}
                              </button>
                            </td>
                            <td className="py-3.5 font-bold text-slate-400">
                              {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="py-3.5 text-right pr-3">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => handleToggleRole(user)}
                                  title="Rétrograder en Utilisateur"
                                  className="p-2 rounded-xl border border-surface-200 dark:border-slate-800 hover:border-amber-350 hover:bg-amber-500/10 text-slate-400 hover:text-amber-500 transition-all bg-card"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  title="Supprimer définitivement"
                                  className="p-2 rounded-xl border border-red-200 dark:border-slate-800/80 hover:border-red-500/50 hover:bg-red-500/10 text-red-500 hover:text-red-600 transition-all bg-card"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Admins Pagination */}
                  {adminsMeta && adminsMeta.pages > 1 && (
                    <div className="mt-4 pt-3 border-t border-surface-200/50 dark:border-slate-850 flex justify-between items-center text-[11px] text-slate-500 bg-transparent">
                      <div>
                        Page {pageAdmins} sur {adminsMeta.pages}
                      </div>
                      <div className="inline-flex gap-2">
                        <Button
                          variant="secondary"
                          disabled={pageAdmins === 1}
                          onClick={() => setPageAdmins(pageAdmins - 1)}
                          className="h-8 text-[10px] px-3.5 border-surface-200 dark:border-slate-800 bg-card rounded-xl text-slate-650"
                        >
                          Précédent
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={pageAdmins === adminsMeta.pages}
                          onClick={() => setPageAdmins(pageAdmins + 1)}
                          className="h-8 text-[10px] px-3.5 border-surface-200 dark:border-slate-800 bg-card rounded-xl text-slate-650"
                        >
                          Suivant
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </Card>
        </div>
      </div>

      {/* MODAL: Creation of User / Admin */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Créer un compte utilisateur"
        className="max-w-md border border-surface-200/60 dark:border-slate-800"
      >
        {!createSuccessData ? (
          <form onSubmit={handleCreateUserSubmit} className="space-y-4">
            <Input
              label="Nom Complet"
              id="new-name"
              placeholder="Ex: Sophie Martin"
              value={newUserName}
              onChange={(e) => setNewUserName(e.target.value)}
              required
            />
            <Input
              label="Adresse Email"
              type="email"
              id="new-email"
              placeholder="collab@entreprise.fr"
              value={newUserEmail}
              onChange={(e) => setNewUserEmail(e.target.value)}
              required
            />
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Rôle système
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewUserRole('user')}
                  className={cn(
                    "py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    newUserRole === 'user'
                      ? "bg-brand-500/10 border-brand-500/30 text-brand-650 dark:text-brand-400"
                      : "bg-card border-surface-200 text-slate-500"
                  )}
                >
                  <Users className="w-3.5 h-3.5" /> Utilisateur simple
                </button>
                <button
                  type="button"
                  onClick={() => setNewUserRole('admin')}
                  className={cn(
                    "py-2.5 px-4 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                    newUserRole === 'admin'
                      ? "bg-violet-500/10 border-violet-500/30 text-violet-650 dark:text-violet-400"
                      : "bg-card border-surface-200 text-slate-500"
                  )}
                >
                  <Shield className="w-3.5 h-3.5" /> Administrateur
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Mot de passe
                </label>
                <button
                  type="button"
                  onClick={generateSecurePassword}
                  className="text-[10px] font-bold text-brand-650 dark:text-brand-400 hover:underline flex items-center gap-1"
                >
                  Générer aléatoirement
                </button>
              </div>
              <Input
                type="text"
                id="new-password"
                placeholder="Laisser vide pour mot de passe aléatoire"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
              />
            </div>

            {createError && (
              <div className="p-3 text-xs bg-red-500/10 border border-red-500/20 text-red-500 font-bold rounded-xl">
                {createError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3 border-t border-surface-200/50">
              <Button
                variant="secondary"
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-11 px-5 rounded-xl border-surface-200 bg-card text-slate-650"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                isLoading={isCreatingUser}
                className="btn-primary h-11 px-5 rounded-xl font-bold"
              >
                Enregistrer
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-white">Compte Créé avec Succès !</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                L'utilisateur a été ajouté à la base de données. Transmettez-lui ces identifiants sécurisés :
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/60 border border-surface-200/60 p-4 rounded-2xl space-y-3">
              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identifiant (Email)</span>
                <span className="block text-xs font-extrabold text-slate-800 dark:text-slate-200 mt-0.5">{createSuccessData.email}</span>
              </div>
              <div className="relative">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mot de passe temporaire</span>
                <div className="flex justify-between items-center mt-1 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-surface-200/50">
                  <span className="text-xs font-mono font-bold text-brand-600 dark:text-brand-400 tracking-wider">
                    {createSuccessData.pass}
                  </span>
                  <button
                    onClick={handleCopyPassword}
                    className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg text-slate-400 hover:text-slate-650 transition-colors"
                    title="Copier le mot de passe"
                  >
                    {copiedText ? <Check className="w-4.5 h-4.5 text-emerald-500" /> : <Copy className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <Button
                onClick={() => setIsCreateModalOpen(false)}
                className="btn-primary w-full h-11 justify-center rounded-xl"
              >
                Fermer la fenêtre
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* CONFIRM MODAL: Universal action confirm */}
      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title={confirmConfig?.title || 'Confirmation'}
        className="max-w-md border border-surface-200/60"
      >
        <div className="space-y-5">
          <p className="text-xs font-medium leading-relaxed text-slate-600 dark:text-slate-350">
            {confirmConfig?.message}
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-surface-200/50">
            <Button
              variant="secondary"
              onClick={() => {
                setIsConfirmOpen(false);
                setConfirmConfig(null);
              }}
              className="h-10 px-4 rounded-xl text-xs text-slate-650"
            >
              Annuler
            </Button>
            <Button
              variant={confirmConfig?.danger ? 'danger' : 'primary'}
              onClick={executeConfirmedAction}
              className={cn("h-10 px-4 rounded-xl text-xs font-bold", confirmConfig?.danger ? "btn-danger" : "btn-primary")}
            >
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
