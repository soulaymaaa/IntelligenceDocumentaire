import { Request, Response } from 'express';
import { PlannerTask } from './planner.model';
import { logger } from '../../utils/logger';
import * as XLSX from 'xlsx';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const REQUIRED_COLUMNS = ['tache', 'date_debut', 'date_fin'];
const COLUMN_ALIASES = {
  text: ['tache', 'titre', 'task', 'nom', 'description'],
  startDate: ['date_debut', 'debut', 'start_date'],
  endDate: ['date_fin', 'fin', 'end_date', 'deadline', 'echeance'],
};

const normalizeKey = (value: string) =>
  value
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_');

const toDateString = (value: unknown): string | null => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const date = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    return date.toISOString().slice(0, 10);
  }

  const raw = value.toString().trim();
  if (!raw) return null;

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const frMatch = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const normalizePriority = (value: unknown): 'low' | 'medium' | 'high' => {
  const priority = (value || '').toString().trim().toLowerCase();
  if (['high', 'haute', 'urgent', 'elevee', 'élevée'].includes(priority)) return 'high';
  if (['low', 'basse', 'faible'].includes(priority)) return 'low';
  return 'medium';
};

const hasAnyColumn = (row: Record<string, unknown>, aliases: string[]) =>
  aliases.some((alias) => normalizeKey(alias) in row);

const getFirstValue = (row: Record<string, unknown>, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== '') return value;
  }
  return '';
};

export const getTasks = async (req: any, res: Response) => {
  try {
    const tasks = await PlannerTask.find({ userId: req.userId }).sort({ startDate: 1, endDate: 1, createdAt: -1 });
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Error fetching tasks' });
  }
};

export const createTask = async (req: any, res: Response) => {
  try {
    const { text, date, startDate, endDate, reminderAt, priority, category } = req.body;
    const normalizedStartDate = startDate || date;
    const normalizedEndDate = endDate || date || startDate;

    if (!text || !normalizedStartDate || !normalizedEndDate) {
      return res.status(400).json({ success: false, message: 'Task text, start date and end date are required' });
    }

    if (normalizedStartDate > normalizedEndDate) {
      return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date' });
    }

    const task = new PlannerTask({
      userId: req.userId,
      text,
      date: normalizedEndDate,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      priority: priority || 'medium',
      category,
      source: 'manual',
      reminderAt: reminderAt ? new Date(reminderAt) : undefined,
    });
    await task.save();
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error('Error creating task:', error);
    res.status(500).json({ success: false, message: 'Error creating task' });
  }
};

export const updateTask = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { text, completed, date, startDate, endDate, reminderAt, priority, category } = req.body;
    const existingTask = await PlannerTask.findOne({ _id: id, userId: req.userId });

    if (!existingTask) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const nextStartDate = startDate ?? date ?? existingTask.startDate ?? existingTask.date;
    const nextEndDate = endDate ?? date ?? existingTask.endDate ?? existingTask.date;

    if (nextStartDate > nextEndDate) {
      return res.status(400).json({ success: false, message: 'Start date must be before or equal to end date' });
    }

    const updateData: any = {
      startDate: nextStartDate,
      endDate: nextEndDate,
      date: nextEndDate,
    };
    if (text !== undefined) updateData.text = text;
    if (completed !== undefined) updateData.completed = completed;
    if (priority !== undefined) updateData.priority = priority;
    if (category !== undefined) updateData.category = category;
    if (reminderAt !== undefined) {
      updateData.reminderAt = reminderAt ? new Date(reminderAt) : null;
      if (reminderAt) updateData.reminderSent = false; // Reset if date changed
    }

    const task = await PlannerTask.findOneAndUpdate(
      { _id: id, userId: req.userId },
      updateData,
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error('Error updating task:', error);
    res.status(500).json({ success: false, message: 'Error updating task' });
  }
};

export const importTasksFromExcel = async (req: any, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;

  try {
    if (!file) {
      return res.status(400).json({ success: false, message: 'Excel file is required' });
    }

    const workbook = XLSX.readFile(file.path, { cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Excel file is empty' });
    }

    const normalizedRows = rows.map((row) => {
      const normalized: Record<string, unknown> = {};
      Object.entries(row).forEach(([key, value]) => {
        normalized[normalizeKey(key)] = value;
      });
      return normalized;
    });

    const firstRow = normalizedRows[0];
    const missingColumns = [
      !hasAnyColumn(firstRow, COLUMN_ALIASES.text) ? 'tache' : null,
      !hasAnyColumn(firstRow, COLUMN_ALIASES.startDate) ? 'date_debut' : null,
      !hasAnyColumn(firstRow, COLUMN_ALIASES.endDate) ? 'date_fin' : null,
    ].filter(Boolean);

    if (missingColumns.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Format Excel non reconnu. Colonnes recommandees: ${REQUIRED_COLUMNS.join(', ')}`,
        data: { missingColumns, acceptedAliases: COLUMN_ALIASES },
      });
    }

    const importBatchId = uuidv4();
    const errors: Array<{ row: number; message: string }> = [];
    const tasksToCreate = normalizedRows.flatMap((row, index) => {
      const text = String(getFirstValue(row, COLUMN_ALIASES.text) || '').trim();
      const startDate = toDateString(getFirstValue(row, COLUMN_ALIASES.startDate));
      const endDate = toDateString(getFirstValue(row, COLUMN_ALIASES.endDate));

      if (!text || !startDate || !endDate) {
        errors.push({ row: index + 2, message: 'Tache, date_debut and date_fin are required' });
        return [];
      }

      if (startDate > endDate) {
        errors.push({ row: index + 2, message: 'date_debut must be before or equal to date_fin' });
        return [];
      }

      return [{
        userId: req.userId,
        text,
        date: endDate,
        startDate,
        endDate,
        completed: false,
        priority: normalizePriority(row.priorite || row.priority),
        category: (row.categorie || row.category || '').toString().trim() || undefined,
        source: 'excel',
        importBatchId,
      }];
    });

    if (tasksToCreate.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid tasks found in Excel file', data: { errors } });
    }

    const tasks = await PlannerTask.insertMany(tasksToCreate);

    res.status(201).json({
      success: true,
      data: {
        tasks,
        importBatchId,
        importedCount: tasks.length,
        rejectedCount: errors.length,
        errors,
        expectedFormat: REQUIRED_COLUMNS,
      },
    });
  } catch (error) {
    logger.error('Error importing planner Excel file:', error);
    res.status(500).json({ success: false, message: 'Error importing planner Excel file' });
  } finally {
    if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
  }
};

export const downloadExcelTemplate = async (_req: Request, res: Response) => {
  try {
    const rows = [
      {
        tache: 'Analyser les documents importes',
        date_debut: '2026-05-25',
        date_fin: '2026-05-26',
        priorite: 'high',
        categorie: 'Traitement fichiers',
      },
      {
        tache: 'Tester OCR et extraction de texte',
        date_debut: '2026-05-27',
        date_fin: '2026-05-28',
        priorite: 'medium',
        categorie: 'OCR',
      },
      {
        tache: 'Preparer les captures pour le rapport',
        date_debut: '2026-05-29',
        date_fin: '2026-05-30',
        priorite: 'high',
        categorie: 'Rapport',
      },
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 36 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Planning');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="modele_planning_pfe.xlsx"');
    res.send(buffer);
  } catch (error) {
    logger.error('Error generating planner Excel template:', error);
    res.status(500).json({ success: false, message: 'Error generating planner Excel template' });
  }
};

export const getStats = async (req: any, res: Response) => {
  try {
    const tasks = await PlannerTask.find({ userId: req.userId }).lean();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const activeTasks = tasks.filter((task) => (task.startDate || task.date) <= today && (task.endDate || task.date) >= today);
    const monthlyTasks = tasks.filter((task) => (task.startDate || task.date).startsWith(month) || (task.endDate || task.date).startsWith(month));
    const overdueTasks = tasks.filter((task) => !task.completed && (task.endDate || task.date) < today);
    const completedTasks = tasks.filter((task) => task.completed);

    const byPriority = ['low', 'medium', 'high'].map((priority) => ({
      priority,
      count: tasks.filter((task) => task.priority === priority).length,
    }));

    const byCategory = Object.values(tasks.reduce<Record<string, { category: string; count: number }>>((acc, task) => {
      const category = task.category || 'Non classee';
      acc[category] = acc[category] || { category, count: 0 };
      acc[category].count += 1;
      return acc;
    }, {}));

    const byMonth = Object.values(tasks.reduce<Record<string, { month: string; total: number; completed: number }>>((acc, task) => {
      const taskMonth = (task.startDate || task.date).slice(0, 7);
      acc[taskMonth] = acc[taskMonth] || { month: taskMonth, total: 0, completed: 0 };
      acc[taskMonth].total += 1;
      if (task.completed) acc[taskMonth].completed += 1;
      return acc;
    }, {})).sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      success: true,
      data: {
        total: tasks.length,
        completed: completedTasks.length,
        activeToday: activeTasks.length,
        monthly: monthlyTasks.length,
        overdue: overdueTasks.length,
        completionRate: tasks.length ? Math.round((completedTasks.length / tasks.length) * 100) : 0,
        byPriority,
        byCategory,
        byMonth,
      },
    });
  } catch (error) {
    logger.error('Error fetching planner stats:', error);
    res.status(500).json({ success: false, message: 'Error fetching planner stats' });
  }
};

export const deleteTask = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const task = await PlannerTask.findOneAndDelete({ _id: id, userId: req.userId });

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    logger.error('Error deleting task:', error);
    res.status(500).json({ success: false, message: 'Error deleting task' });
  }
};
