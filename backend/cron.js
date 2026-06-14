import cron from 'node-cron';
import { Assignment } from './models/Assignment.js';
import { Exam } from './models/Exam.js';
import { Notification } from './models/Notification.js';
import { processReminders } from './services/reminderEngine.js';

export function startCronJobs() {
  // Run every 6 hours (0 0,6,12,18 * * *)
  cron.schedule('0 0,6,12,18 * * *', async () => {
    console.log('[Cron] Running smart reminders check...');
    try {
      const now = new Date();
      
      // ── Assignment Reminders (due in next 24 hours) ──
      const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const urgentAssignments = await Assignment.find({
        status: { $ne: 'Submitted' },
        deadline: { $gte: now, $lte: next24Hours }
      });
      
      for (const a of urgentAssignments) {
        // Find if notification already exists to avoid spam
        const existing = await Notification.findOne({
          userId: a.userId,
          type: 'assignment',
          message: { $regex: a.title }
        });
        
        if (!existing) {
          await Notification.create({
            userId: a.userId,
            title: 'Urgent Deadline ⚠️',
            message: `Assignment "${a.title}" (${a.subject}) is due in less than 24 hours!`,
            type: 'assignment',
            priority: 'urgent'
          });
        }
      }

      // ── Exam Reminders (starts in next 3 days) ──
      const next3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const upcomingExams = await Exam.find({
        date: { $gte: now, $lte: next3Days }
      });

      for (const e of upcomingExams) {
        const existing = await Notification.findOne({
          userId: e.userId, // note: this logic assumes you link exams to user, else you'd fan out to batch members
          type: 'exam',
          message: { $regex: e.subject }
        });

        if (!existing && e.userId) {
          await Notification.create({
            userId: e.userId,
            title: 'Upcoming Exam 📖',
            message: `Your exam for ${e.subject} is in less than 3 days.`,
            type: 'exam',
            priority: 'high'
          });
        }
      }

      console.log(`[Cron] Generated reminders: ${urgentAssignments.length} assignments, ${upcomingExams.length} exams.`);
    } catch (err) {
      console.error('[Cron] Error running scheduled jobs:', err);
    }
  });

  // Process due reminders every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Processing due reminders...');
    try {
      const result = await processReminders();
      console.log(`[Cron] Reminders processed: ${result.processed} sent, ${result.failed} failed.`);
    } catch (err) {
      console.error('[Cron] Reminder processing failed:', err.message);
    }
  });

  console.log('[Cron] Scheduled background jobs initialized.');
}
