/**
 * noticeDetector.js
 *
 * AI-powered notice detection service.
 * Identifies notice types (cancellation, reschedule, room change, faculty change)
 * and classifies them as temporary or permanent using Gemini AI.
 */
import { invokeAI } from '../config/gemini.js';
import { Timetable } from '../models/Timetable.js';
import { TimetableOverride } from '../models/TimetableOverride.js';
import { TimetableAuditLog } from '../models/TimetableAuditLog.js';
import { Notification } from '../models/Notification.js';
import { BatchMember } from '../models/BatchMember.js';

// ── Helpers ─────────────────────────────────────────────────

/**
 * Parse raw LLM response into a JSON object.
 * Handles markdown code fences and extracts JSON from mixed content.
 *
 * @param {string} raw - Raw LLM response text
 * @returns {object|null} Parsed JSON or null on failure
 */
function parseLLMJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    console.error('[NoticeDetector] JSON parse failed:', e.message, 'Raw (first 500):', raw.slice(0, 500));
    return null;
  }
}

// ── Notice Detection Prompt ─────────────────────────────────

const NOTICE_DETECTION_PROMPT = (text) => `You are an AI assistant for a college campus management system.

The following text is an administrative NOTICE. Extract all schedule changes mentioned.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON. No explanation. Use this exact schema:
{
  "notices": [
    {
      "type": "cancelled" | "rescheduled" | "room_changed" | "faculty_changed",
      "courseCode": "CSE301",
      "courseName": "Database Management",
      "affectedDate": "2026-02-15",
      "originalTime": "09:00 AM",
      "newTime": "11:00 AM",
      "newVenue": "Room 205",
      "newFaculty": "",
      "determination": "temporary" | "permanent" | "unknown",
      "reason": "Faculty on medical leave"
    }
  ]
}

Rules:
- "type": What kind of change is being announced
- "determination": "temporary" if it's a one-time change for a specific date,
  "permanent" if the schedule is changed for all future occurrences,
  "unknown" if you cannot determine
- "affectedDate": The specific date affected (ISO format YYYY-MM-DD). For permanent changes, this is the effective-from date.
- New fields (newTime, newVenue, newFaculty): Fill only what changed, empty string otherwise
- Include ALL changes mentioned in the notice
- Return empty "notices": [] if no schedule changes found`;

// ── Main Detection Function ─────────────────────────────────

/**
 * Detect notice actions from extracted text using AI.
 *
 * @param {string} text - Extracted text from notice
 * @returns {Promise<{ notices: NoticeAction[] }>}
 *
 * NoticeAction: {
 *   type: 'cancelled' | 'rescheduled' | 'room_changed' | 'faculty_changed',
 *   courseCode: string,
 *   courseName: string,
 *   affectedDate: string,
 *   originalTime: string,
 *   newTime: string,
 *   newVenue: string,
 *   newFaculty: string,
 *   determination: 'temporary' | 'permanent',
 *   isPermanent: boolean,
 *   reason: string,
 *   flaggedForReview: boolean
 * }
 */
export async function detectNotices(text) {
  console.log('[NoticeDetector] Detecting notices, text length:', text.length);

  if (!text || text.trim().length === 0) {
    console.warn('[NoticeDetector] Empty text provided');
    return { notices: [] };
  }

  let lastError = null;

  // Attempt AI detection with one retry
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await invokeAI(NOTICE_DETECTION_PROMPT(text), 2048);
      const parsed = parseLLMJSON(response);

      if (!parsed || !Array.isArray(parsed.notices)) {
        throw new Error('Invalid AI response: missing notices array');
      }

      // Process each notice action
      const notices = parsed.notices.map((notice) => {
        // Validate type field - only allow known notice types
        const VALID_TYPES = ['cancelled', 'rescheduled', 'room_changed', 'faculty_changed'];
        const type = VALID_TYPES.includes(notice.type) ? notice.type : 'cancelled';

        // Validate determination field - only allow known values
        const VALID_DETERMINATIONS = ['temporary', 'permanent', 'unknown'];
        const rawDetermination = VALID_DETERMINATIONS.includes(notice.determination)
          ? notice.determination
          : 'unknown';

        // Flag for review if determination was unknown or invalid/missing
        const flaggedForReview = rawDetermination === 'unknown' || !VALID_DETERMINATIONS.includes(notice.determination);

        // Normalize determination: treat "unknown" as "temporary" for safety
        const determination = rawDetermination === 'unknown' ? 'temporary' : rawDetermination;

        // isPermanent is true only when determination is explicitly "permanent"
        const isPermanent = determination === 'permanent';

        return {
          type,
          courseCode: notice.courseCode || '',
          courseName: notice.courseName || '',
          affectedDate: notice.affectedDate || '',
          originalTime: notice.originalTime || '',
          newTime: notice.newTime || '',
          newVenue: notice.newVenue || '',
          newFaculty: notice.newFaculty || '',
          determination,
          isPermanent,
          reason: notice.reason || '',
          flaggedForReview,
        };
      });

      console.log('[NoticeDetector] Detected', notices.length, 'notice action(s)');
      return { notices };
    } catch (err) {
      lastError = err;
      console.error(`[NoticeDetector] AI attempt ${attempt} failed:`, err.message);

      // Wait 3 seconds before retry (only on first failure)
      if (attempt === 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  // Both attempts failed — return empty notices with error logged
  console.error('[NoticeDetector] All AI attempts failed, returning empty notices. Error:', lastError?.message);
  return { notices: [] };
}


// ── Helper: Get Day of Week from Date String ────────────────

/**
 * Convert an ISO date string (YYYY-MM-DD) to a day of week name.
 * @param {string} dateStr - Date string in ISO format
 * @returns {string|null} Day name (e.g., "Monday") or null if invalid
 */
function getDayOfWeekFromDate(dateStr) {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  } catch {
    return null;
  }
}

// ── Apply Notice to Timetable ───────────────────────────────

/**
 * Apply detected notices to the timetable system.
 * Creates temporary overrides or permanent updates based on notice classification.
 *
 * @param {NoticeAction[]} notices - Array of detected notice actions
 * @param {string} batchId - The batch ID to apply notices to
 * @param {string} userId - The user applying the notices
 * @param {string} userName - Display name of the user
 * @returns {Promise<{ applied: number, skipped: number, errors: string[] }>}
 */
export async function applyNoticeToTimetable(notices, batchId, userId, userName) {
  const result = { applied: 0, skipped: 0, errors: [], notificationsSent: 0 };

  if (!notices || !Array.isArray(notices) || notices.length === 0) {
    return result;
  }

  for (const notice of notices) {
    try {
      // 1a. Determine day of week from affectedDate
      const dayOfWeek = getDayOfWeekFromDate(notice.affectedDate);
      if (!dayOfWeek) {
        console.warn('[NoticeDetector] Invalid affectedDate:', notice.affectedDate, 'for course:', notice.courseCode);
        result.skipped++;
        result.errors.push(`Invalid affectedDate "${notice.affectedDate}" for course ${notice.courseCode}`);
        continue;
      }

      // 1a. Find the matching timetable document for this batch and day
      const timetable = await Timetable.findOne({
        batchId,
        dayOfWeek,
      });

      if (!timetable) {
        console.warn('[NoticeDetector] No timetable found for batch:', batchId, 'day:', dayOfWeek);
        result.skipped++;
        result.errors.push(`No timetable found for day ${dayOfWeek} (course: ${notice.courseCode})`);
        continue;
      }

      // 1a. Find the matching slot by courseCode (case-insensitive)
      const slotIndex = timetable.slots.findIndex(
        (slot) => slot.courseCode && slot.courseCode.toLowerCase() === (notice.courseCode || '').toLowerCase()
      );

      if (slotIndex === -1) {
        console.warn('[NoticeDetector] No matching slot for course:', notice.courseCode, 'in timetable:', timetable._id);
        result.skipped++;
        result.errors.push(`No matching slot for course ${notice.courseCode} on ${dayOfWeek}`);
        continue;
      }

      // 2. Handle temporary notices
      if (!notice.isPermanent) {
        const effectiveDate = new Date(notice.affectedDate);

        // Create a TimetableOverride document
        await TimetableOverride.create({
          batchId,
          timetableId: timetable._id,
          slotIndex,
          effectiveDate,
          overrideType: notice.type,
          newTime: notice.newTime || null,
          newVenue: notice.newVenue || null,
          newFaculty: notice.newFaculty || null,
          reason: notice.reason || '',
          createdBy: userId,
          source: 'notice_ai',
          flaggedForReview: notice.flaggedForReview || false,
        });

        // Write audit log entry
        await TimetableAuditLog.create({
          batchId,
          action: 'notice_applied',
          targetDay: dayOfWeek,
          targetSlotIndex: slotIndex,
          changeDetails: {
            type: notice.type,
            courseCode: notice.courseCode,
            affectedDate: notice.affectedDate,
            newTime: notice.newTime || null,
            newVenue: notice.newVenue || null,
            newFaculty: notice.newFaculty || null,
            isPermanent: false,
          },
          reason: notice.reason || '',
          performedBy: userId,
          performedByName: userName,
        });

        result.applied++;

        // Send batch notification for the applied notice
        try {
          const sent = await sendBatchNotificationForNotice(notice, batchId);
          result.notificationsSent += sent;
        } catch (notifErr) {
          console.error('[NoticeDetector] Notification dispatch failed (temporary):', notifErr.message);
        }
      } else {
        // 3. Handle permanent notices
        const slot = timetable.slots[slotIndex];

        if (notice.type === 'cancelled') {
          // Remove the slot from the slots array
          timetable.slots.splice(slotIndex, 1);
        } else {
          // Update the matching slot fields
          if (notice.newTime) slot.time = notice.newTime;
          if (notice.newVenue) slot.venue = notice.newVenue;
          if (notice.newFaculty) slot.faculty = notice.newFaculty;
        }

        // Set permanent update metadata
        timetable.lastPermanentUpdateAt = new Date();
        timetable.lastPermanentUpdateBy = userId;

        await timetable.save();

        // Write audit log entry
        await TimetableAuditLog.create({
          batchId,
          action: 'override_perm',
          targetDay: dayOfWeek,
          targetSlotIndex: slotIndex,
          changeDetails: {
            type: notice.type,
            courseCode: notice.courseCode,
            affectedDate: notice.affectedDate,
            newTime: notice.newTime || null,
            newVenue: notice.newVenue || null,
            newFaculty: notice.newFaculty || null,
            isPermanent: true,
            slotRemoved: notice.type === 'cancelled',
          },
          reason: notice.reason || '',
          performedBy: userId,
          performedByName: userName,
        });

        result.applied++;

        // Send batch notification for the applied notice
        try {
          const sent = await sendBatchNotificationForNotice(notice, batchId);
          result.notificationsSent += sent;
        } catch (notifErr) {
          console.error('[NoticeDetector] Notification dispatch failed (permanent):', notifErr.message);
        }
      }
    } catch (err) {
      console.error('[NoticeDetector] Error applying notice:', err.message, 'Notice:', JSON.stringify(notice));
      result.errors.push(`Error applying notice for course ${notice.courseCode}: ${err.message}`);
      result.skipped++;
    }
  }

  console.log('[NoticeDetector] Apply results:', result);
  return result;
}


// ── Batch Notification Helper ───────────────────────────────

/**
 * Send a notification to all enrolled members of a batch about a timetable change.
 * This is triggered after a notice-driven timetable update is successfully applied.
 *
 * @param {object} notice - The notice action that was applied
 * @param {string} batchId - The batch ID whose members should be notified
 * @returns {Promise<number>} Number of notifications created
 */
async function sendBatchNotificationForNotice(notice, batchId) {
  const batchMembers = await BatchMember.find({ batchId });

  if (!batchMembers || batchMembers.length === 0) {
    console.log('[NoticeDetector] No batch members found for batchId:', batchId);
    return 0;
  }

  // Determine priority: 'high' for cancellations, 'medium' for other changes
  const priority = notice.type === 'cancelled' ? 'high' : 'medium';

  // Build descriptive title
  const typeLabel = notice.type.replace(/_/g, ' ');
  const title = `Timetable Update: ${notice.courseCode || 'Unknown'} - ${typeLabel}`;

  // Build detailed message
  const messageParts = [`Change type: ${typeLabel}`];
  if (notice.affectedDate) messageParts.push(`Date: ${notice.affectedDate}`);
  if (notice.newTime) messageParts.push(`New time: ${notice.newTime}`);
  if (notice.newVenue) messageParts.push(`New venue: ${notice.newVenue}`);
  if (notice.newFaculty) messageParts.push(`New faculty: ${notice.newFaculty}`);
  if (notice.reason) messageParts.push(`Reason: ${notice.reason}`);
  if (notice.isPermanent) messageParts.push('This is a permanent change.');

  const message = messageParts.join('. ');

  // Create notifications for each batch member
  const notifications = batchMembers.map((member) => ({
    userId: member.userId,
    title,
    message,
    type: 'system',
    priority,
    isRead: false,
    batchId,
  }));

  await Notification.insertMany(notifications);

  console.log('[NoticeDetector] Sent', notifications.length, 'notifications for batch:', batchId);
  return notifications.length;
}
