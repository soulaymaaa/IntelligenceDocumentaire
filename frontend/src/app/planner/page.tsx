'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  X, 
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Circle,
  Bell,
  BellOff
} from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';

import { plannerApi } from '@/lib/api';

interface Task {
  _id: string;
  text: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
  reminderAt?: string;
}

const CircularProgress = ({ percentage, size = 60, strokeWidth = 6, className, label }: { percentage: number, size?: number, strokeWidth?: number, className?: string, label?: string }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg className="rotate-[-90deg] transition-all duration-500" width={size} height={size}>
        {/* Background Circle */}
        <circle
          className="text-slate-100 dark:text-slate-800/50"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Circle */}
        <circle
          className="text-brand-600 dark:text-brand-400 transition-all duration-1000 ease-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 leading-none">{percentage}%</span>
        {label && <span className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

export default function PlannerPage() {
  const { language, copy } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const locale = language === 'fr' ? fr : enUS;

  // Load tasks from API on mount
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await plannerApi.getTasks();
        setTasks(data);
      } catch (error) {
        console.error("Failed to fetch tasks", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const onDateClick = (day: Date) => {
    setSelectedDate(day);
    setIsModalOpen(true);
    // Focus input after a short delay to allow modal to animate
    setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
  };

  const addTask = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newTaskText.trim()) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      const newTask = await plannerApi.createTask({
        text: newTaskText,
        date: dateStr,
      });
      setTasks([...tasks, newTask]);
      setNewTaskText('');
    } catch (error) {
      console.error("Failed to create task", error);
    }
  };

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t._id === id);
    if (!task) return;

    try {
      const updatedTask = await plannerApi.updateTask(id, { completed: !task.completed });
      setTasks(tasks.map(t => t._id === id ? updatedTask : t));
    } catch (error) {
      console.error("Failed to update task", error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await plannerApi.deleteTask(id);
      setTasks(tasks.filter(t => t._id !== id));
    } catch (error) {
      console.error("Failed to delete task", error);
    }
  };

  const updateTaskReminder = async (id: string, reminderAt: string | null) => {
    try {
      const updatedTask = await plannerApi.updateTask(id, { reminderAt });
      setTasks(tasks.map(t => t._id === id ? updatedTask : t));
    } catch (error) {
      console.error("Failed to update reminder", error);
    }
  };

  const selectedDateTasks = tasks.filter(task => 
    task.date === format(selectedDate, 'yyyy-MM-dd')
  );

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'].map((day, i) => {
    if (language === 'en') {
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i];
    }
    return day;
  });

  return (
    <AppLayout minimalTopBar={true}>
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            {copy.settings.calendar.title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {copy.settings.calendar.description}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Calendar Column */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <Card className="p-0 overflow-hidden border-none shadow-xl bg-white dark:bg-slate-900">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-brand-600 text-white">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-extrabold capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale })}
                  </h2>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={prevMonth}
                    className="w-8 h-8 p-0 rounded-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={nextMonth}
                    className="w-8 h-8 p-0 rounded-full bg-white/10 border-white/20 hover:bg-white/20 text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-800">
                {weekDays.map((day) => (
                  <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, idx) => {
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const isToday = isSameDay(day, new Date());
                  const dayTasks = tasks.filter(t => t.date === format(day, 'yyyy-MM-dd'));

                  return (
                    <div
                      key={day.toString()}
                      onClick={() => onDateClick(day)}
                      className={cn(
                        "relative h-20 sm:h-24 border-r border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-all duration-200 group",
                        !isCurrentMonth && "bg-slate-50/30 dark:bg-slate-900/20",
                        isSelected && "bg-brand-50/50 dark:bg-brand-500/10 ring-2 ring-inset ring-brand-500/20 z-10",
                        idx % 7 === 6 && "border-r-0"
                      )}
                    >
                      <div className="absolute top-2 left-2 flex flex-col gap-1">
                        <span className={cn(
                          "flex items-center justify-center w-6 h-6 text-xs font-bold rounded-lg transition-all",
                          isToday && !isSelected && "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400",
                          isSelected && "bg-brand-600 text-white shadow-md shadow-brand-500/30",
                          !isToday && !isSelected && isCurrentMonth && "text-slate-700 dark:text-slate-300 group-hover:text-brand-600",
                          !isCurrentMonth && "text-slate-300 dark:text-slate-600"
                        )}>
                          {format(day, 'd')}
                        </span>
                      </div>

                      {/* Task Indicators */}
                      <div className="absolute bottom-2 left-2 right-2 flex flex-wrap gap-1 max-h-12 overflow-hidden">
                        {dayTasks.slice(0, 6).map(task => (
                          <div 
                            key={task._id} 
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              task.completed ? "bg-emerald-400 dark:bg-emerald-500" : "bg-brand-400 dark:bg-brand-500"
                            )}
                          />
                        ))}
                        {dayTasks.length > 6 && (
                          <span className="text-[8px] font-black text-slate-400">+{dayTasks.length - 6}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Stats Column */}
          <div className="lg:col-span-4 flex flex-col">
            <Card className="p-8 bg-white dark:bg-slate-900 border-none shadow-xl flex flex-col items-center justify-between h-full">
              {/* Monthly Stats */}
              {(() => {
                const currentMonthStr = format(currentMonth, 'yyyy-MM');
                const monthlyTasks = tasks.filter(t => t.date.startsWith(currentMonthStr));
                const completedCount = monthlyTasks.filter(t => t.completed).length;
                const percentage = monthlyTasks.length > 0 ? Math.round((completedCount / monthlyTasks.length) * 100) : 0;
                
                return (
                  <div className="flex flex-col items-center gap-4 group">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-brand-500 transition-colors">Progression Mensuelle</h3>
                    <div className="relative p-2 rounded-full bg-slate-50 dark:bg-slate-800/50 shadow-inner">
                      <CircularProgress 
                        percentage={percentage} 
                        size={140} 
                        strokeWidth={12} 
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{completedCount} / {monthlyTasks.length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tâches terminées</p>
                    </div>
                  </div>
                );
              })()}

              {/* Today Stats */}
              {(() => {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const todayTasks = tasks.filter(t => t.date === todayStr);
                const completedCount = todayTasks.filter(t => t.completed).length;
                const percentage = todayTasks.length > 0 ? Math.round((completedCount / todayTasks.length) * 100) : 0;

                return (
                  <div className="flex flex-col items-center gap-4 group">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-emerald-500 transition-colors">Aujourd'hui</h3>
                    <div className="relative p-2 rounded-full bg-slate-50 dark:bg-slate-800/50 shadow-inner">
                      <CircularProgress 
                        percentage={percentage} 
                        size={140} 
                        strokeWidth={12}
                        className="text-emerald-500"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{completedCount} / {todayTasks.length}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Objectifs atteints</p>
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>
        </div>

        {/* Task Modal */}
        <Modal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          title={isSameDay(selectedDate, new Date()) ? "Tâches d'aujourd'hui" : format(selectedDate, 'EEEE d MMMM', { locale })}
          className="max-w-2xl"
        >
          <div className="flex flex-col gap-6">
            <form onSubmit={addTask} className="flex gap-2">
              <Input
                ref={inputRef}
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                placeholder={copy.settings.calendar.taskPlaceholder}
                className="flex-1 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-brand-500/20"
              />
              <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 shadow-lg shadow-brand-500/20">
                <Plus className="w-5 h-5" />
              </Button>
            </form>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {selectedDateTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                  <Clock className="w-12 h-12 mb-4" />
                  <p className="font-bold">{copy.settings.calendar.noTasks}</p>
                </div>
              ) : (
                selectedDateTasks.map(task => (
                  <div 
                    key={task._id}
                    className={cn(
                      "group flex items-center gap-4 p-4 rounded-2xl border transition-all duration-200",
                      task.completed 
                        ? "bg-emerald-50/30 dark:bg-emerald-500/5 border-emerald-100/50 dark:border-emerald-500/10" 
                        : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-brand-200 dark:hover:border-brand-500/30"
                    )}
                  >
                    <button 
                      onClick={() => toggleTask(task._id)}
                      className={cn(
                        "transition-transform active:scale-90",
                        task.completed ? "text-emerald-500" : "text-slate-300 dark:text-slate-600 hover:text-brand-500"
                      )}
                    >
                      {task.completed ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                    </button>
                    
                    <span className={cn(
                      "flex-1 font-semibold text-sm transition-all",
                      task.completed ? "text-slate-400 line-through decoration-emerald-500/30" : "text-slate-700 dark:text-slate-200"
                    )}>
                      {task.text}
                      {task.reminderAt && !task.completed && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-brand-500 font-bold uppercase tracking-tighter">
                          <Bell className="w-3 h-3" />
                          Rappel le {format(new Date(task.reminderAt), 'd MMM à HH:mm', { locale })}
                        </div>
                      )}
                    </span>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <div className="relative">
                        <input 
                          type="datetime-local" 
                          className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8"
                          onChange={(e) => updateTaskReminder(task._id, e.target.value)}
                        />
                        <button className={cn(
                          "p-2 rounded-lg transition-all",
                          task.reminderAt ? "text-brand-500 bg-brand-50 dark:bg-brand-500/10" : "text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
                        )}>
                          {task.reminderAt ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                        </button>
                      </div>

                      <button 
                        onClick={() => deleteTask(task._id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
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
