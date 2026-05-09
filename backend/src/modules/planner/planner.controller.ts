import { Request, Response } from 'express';
import { PlannerTask } from './planner.model';
import { logger } from '../../utils/logger';

export const getTasks = async (req: any, res: Response) => {
  try {
    const tasks = await PlannerTask.find({ userId: req.userId });
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error('Error fetching tasks:', error);
    res.status(500).json({ success: false, message: 'Error fetching tasks' });
  }
};

export const createTask = async (req: any, res: Response) => {
  try {
    const { text, date } = req.body;
    const task = new PlannerTask({
      userId: req.userId,
      text,
      date,
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
    const { text, completed, date } = req.body;
    
    const task = await PlannerTask.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { text, completed, date },
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
