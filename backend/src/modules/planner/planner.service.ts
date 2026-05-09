import cron from 'node-cron';
import { PlannerTask } from './planner.model';
import { sendReminderEmail } from '../../utils/email';
import { logger } from '../../utils/logger';
import { format, addDays } from 'date-fns';

export const initReminderJob = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Running planner reminder job...');
    
    try {
      const now = new Date();
      
      // 1. Find tasks with custom reminderAt that are due
      const customReminders = await PlannerTask.find({
        reminderAt: { $lte: now },
        reminderSent: false,
        completed: false
      }).populate('userId');

      // 2. Find tasks for tomorrow (default 1-day-before reminder at 9 AM)
      // Only run this part at 9 AM
      let defaultReminders: any[] = [];
      if (now.getHours() === 9) {
        const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
        defaultReminders = await PlannerTask.find({
          date: tomorrow,
          reminderAt: { $exists: false }, // Only those without custom reminder
          completed: false,
          reminderSent: false
        }).populate('userId');
      }

      const allTasks = [...customReminders, ...defaultReminders];

      for (const task of allTasks) {
        const user = task.userId as any;
        if (user && user.email) {
          try {
            await sendReminderEmail(user.email, task.text, task.date);
            task.reminderSent = true;
            await task.save();
          } catch (err) {
            logger.error(`Failed to send email to ${user.email}:`, err);
          }
        }
      }

      if (allTasks.length > 0) {
        logger.info(`Reminder job: Sent ${allTasks.length} reminders.`);
      }
    } catch (error) {
      logger.error('Error in reminder job:', error);
    }
  });
};
