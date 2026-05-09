import cron from 'node-cron';
import { PlannerTask } from './planner.model';
import { sendReminderEmail } from '../../utils/email';
import { logger } from '../../utils/logger';
import { format, addDays } from 'date-fns';

export const initReminderJob = () => {
  // Run every day at 09:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running planner reminder job...');
    
    try {
      // Find tasks for tomorrow
      const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      
      const tasksToRemind = await PlannerTask.find({
        date: tomorrow,
        completed: false,
        reminderSent: false
      }).populate('userId');

      for (const task of tasksToRemind) {
        const user = task.userId as any; // Cast to access email
        if (user && user.email) {
          await sendReminderEmail(user.email, task.text, task.date);
          task.reminderSent = true;
          await task.save();
        }
      }

      logger.info(`Reminder job finished. Sent ${tasksToRemind.length} reminders.`);
    } catch (error) {
      logger.error('Error in reminder job:', error);
    }
  });
};
