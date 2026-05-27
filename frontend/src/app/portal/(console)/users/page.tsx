'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminPortalApi } from '@/lib/api';
import type { User, PaginationMeta } from '@/types';
import { Search, Shield, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await adminPortalApi.getUsers({ page, limit: 10, search });
      setUsers(data.users);
      setMeta(data.meta);
    } catch (err: any) {
      setError('Erreur lors du chargement des utilisateurs');
    } finally {
      setIsLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleRole = async (user: User) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    if (!confirm(`Changer le rôle de ${user.name} en ${nextRole} ?`)) return;

    try {
      const res = await adminPortalApi.updateUser(user._id, { role: nextRole });
      setUsers(users.map((u) => (u._id === user._id ? res.user : u)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleToggleVerification = async (user: User) => {
    const nextVerified = !user.isVerified;
    try {
      const res = await adminPortalApi.updateUser(user._id, { isVerified: nextVerified });
      setUsers(users.map((u) => (u._id === user._id ? res.user : u)));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement ${user.name} (${user.email}) ?`)) return;
    try {
      await adminPortalApi.deleteUser(user._id);
      setUsers(users.filter((u) => u._id !== user._id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Utilisateurs</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Gérez les comptes utilisateurs, affectez des droits et modifiez les statuts.</p>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-card border border-surface-200 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 transition-all"
          />
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-650 dark:text-red-400 text-sm font-bold">
          {error}
        </div>
      )}

      {/* Users Card Table - Styled like User Dashboard Cards */}
      <Card className="border-surface-200 overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-slate-400 dark:text-slate-500 text-xs uppercase tracking-wider font-extrabold">
                <th className="px-6 py-4">Nom / Email</th>
                <th className="px-6 py-4">Rôle</th>
                <th className="px-6 py-4">Vérifié</th>
                <th className="px-6 py-4">Créé le</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="hover:bg-surface-50/50 dark:hover:bg-surface-500/5 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-slate-100">{user.name}</div>
                        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        user.role === 'admin' 
                          ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {user.role === 'admin' ? (
                          <>
                            <Shield className="w-3 h-3" /> Admin
                          </>
                        ) : 'Utilisateur'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => handleToggleVerification(user)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold transition-colors ${
                          user.isVerified 
                            ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-150 dark:border-green-500/20 hover:bg-green-100/50' 
                            : 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-750 dark:text-yellow-400 border border-yellow-150 dark:border-yellow-500/20 hover:bg-yellow-100/50'
                        }`}
                      >
                        {user.isVerified ? 'Vérifié' : 'Non vérifié'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={() => handleToggleRole(user)}
                          title="Changer le rôle"
                          className="p-1.5 rounded-lg border border-surface-200 hover:border-brand-350 hover:text-brand-600 transition-colors bg-card"
                        >
                          <ShieldAlert className="w-4 h-4 text-slate-400 hover:text-brand-650" />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user)}
                          title="Supprimer"
                          className="p-1.5 rounded-lg border border-red-150 hover:bg-red-50 dark:hover:bg-red-500/15 text-red-550 transition-colors bg-card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.pages > 1 && (
          <div className="px-6 py-4 border-t border-surface-200 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 bg-surface-50">
            <div>
              Page {page} sur {meta.pages}
            </div>
            <div className="inline-flex gap-2">
              <Button
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="h-8 text-[11px] px-3 border-surface-200 bg-card text-slate-600 dark:text-slate-300"
              >
                Précédent
              </Button>
              <Button
                variant="secondary"
                disabled={page === meta.pages}
                onClick={() => setPage(page + 1)}
                className="h-8 text-[11px] px-3 border-surface-200 bg-card text-slate-600 dark:text-slate-300"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
