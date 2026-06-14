import { Reminder } from '../models/Reminder.js';
import { Notification } from '../models/Notification.js';
import { BatchMember } from '../models/BatchMember.js';

/**
 * Check if a value is a valid, parseable date.
 * @param {*} value - The value to check
 * @returns {boolean}
 */
function isValidDate(value) {
  if (value == null) return false;
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Detect deadlines from extracted document data and create reminders.
 * Handles assignments (deadline field), exams (examDate), and notice-referenced dates.
 *
 * @param {Object} params
 * @param {string} params.batchId - Target batch ID
 * @param {Array} [params.assignments] - Extracted assignment data with deadline fields
 * @param {Array} [params.exams] - Extracted exam schedule data with examDate fields
 * @param {Array} [params.notices] - Extracted notice data with potential deadline dates
 * @returns {Promise<{ remindersCreated: number, details: Array }>}
 */
export async function detectAndCreateReminders({ batchId, assignments = [], exams = [], notices = [] }) {
  const details = [];
  let remindersCreated = 0;

  // 1. Process assignments — use the `deadline` field
  for (const assignment of assignments) {
    // Skip if deadline is unknown or missing/invalid
    if (assignment.deadlineUnknown === true) continue;
    if (!isValidDate(assignment.deadline)) continue;

    const created = await createRemindersForDeadline({
      batchId,
      referenceType: 'assignment',
      referenceId: assignment._id || assignment.referenceId || null,
      title: assignment.title || assignment.subject || 'Assignment Deadline',
      deadlineDate: assignment.deadline,
    });

    if (created.length > 0) {
      remindersCreated += created.length;
      details.push({
        type: 'assignment',
        title: assignment.title || assignment.subject || 'Assignment Deadline',
        deadlineDate: new Date(assignment.deadline),
        remindersCount: created.length,
      });
    }
  }

  // 2. Process exams — use the `examDate` field
  for (const exam of exams) {
    if (!isValidDate(exam.examDate)) continue;

    const title = exam.courseName
      ? `${exam.courseName}${exam.examType ? ' - ' + exam.examType : ''} Exam`
      : exam.courseCode
        ? `${exam.courseCode} Exam`
        : 'Exam';

    const created = await createRemindersForDeadline({
      batchId,
      referenceType: 'exam_schedule',
      referenceId: exam._id || exam.referenceId || null,
      title,
      deadlineDate: exam.examDate,
    });

    if (created.length > 0) {
      remindersCreated += created.length;
      details.push({
        type: 'exam_schedule',
        title,
        deadlineDate: new Date(exam.examDate),
        remindersCount: created.length,
      });
    }
  }

  // 3. Process notices — use the `affectedDate` field for deadline-like dates
  for (const notice of notices) {
    if (!isValidDate(notice.affectedDate)) continue;

    // Determine reference type based on notice type/context
    let referenceType = 'custom';
    if (notice.type === 'registration' || (notice.reason && /registration/i.test(notice.reason))) {
      referenceType = 'registration';
    } else if (notice.type === 'registration_deadline') {
      referenceType = 'registration';
    }

    const title = notice.title || notice.courseName
      ? `${notice.courseName || ''} - ${notice.type || 'Notice'}`.trim()
      : notice.reason || 'Notice Deadline';

    const created = await createRemindersForDeadline({
      batchId,
      referenceType,
      referenceId: notice._id || notice.referenceId || null,
      title,
      deadlineDate: notice.affectedDate,
    });

    if (created.length > 0) {
      remindersCreated += created.length;
      details.push({
        type: referenceType,
        title,
        deadlineDate: new Date(notice.affectedDate),
        remindersCount: created.length,
      });
    }
  }

  return { remindersCreated, details };
}

/**
 * Create reminder documents for a given deadline.
 * Generates reminders at default intervals: 1 day before and 1 hour before.
 * Only creates reminders whose remindAt time is still in the future.
 *
 * @param {Object} params
 * @param {string} params.batchId - The batch this reminder belongs to
 * @param {string} params.referenceType - One of: assignment, exam, exam_schedule, registration, custom
 * @param {string} params.referenceId - ObjectId of the referenced document
 * @param {string} params.title - Human-readable reminder title
 * @param {Date|string} params.deadlineDate - The deadline date/time
 * @returns {Promise<Array>} Array of created Reminder documents
 */
export async function createRemindersForDeadline(params) {
  const { batchId, referenceType, referenceId, title, deadlineDate } = params;

  const deadline = new Date(deadlineDate);
  const now = new Date();

  // Skip if deadline is already in the past
  if (deadline <= now) {
    return [];
  }

  const intervals = [
    { offset: 24 * 60 * 60 * 1000, label: '1_day_before' },
    { offset: 1 * 60 * 60 * 1000, label: '1_hour_before' },
  ];

  const remindersToCreate = [];

  for (const { offset, label } of intervals) {
    const remindAt = new Date(deadline.getTime() - offset);

    // Only create if remindAt is still in the future
    if (remindAt > now) {
      remindersToCreate.push({
        batchId,
        referenceType,
        referenceId,
        title,
        deadlineDate: deadline,
        remindAt,
        intervalLabel: label,
        status: 'pending',
      });
    }
  }

  if (remindersToCreate.length === 0) {
    return [];
  }

  const createdReminders = await Reminder.insertMany(remindersToCreate);
  return createdReminders;
}

/**
 * Update existing reminders when a deadline changes.
 * Cancels all pending reminders for the given referenceId and creates new ones
 * at the default intervals (1 day before and 1 hour before) for the new deadline.
 *
 * @param {string} referenceId - ObjectId of the referenced document
 * @param {Date|string} newDate - The new deadline date
 * @returns {Promise<{ cancelledCount: number, newReminders: Array }>}
 */
export async function updateRemindersForDeadline(referenceId, newDate) {
  // 1. Find all existing pending reminders for this referenceId
  const pendingReminders = await Reminder.find({ referenceId, status: 'pending' });

  // 2. If no pending reminders exist, nothing to update
  if (pendingReminders.length === 0) {
    return { cancelledCount: 0, newReminders: [] };
  }

  // 3. Extract metadata from the first existing reminder (shared across all reminders for same referenceId)
  const { batchId, referenceType, title } = pendingReminders[0];

  // 4. Cancel all existing pending reminders
  const cancelResult = await Reminder.updateMany(
    { referenceId, status: 'pending' },
    { $set: { status: 'cancelled' } }
  );
  const cancelledCount = cancelResult.modifiedCount;

  // 5. If newDate is valid and in the future, create new reminders
  let newReminders = [];
  if (isValidDate(newDate)) {
    const deadline = new Date(newDate);
    const now = new Date();

    if (deadline > now) {
      newReminders = await createRemindersForDeadline({
        batchId,
        referenceType,
        referenceId,
        title,
        deadlineDate: newDate,
      });
    }
  }

  return { cancelledCount, newReminders };
}

/**
 * Map a reminder's referenceType to a notification type.
 * @param {string} referenceType
 * @returns {string}
 */
function mapReferenceTypeToNotificationType(referenceType) {
  switch (referenceType) {
    case 'assignment':
      return 'assignment';
    case 'exam':
    case 'exam_schedule':
      return 'exam';
    default:
      return 'system';
  }
}

/**
 * Determine notification priority based on the reminder interval label.
 * @param {string} intervalLabel
 * @returns {string}
 */
function mapIntervalToPriority(intervalLabel) {
  switch (intervalLabel) {
    case '1_hour_before':
      return 'high';
    case '1_day_before':
    default:
      return 'medium';
  }
}

/**
 * Process all pending reminders that are due.
 * Called by cron every 5 minutes.
 * Queries pending reminders where remindAt <= now, finds batch members,
 * creates a Notification per member, and marks reminder as sent.
 *
 * @returns {Promise<{ processed: number, failed: number }>}
 */
export async function processReminders() {
  const now = new Date();
  let processed = 0;
  let failed = 0;

  // Query all pending reminders that are due
  const dueReminders = await Reminder.find({
    status: 'pending',
    remindAt: { $lte: now },
  });

  for (const reminder of dueReminders) {
    try {
      // Find all batch members for this reminder's batch
      const batchMembers = await BatchMember.find({ batchId: reminder.batchId });

      // Build notification data for each member
      const deadlineFormatted = reminder.deadlineDate
        ? new Date(reminder.deadlineDate).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'unknown date';

      const notificationType = mapReferenceTypeToNotificationType(reminder.referenceType);
      const priority = mapIntervalToPriority(reminder.intervalLabel);

      const notifications = batchMembers.map((member) => ({
        userId: member.userId,
        title: reminder.title,
        message: `Reminder: ${reminder.title} - due ${deadlineFormatted}`,
        type: notificationType,
        priority,
        isRead: false,
        reminderId: reminder._id,
        batchId: reminder.batchId,
      }));

      // Create notifications in bulk
      if (notifications.length > 0) {
        await Notification.insertMany(notifications);
      }

      // Mark reminder as sent
      reminder.status = 'sent';
      reminder.sentAt = now;
      await reminder.save();

      processed++;
    } catch (err) {
      console.error(`[ReminderEngine] Failed to process reminder ${reminder._id}:`, err.message);
      failed++;
    }
  }

  return { processed, failed };
}
