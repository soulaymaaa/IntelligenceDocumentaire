'use client';

import React, { useState, useEffect } from 'react';
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
  Circle
} from 'lucide-react';
import { useLanguage } from '@/providers/LanguageProvider';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

import { plannerApi } from '@/lib/api';

interface Task {
  _id: string;
  text: string;
  completed: boolean;
  date: string; // YYYY-MM-DD
}

export default function PlannerPage() {
  const { language, copy } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isLoading, setIsLoading] = useState(true);

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
          <div className="lg:col-span-7 flex flex-col gap-4">
            <Card className="p-0 overflow-hidden border-none shadow-xl bg-white dark:bg-slate-900">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-brand-600 text-white">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-extrabold capitalize">
                    {format(currentMonth, 'MMMM yyyy', { locale })}
                  </h2>
                  
                  {/* Compact Monthly Stat (Embedded in header) */}
                  {(() => {
                    const currentMonthStr = format(currentMonth, 'yyyy-MM');
                    const monthlyTasks = tasks.filter(t => t.date.startsWith(currentMonthStr));
                    if (monthlyTasks.length === 0) return null;
                    const completedCount = monthlyTasks.filter(t => t.completed).length;
                    const percentage = Math.round((completedCount / monthlyTasks.length) * 100);
                    return (
                      <div className="hidden sm:flex items-center gap-3 px-3 py-1 bg-white/10 rounded-lg border border-white/10">
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-80">{percentage}%</span>
                        <div className="w-12 h-1 bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white transition-all duration-1000" style={{ width: `${percentage}%` }} />
                        </div>
                      </div>
                    );
                  })()}
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

              {/* Compact Monthly Details (Optional/Reduced) */}
              {(() => {
                const currentMonthStr = format(currentMonth, 'yyyy-MM');
                const monthlyTasks = tasks.filter(t => t.date.startsWith(currentMonthStr));
                if (monthlyTasks.length === 0) return null;

                const completedCount = monthlyTasks.filter(t => t.completed).length;
                const uncompletedCount = monthlyTasks.length - completedCount;

                return (
                  <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <span>{copy.settings.calendar.monthlyProgress}</span>
                    <div className="flex gap-4">
                      <span>{copy.settings.calendar.completed}: <span className="text-emerald-500 font-black">{completedCount}</span></span>
                      <span>{copy.settings.calendar.remaining}: <span className="text-brand-500 font-black">{uncompletedCount}</span></span>
                    </div>
                  </div>
                );
              })()}

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
                        "relative h-16 sm:h-20 border-r border-b border-slate-50 dark:border-slate-800/50 cursor-pointer transition-all duration-200 group",
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
                      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap gap-1 max-h-8 overflow-hidden">
                        {dayTasks.slice(0, 4).map(task => (
                          <div 
                            key={task._id} 
                            className={cn(
                              "w-full h-1 rounded-full",
                              task.completed ? "bg-emerald-400 dark:bg-emerald-500/50" : "bg-brand-400 dark:bg-brand-500/50"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Tasks Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <Card className="p-6 flex flex-col gap-6 h-full bg-white dark:bg-slate-900 border-none shadow-xl">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider text-xs">
                  <CalendarIcon className="w-4 h-4" />
                  {isSameDay(selectedDate, new Date()) ? copy.settings.calendar.today : format(selectedDate, 'EEEE d MMMM', { locale })}
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  {selectedDateTasks.length} {selectedDateTasks.length === 1 ? 'tâche' : 'tâches'}
                </h3>
              </div>

              {/* Progress Section */}
              {selectedDateTasks.length > 0 && (
                <div className="p-4 rounded-2xl bg-brand-50/30 dark:bg-brand-500/5 border border-brand-100/50 dark:border-brand-500/10">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase tracking-widest text-brand-600 dark:text-brand-400">
                          {copy.settings.calendar.progress}
                        </p>
                        <span className="text-[10px] font-bold text-slate-500">
                          {selectedDateTasks.filter(t => t.completed).length}/{selectedDateTasks.length}
                        </span>
                      </div>
                      <div className="relative h-2 w-full bg-slate-200/50 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-brand-600 dark:bg-brand-500 transition-all duration-700 ease-out"
                          style={{ width: `${(selectedDateTasks.filter(t => t.completed).length / selectedDateTasks.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center min-w-[56px] h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                      <p className="text-lg font-black text-slate-900 dark:text-slate-100 leading-none">
                        {Math.round((selectedDateTasks.filter(t => t.completed).length / selectedDateTasks.length) * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={addTask} className="flex gap-2">
                <Input
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder={copy.settings.calendar.taskPlaceholder}
                  className="flex-1 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700"
                />
                <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl px-4 shadow-lg shadow-brand-500/20">
                  <Plus className="w-5 h-5" />
                </Button>
              </form>

              <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px]">
                {isLoading ? (
                   <div className="flex items-center justify-center h-full">
                     <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600"></div>
                   </div>
                ) : selectedDateTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 px-6">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center mb-4">
                      <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 font-medium">
                      {copy.settings.calendar.noTasks}
                    </p>
                  </div>
                ) : (
                  selectedDateTasks.map(task => (
                    <div 
                      key={task._id}
                      className={cn(
                        "group flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200",
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
                      </span>

                      <button 
                        onClick={() => deleteTask(task._id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
