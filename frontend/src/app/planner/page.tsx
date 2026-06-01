'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
  BarChart3,
  Bell,
  BellOff,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  FileSpreadsheet,
  Pencil,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLayout } from '@/components/layout/AppLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useLanguage } from '@/providers/LanguageProvider';
import { plannerApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type Priority = 'low' | 'medium' | 'high';

interface Task {
  _id: string;
  text: string;
  completed: boolean;
  date: string;
  startDate?: string;
  endDate?: string;
  priority?: Priority;
  category?: string;
  source?: 'manual' | 'excel';
  reminderAt?: string;
}

interface PlannerStats {
  total: number;
  completed: number;
  activeToday: number;
  monthly: number;
  overdue: number;
  completionRate: number;
  byPriority: Array<{ priority: Priority; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  byMonth: Array<{ month: string; total: number; completed: number }>;
}

const emptyStats: PlannerStats = {
  total: 0,
  completed: 0,
  activeToday: 0,
  monthly: 0,
  overdue: 0,
  completionRate: 0,
  byPriority: [],
  byCategory: [],
  byMonth: [],
};

const priorityLabels: Record<Priority, string> = {
  low: 'Basse',
  medium: 'Normale',
  high: 'Haute',
};

const priorityClasses: Record<Priority, string> = {
  low: 'bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  high: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300',
};

const chartColors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6'];

const getTaskStart = (task: Task) => task.startDate || task.date;
const getTaskEnd = (task: Task) => task.endDate || task.date;
const toDateInput = (date: Date) => format(date, 'yyyy-MM-dd');

const taskTouchesDay = (task: Task, day: Date) => {
  const dayKey = toDateInput(day);
  return getTaskStart(task) <= dayKey && getTaskEnd(task) >= dayKey;
};

const getTaskDayMarker = (task: Task, day: Date) => {
  const dayKey = toDateInput(day);
  const startDate = getTaskStart(task);
  const endDate = getTaskEnd(task);

  if (startDate === endDate && dayKey === startDate) return '';
  if (dayKey === startDate) return 'Debut';
  if (dayKey === endDate) return 'Fin';
  return null;
};

export default function PlannerPage() {
  const { language, copy } = useLanguage();
  const locale = language === 'fr' ? fr : enUS;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<PlannerStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState('');
  const [form, setForm] = useState({
    text: '',
    startDate: toDateInput(new Date()),
    endDate: toDateInput(new Date()),
    priority: 'medium' as Priority,
    category: '',
  });

  const loadPlanner = async () => {
    const [taskData, statsData] = await Promise.all([
      plannerApi.getTasks(),
      plannerApi.getStats(),
    ]);
    setTasks(taskData);
    setStats(statsData);
  };

  useEffect(() => {
    loadPlanner()
      .catch((error) => console.error('Failed to load planner', error))
      .finally(() => setIsLoading(false));
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 }),
  });

  const selectedDateTasks = useMemo(
    () => tasks.filter((task) => taskTouchesDay(task, selectedDate)),
    [tasks, selectedDate]
  );

  const monthTasks = useMemo(() => {
    const monthKey = format(currentMonth, 'yyyy-MM');
    return tasks.filter((task) => getTaskStart(task).startsWith(monthKey) || getTaskEnd(task).startsWith(monthKey));
  }, [currentMonth, tasks]);

  const upcomingTasks = useMemo(() => {
    const today = toDateInput(new Date());
    return tasks
      .filter((task) => !task.completed && getTaskEnd(task) >= today)
      .sort((a, b) => getTaskEnd(a).localeCompare(getTaskEnd(b)))
      .slice(0, 5);
  }, [tasks]);

  const statCards = [
    { label: 'Total', value: stats.total, icon: FileSpreadsheet },
    { label: 'Terminees', value: stats.completed, icon: CheckCircle2 },
    { label: "Aujourd'hui", value: stats.activeToday, icon: CalendarIcon },
    { label: 'Ce mois', value: stats.monthly, icon: BarChart3 },
    { label: 'En retard', value: stats.overdue, icon: Bell },
    { label: 'Progression', value: `${stats.completionRate}%`, icon: Circle },
  ];

  const resetForm = (date = selectedDate) => {
    const dateKey = toDateInput(date);
    setForm({ text: '', startDate: dateKey, endDate: dateKey, priority: 'medium', category: '' });
    setEditingId(null);
  };

  const openDay = (day: Date) => {
    setSelectedDate(day);
    resetForm(day);
    setIsModalOpen(true);
  };

  const editTask = (task: Task) => {
    setEditingId(task._id);
    setForm({
      text: task.text,
      startDate: getTaskStart(task),
      endDate: getTaskEnd(task),
      priority: task.priority || 'medium',
      category: task.category || '',
    });
  };

  const saveTask = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!form.text.trim() || form.startDate > form.endDate) return;

    setIsSaving(true);
    try {
      if (editingId) {
        const updated = await plannerApi.updateTask(editingId, form);
        setTasks((prev) => prev.map((task) => (task._id === editingId ? updated : task)));
      } else {
        const created = await plannerApi.createTask(form);
        setTasks((prev) => [...prev, created]);
      }
      resetForm();
      const freshStats = await plannerApi.getStats();
      setStats(freshStats);
    } catch (error) {
      console.error('Failed to save task', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      const updated = await plannerApi.updateTask(task._id, { completed: !task.completed });
      setTasks((prev) => prev.map((item) => (item._id === task._id ? updated : item)));
      setStats(await plannerApi.getStats());
    } catch (error) {
      console.error('Failed to update task', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await plannerApi.deleteTask(id);
      setTasks((prev) => prev.filter((task) => task._id !== id));
      setStats(await plannerApi.getStats());
    } catch (error) {
      console.error('Failed to delete task', error);
    }
  };

  const updateTaskReminder = async (task: Task, reminderAt: string | null) => {
    try {
      const updated = await plannerApi.updateTask(task._id, { reminderAt });
      setTasks((prev) => prev.map((item) => (item._id === task._id ? updated : item)));
    } catch (error) {
      console.error('Failed to update reminder', error);
    }
  };

  const importExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportMessage('');
    try {
      const result = await plannerApi.importExcel(file);
      await loadPlanner();
      setImportMessage(`${result.importedCount} taches importees depuis Excel`);
      if (result.tasks?.[0]?.startDate) setCurrentMonth(parseISO(result.tasks[0].startDate));
    } catch (error: any) {
      setImportMessage(error?.response?.data?.message || 'Import Excel impossible');
    } finally {
      setIsImporting(false);
      event.target.value = '';
    }
  };

  const downloadTemplate = async () => {
    try {
      const blob = await plannerApi.downloadTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'modele_planning_pfe.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download planner template', error);
      setImportMessage('Impossible de telecharger le modele Excel');
    }
  };

  const weekDays = language === 'en'
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    : ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

  return (
    <AppLayout minimalTopBar={true}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {copy.settings.calendar.title}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Planification des taches issues des fichiers Excel et suivi des delais.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={importExcel}
            />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} isLoading={isImporting}>
              <Upload className="w-4 h-4" />
              Import Excel
            </Button>
            <Button variant="secondary" onClick={downloadTemplate}>
              <Download className="w-4 h-4" />
              Modele Excel
            </Button>
            <Button onClick={() => openDay(new Date())}>
              <Plus className="w-4 h-4" />
              Nouvelle tache
            </Button>
          </div>
        </div>

        {importMessage && (
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
            {importMessage}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {statCards.map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                  <p className="mt-1 text-2xl font-black text-slate-900 dark:text-slate-100">{value}</p>
                </div>
                <Icon className="h-5 w-5 text-brand-500" />
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 flex flex-col gap-4">
            <Card className="p-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-lg font-extrabold capitalize text-slate-900 dark:text-slate-100">
                  {format(currentMonth, 'MMMM yyyy', { locale })}
                </h2>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="h-9 w-9 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="h-9 w-9 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const dayTasks = tasks
                    .map((task) => ({ task, marker: getTaskDayMarker(task, day) }))
                    .filter((item): item is { task: Task; marker: string } => item.marker !== null);
                  const activeTasks = tasks.filter((task) => taskTouchesDay(task, day));
                  const openTasks = activeTasks.filter((task) => !task.completed);
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, currentMonth);

                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => openDay(day)}
                      className={cn(
                        'relative flex h-28 flex-col border-b border-r border-slate-100 p-2 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40',
                        index % 7 === 6 && 'border-r-0',
                        !isCurrentMonth && 'bg-slate-50/50 opacity-60 dark:bg-slate-950/40',
                        isSelected && 'ring-2 ring-inset ring-brand-500/30'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-md text-xs font-black',
                          isToday ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-slate-300'
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                      <div className="mt-2 flex flex-col gap-1 overflow-hidden">
                        {dayTasks.slice(0, 3).map(({ task, marker }) => (
                          <span
                            key={task._id}
                            title={`${marker ? `${marker}: ` : ''}${task.text}`}
                            className={cn(
                              'truncate rounded px-1.5 py-0.5 text-[10px] font-bold',
                              task.completed
                                ? 'bg-emerald-100 text-emerald-700 line-through dark:bg-emerald-500/10 dark:text-emerald-300'
                                : priorityClasses[task.priority || 'medium']
                            )}
                          >
                            {marker ? `${marker}: ${task.text}` : task.text}
                          </span>
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="text-[10px] font-black text-slate-400">+{dayTasks.length - 3}</span>
                        )}
                      </div>
                      {openTasks.length > 0 && (
                        <span className="absolute bottom-2 right-2 rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white dark:bg-slate-100 dark:text-slate-900">
                          {openTasks.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Evolution mensuelle</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis allowDecimals={false} fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" name="Terminees" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Repartition par categorie</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stats.byCategory} dataKey="count" nameKey="category" outerRadius={86} label>
                        {stats.byCategory.map((_, index) => (
                          <Cell key={index} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          <aside className="xl:col-span-4 flex flex-col gap-4">
            <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Priorites</h3>
              <div className="space-y-3">
                {stats.byPriority.map((item) => (
                  <div key={item.priority} className="flex items-center justify-between gap-3">
                    <Badge className={cn('border-0', priorityClasses[item.priority])}>{priorityLabels[item.priority]}</Badge>
                    <div className="h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-2 rounded-full bg-brand-600"
                        style={{ width: `${stats.total ? Math.round((item.count / stats.total) * 100) : 0}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-sm font-black text-slate-700 dark:text-slate-200">{item.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <h3 className="mb-4 text-sm font-black uppercase tracking-widest text-slate-500">Prochaines echeances</h3>
              <div className="space-y-3">
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm font-semibold text-slate-400">Aucune tache ouverte</p>
                ) : (
                  upcomingTasks.map((task) => (
                    <div key={task._id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{task.text}</p>
                        <Badge className={cn('border-0', priorityClasses[task.priority || 'medium'])}>
                          {priorityLabels[task.priority || 'medium']}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {getTaskStart(task)} - {getTaskEnd(task)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <h3 className="mb-3 text-sm font-black uppercase tracking-widest text-slate-500">Format Excel</h3>
              <p className="mb-4 text-sm font-medium leading-relaxed text-slate-500 dark:text-slate-400">
                Utilisez le modele pour eviter les erreurs d'import. Les colonnes supplementaires sont autorisees.
              </p>
              <div className="grid grid-cols-1 gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">tache</span>
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">date_debut</span>
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">date_fin</span>
                <span className="rounded bg-slate-100 px-2 py-1 dark:bg-slate-800">priorite, categorie</span>
              </div>
              <Button variant="secondary" size="sm" className="mt-4 w-full justify-center" onClick={downloadTemplate}>
                <Download className="w-4 h-4" />
                Telecharger le modele
              </Button>
            </Card>
          </aside>
        </div>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={format(selectedDate, 'EEEE d MMMM yyyy', { locale })}
          className="max-w-4xl"
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
            <form onSubmit={saveTask} className="lg:col-span-2 space-y-4">
              <Input
                value={form.text}
                onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
                placeholder={copy.settings.calendar.taskPlaceholder}
                label="Tache"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="date"
                  label="Debut"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                />
                <Input
                  type="date"
                  label="Fin prevue"
                  value={form.endDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  error={form.startDate > form.endDate ? 'Date invalide' : undefined}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Priorite</label>
                  <select
                    value={form.priority}
                    onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value as Priority }))}
                    className="input-base"
                  >
                    <option value="low">Basse</option>
                    <option value="medium">Normale</option>
                    <option value="high">Haute</option>
                  </select>
                </div>
                <Input
                  label="Categorie"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  placeholder="OCR, RAG, rapport..."
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" isLoading={isSaving} disabled={form.startDate > form.endDate}>
                  {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {editingId ? 'Enregistrer' : 'Ajouter'}
                </Button>
                {editingId && (
                  <Button type="button" variant="secondary" onClick={() => resetForm()}>
                    <X className="w-4 h-4" />
                    Annuler
                  </Button>
                )}
              </div>
            </form>

            <div className="lg:col-span-3 max-h-[520px] overflow-y-auto pr-1 space-y-3">
              {isLoading || selectedDateTasks.length === 0 ? (
                <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm font-bold text-slate-400 dark:border-slate-800">
                  {isLoading ? 'Chargement...' : copy.settings.calendar.noTasks}
                </div>
              ) : (
                selectedDateTasks.map((task) => (
                  <div
                    key={task._id}
                    className={cn(
                      'rounded-xl border p-4 transition-colors',
                      task.completed
                        ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-500/10 dark:bg-emerald-500/5'
                        : 'border-slate-100 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-800/30'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button onClick={() => toggleTask(task)} className="mt-0.5 text-slate-400 hover:text-brand-600">
                        {task.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Circle className="h-5 w-5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn('font-bold text-slate-800 dark:text-slate-100', task.completed && 'line-through text-slate-400')}>
                            {task.text}
                          </p>
                          <Badge className={cn('border-0', priorityClasses[task.priority || 'medium'])}>
                            {priorityLabels[task.priority || 'medium']}
                          </Badge>
                          {task.source === 'excel' && <Badge className="border-0 bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Excel</Badge>}
                        </div>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {getTaskStart(task)} - {getTaskEnd(task)}
                          {task.category ? ` | ${task.category}` : ''}
                        </p>
                        {task.reminderAt && !task.completed && (
                          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-brand-600">
                            <Bell className="h-3.5 w-3.5" />
                            {format(new Date(task.reminderAt), 'd MMM HH:mm', { locale })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="relative">
                          <input
                            type="datetime-local"
                            className="absolute inset-0 h-8 w-8 cursor-pointer opacity-0"
                            onChange={(event) => updateTaskReminder(task, event.target.value)}
                          />
                          <button className="rounded-lg p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10">
                            {task.reminderAt ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                          </button>
                        </div>
                        <button onClick={() => editTask(task)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteTask(task._id)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
}
