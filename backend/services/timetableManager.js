import { Timetable } from '../models/Timetable.js';
import { TimetableAuditLog } from '../models/TimetableAuditLog.js';
import { TimetableOverride } from '../models/TimetableOverride.js';
import { BatchMember } from '../models/BatchMember.js';
import { Batch } from '../models/Batch.js';
import { ExamSchedule } from '../models/ExamSchedule.js';
import { Assignment } from '../models/Assignment.js';

/**
 * Create a new slot in the master timetable for a given batch and day.
 * Performs duplicate detection on batchId + dayOfWeek + courseCode + time.
 *
 * @param {string} batchId - The batch ObjectId
 * @param {string} dayOfWeek - Day of week (Monday-Sunday)
 * @param {object} slot - Slot data { time, courseCode, courseName, venue, faculty }
 * @param {object} adminUser - Admin performing the action { _id, displayName|name }
 * @returns {Promise<object>} Result with status and created slot info
 */
export async function createSlot(batchId, dayOfWeek, slot, adminUser) {
  try {
    // Find or create timetable document for this batch + day
    let timetable = await Timetable.findOne({ batchId, dayOfWeek });

    if (!timetable) {
      timetable = new Timetable({
        batchId,
        dayOfWeek,
        slots: [],
        uploadedBy: adminUser._id,
      });
    }

    // Duplicate detection: check batchId + dayOfWeek + courseCode + time
    const duplicate = timetable.slots.find(
      (s) => s.courseCode === slot.courseCode && s.time === slot.time
    );

    if (duplicate) {
      return {
        success: false,
        skipped: true,
        reason: 'Duplicate slot exists',
        existing: {
          courseCode: duplicate.courseCode,
          time: duplicate.time,
          venue: duplicate.venue,
          faculty: duplicate.faculty,
        },
      };
    }

    // Push the new slot
    timetable.slots.push(slot);
    await timetable.save();

    const createdSlot = timetable.slots[timetable.slots.length - 1];
    const adminName = adminUser.displayName || adminUser.name || 'Unknown';

    // Write audit log
    await TimetableAuditLog.create({
      batchId,
      action: 'create',
      targetDay: dayOfWeek,
      targetSlotIndex: timetable.slots.length - 1,
      changeDetails: { added: slot },
      reason: '',
      performedBy: adminUser._id,
      performedByName: adminName,
    });

    return {
      success: true,
      timetableId: timetable._id,
      slotIndex: timetable.slots.length - 1,
      slot: createdSlot,
    };
  } catch (err) {
    console.error('[TimetableManager] createSlot error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Update an existing slot in the master timetable.
 *
 * @param {string} timetableId - The Timetable document ObjectId
 * @param {number} slotIndex - Index of the slot in the slots array
 * @param {object} updates - Fields to update { time?, courseCode?, courseName?, venue?, faculty? }
 * @param {object} adminUser - Admin performing the action { _id, displayName|name }
 * @param {string} reason - Reason for the update
 * @returns {Promise<object>} Result with status and updated slot info
 */
export async function updateSlot(timetableId, slotIndex, updates, adminUser, reason) {
  try {
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return { success: false, error: 'Timetable not found' };
    }

    if (slotIndex < 0 || slotIndex >= timetable.slots.length) {
      return { success: false, error: 'Invalid slot index' };
    }

    const oldSlot = timetable.slots[slotIndex].toObject();

    // Apply updates to the slot
    const allowedFields = ['time', 'courseCode', 'courseName', 'venue', 'faculty'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        timetable.slots[slotIndex][field] = updates[field];
      }
    }

    await timetable.save();

    const updatedSlot = timetable.slots[slotIndex].toObject();
    const adminName = adminUser.displayName || adminUser.name || 'Unknown';

    // Build change diff
    const changeDiff = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined && oldSlot[field] !== updates[field]) {
        changeDiff[field] = { from: oldSlot[field], to: updates[field] };
      }
    }

    // Write audit log
    await TimetableAuditLog.create({
      batchId: timetable.batchId,
      action: 'update',
      targetDay: timetable.dayOfWeek,
      targetSlotIndex: slotIndex,
      changeDetails: changeDiff,
      reason: reason || '',
      performedBy: adminUser._id,
      performedByName: adminName,
    });

    return {
      success: true,
      timetableId: timetable._id,
      slotIndex,
      slot: updatedSlot,
      changes: changeDiff,
    };
  } catch (err) {
    console.error('[TimetableManager] updateSlot error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Delete a slot from the master timetable.
 *
 * @param {string} timetableId - The Timetable document ObjectId
 * @param {number} slotIndex - Index of the slot in the slots array
 * @param {object} adminUser - Admin performing the action { _id, displayName|name }
 * @param {string} reason - Reason for the deletion
 * @returns {Promise<object>} Result with status and deleted slot info
 */
export async function deleteSlot(timetableId, slotIndex, adminUser, reason) {
  try {
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return { success: false, error: 'Timetable not found' };
    }

    if (slotIndex < 0 || slotIndex >= timetable.slots.length) {
      return { success: false, error: 'Invalid slot index' };
    }

    const deletedSlot = timetable.slots[slotIndex].toObject();

    // Remove the slot
    timetable.slots.splice(slotIndex, 1);
    await timetable.save();

    const adminName = adminUser.displayName || adminUser.name || 'Unknown';

    // Write audit log
    await TimetableAuditLog.create({
      batchId: timetable.batchId,
      action: 'delete',
      targetDay: timetable.dayOfWeek,
      targetSlotIndex: slotIndex,
      changeDetails: { deleted: deletedSlot },
      reason: reason || '',
      performedBy: adminUser._id,
      performedByName: adminName,
    });

    return {
      success: true,
      timetableId: timetable._id,
      deletedSlot,
    };
  } catch (err) {
    console.error('[TimetableManager] deleteSlot error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Apply a temporary override to a timetable slot.
 * Creates a TimetableOverride document with effectiveDate. Affects only that single date.
 * Master timetable remains unchanged.
 *
 * @param {object} params - Override parameters
 * @param {string} params.batchId - The batch ObjectId
 * @param {string} params.timetableId - The Timetable document ObjectId
 * @param {number} params.slotIndex - Index of the slot being overridden
 * @param {Date|string} params.effectiveDate - The specific date this override applies to
 * @param {string} params.overrideType - One of: rescheduled, cancelled, room_changed, faculty_changed
 * @param {string} [params.newTime] - New time value (null if unchanged)
 * @param {string} [params.newVenue] - New venue value (null if unchanged)
 * @param {string} [params.newFaculty] - New faculty value (null if unchanged)
 * @param {string} [params.newDay] - New day value (null if unchanged)
 * @param {string} [params.reason] - Reason for the override
 * @param {string} [params.source] - Source of the override ('admin' or 'notice_ai'), defaults to 'admin'
 * @param {boolean} [params.flaggedForReview] - Whether this needs manual review, defaults to false
 * @param {object} adminUser - Admin performing the action { _id, displayName|name }
 * @returns {Promise<object>} Result with status and created override document
 */
export async function applyTempOverride(params, adminUser) {
  try {
    const {
      batchId,
      timetableId,
      slotIndex,
      effectiveDate,
      overrideType,
      newTime = null,
      newVenue = null,
      newFaculty = null,
      newDay = null,
      reason = '',
      source = 'admin',
      flaggedForReview = false,
    } = params;

    // Validate that the referenced timetable exists
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return { success: false, error: 'Timetable not found' };
    }

    // Validate that the slot index is valid
    if (slotIndex < 0 || slotIndex >= timetable.slots.length) {
      return { success: false, error: 'Invalid slot index' };
    }

    const targetSlot = timetable.slots[slotIndex];
    const adminName = adminUser.displayName || adminUser.name || 'Unknown';

    // Create the TimetableOverride document
    const override = await TimetableOverride.create({
      batchId,
      timetableId,
      slotIndex,
      effectiveDate,
      overrideType,
      newTime,
      newVenue,
      newFaculty,
      newDay,
      reason,
      createdBy: adminUser._id,
      source,
      flaggedForReview,
    });

    // Write audit log entry
    await TimetableAuditLog.create({
      batchId,
      action: 'override_temp',
      targetDay: timetable.dayOfWeek,
      targetSlotIndex: slotIndex,
      changeDetails: {
        overrideType,
        effectiveDate,
        originalSlot: {
          time: targetSlot.time,
          venue: targetSlot.venue,
          faculty: targetSlot.faculty,
        },
        newValues: { newTime, newVenue, newFaculty, newDay },
      },
      reason: reason || '',
      performedBy: adminUser._id,
      performedByName: adminName,
    });

    return { success: true, override };
  } catch (err) {
    console.error('[TimetableManager] applyTempOverride error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Apply a permanent update to a timetable slot.
 * Directly modifies the slot in the master Timetable, sets lastPermanentUpdateAt/By,
 * and logs the change in TimetableAuditLog with action 'override_perm'.
 *
 * @param {string} timetableId - The Timetable document ObjectId
 * @param {number} slotIndex - Index of the slot in the slots array
 * @param {object} updates - Fields to update { time?, courseCode?, courseName?, venue?, faculty? }
 * @param {object} adminUser - Admin performing the action { _id, displayName|name }
 * @param {string} reason - Reason for the permanent update
 * @returns {Promise<object>} Result with status and updated slot info
 */
export async function applyPermanentUpdate(timetableId, slotIndex, updates, adminUser, reason) {
  try {
    const timetable = await Timetable.findById(timetableId);

    if (!timetable) {
      return { success: false, error: 'Timetable not found' };
    }

    if (slotIndex < 0 || slotIndex >= timetable.slots.length) {
      return { success: false, error: 'Invalid slot index' };
    }

    // Capture old slot values for audit diff
    const oldSlot = timetable.slots[slotIndex].toObject();

    // Apply updates to the slot (only allowed fields)
    const allowedFields = ['time', 'courseCode', 'courseName', 'venue', 'faculty'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        timetable.slots[slotIndex][field] = updates[field];
      }
    }

    // Set permanent update metadata
    timetable.lastPermanentUpdateAt = new Date();
    timetable.lastPermanentUpdateBy = adminUser._id;

    await timetable.save();

    const updatedSlot = timetable.slots[slotIndex].toObject();
    const adminName = adminUser.displayName || adminUser.name || 'Unknown';

    // Build change diff
    const changeDiff = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined && oldSlot[field] !== updates[field]) {
        changeDiff[field] = { from: oldSlot[field], to: updates[field] };
      }
    }

    // Write audit log with action 'override_perm'
    await TimetableAuditLog.create({
      batchId: timetable.batchId,
      action: 'override_perm',
      targetDay: timetable.dayOfWeek,
      targetSlotIndex: slotIndex,
      changeDetails: changeDiff,
      reason: reason || '',
      performedBy: adminUser._id,
      performedByName: adminName,
    });

    return {
      success: true,
      timetableId: timetable._id,
      slotIndex,
      slot: updatedSlot,
      changes: changeDiff,
    };
  } catch (err) {
    console.error('[TimetableManager] applyPermanentUpdate error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Get a merged timetable for a user on a specific date, combining master + overrides.
 * Fetches all batches the user belongs to, retrieves the master timetable for that day,
 * applies any overrides using the priority resolution algorithm, and returns the merged view.
 *
 * @param {string} userId - The user's ObjectId
 * @param {Date|string} date - The specific date to get the timetable for
 * @returns {Promise<Array>} Array of batch timetable objects with merged slots
 */
export async function getMergedTimetable(userId, date) {
  try {
    // Normalize date parameter
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return { success: false, error: 'Invalid date provided' };
    }

    // Determine day of week from the date
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[dateObj.getDay()];

    // 1. Find all batches the user is enrolled in
    const memberships = await BatchMember.find({ userId }).lean();
    if (!memberships || memberships.length === 0) {
      return [];
    }
    const batchIds = memberships.map((m) => m.batchId);

    // 2. Fetch batch details for names
    const batches = await Batch.find({ _id: { $in: batchIds } }).lean();
    const batchNameMap = {};
    for (const batch of batches) {
      batchNameMap[batch._id.toString()] = batch.batchName;
    }

    // 3. Fetch master timetables for all user's batches for that day
    const timetables = await Timetable.find({
      batchId: { $in: batchIds },
      dayOfWeek,
    }).lean();

    // 4. Fetch overrides for those batches on the specific date (normalize to start/end of day)
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const overrides = await TimetableOverride.find({
      batchId: { $in: batchIds },
      effectiveDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    // 5. Build merged timetable per batch
    const priorityOrder = ['cancelled', 'rescheduled', 'room_changed', 'faculty_changed'];

    const result = timetables.map((timetable) => {
      const timetableIdStr = timetable._id.toString();
      const batchIdStr = timetable.batchId.toString();

      // Get overrides relevant to this timetable
      const timetableOverrides = overrides.filter(
        (o) => o.timetableId.toString() === timetableIdStr
      );

      // Resolve each slot
      const mergedSlots = timetable.slots.map((slot, slotIndex) => {
        // Find overrides for this specific slot
        const slotOverrides = timetableOverrides.filter((o) => o.slotIndex === slotIndex);

        if (slotOverrides.length === 0) {
          // No override → return master slot as-is
          return {
            time: slot.time,
            courseCode: slot.courseCode,
            courseName: slot.courseName,
            venue: slot.venue,
            faculty: slot.faculty,
            status: 'active',
            overrideDetails: null,
          };
        }

        // Sort by priority (lowest index in priorityOrder = highest priority)
        slotOverrides.sort(
          (a, b) => priorityOrder.indexOf(a.overrideType) - priorityOrder.indexOf(b.overrideType)
        );

        const topOverride = slotOverrides[0];

        // Build display slot with override applied
        const displaySlot = {
          time: slot.time,
          courseCode: slot.courseCode,
          courseName: slot.courseName,
          venue: slot.venue,
          faculty: slot.faculty,
          status: topOverride.overrideType,
          overrideDetails: {
            reason: topOverride.reason,
            overrideType: topOverride.overrideType,
            originalVenue: slot.venue,
            originalTime: slot.time,
            originalFaculty: slot.faculty,
          },
        };

        // Apply new values from the override
        if (topOverride.newTime) displaySlot.time = topOverride.newTime;
        if (topOverride.newVenue) displaySlot.venue = topOverride.newVenue;
        if (topOverride.newFaculty) displaySlot.faculty = topOverride.newFaculty;

        return displaySlot;
      });

      return {
        batchId: batchIdStr,
        batchName: batchNameMap[batchIdStr] || '',
        dayOfWeek,
        slots: mergedSlots,
      };
    });

    return result;
  } catch (err) {
    console.error('[TimetableManager] getMergedTimetable error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Check if a timetable slot already exists for the given batch, day, courseCode, and time.
 * Used by the DocumentIntelligenceRouter before creating new timetable entries.
 *
 * @param {string} batchId - The batch ObjectId
 * @param {string} dayOfWeek - Day of week (Monday-Sunday)
 * @param {string} courseCode - The course code
 * @param {string} time - The time slot
 * @returns {Promise<{isDuplicate: boolean, existing?: object}>}
 */
export async function checkTimetableDuplicate(batchId, dayOfWeek, courseCode, time) {
  try {
    const timetable = await Timetable.findOne({ batchId, dayOfWeek }).lean();

    if (!timetable || !timetable.slots || timetable.slots.length === 0) {
      return { isDuplicate: false };
    }

    const existingSlot = timetable.slots.find(
      (s) => s.courseCode === courseCode && s.time === time
    );

    if (existingSlot) {
      return {
        isDuplicate: true,
        existing: {
          courseCode: existingSlot.courseCode,
          time: existingSlot.time,
          venue: existingSlot.venue,
          faculty: existingSlot.faculty,
          courseName: existingSlot.courseName,
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.error('[TimetableManager] checkTimetableDuplicate error:', err.message);
    return { isDuplicate: false };
  }
}

/**
 * Check if an exam schedule already exists for the given batch, courseCode, and examDate.
 * Used by the DocumentIntelligenceRouter before creating new exam entries.
 *
 * @param {string} batchId - The batch ObjectId
 * @param {string} courseCode - The course code
 * @param {Date|string} examDate - The exam date
 * @returns {Promise<{isDuplicate: boolean, existing?: object}>}
 */
export async function checkExamDuplicate(batchId, courseCode, examDate) {
  try {
    // Normalize examDate to match only the date portion (start to end of day)
    const dateObj = new Date(examDate);
    if (isNaN(dateObj.getTime())) {
      return { isDuplicate: false };
    }

    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await ExamSchedule.findOne({
      batchId,
      courseCode,
      examDate: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    if (existing) {
      return {
        isDuplicate: true,
        existing: {
          courseCode: existing.courseCode,
          courseName: existing.courseName,
          examDate: existing.examDate,
          examTime: existing.examTime,
          venue: existing.venue,
          examType: existing.examType,
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.error('[TimetableManager] checkExamDuplicate error:', err.message);
    return { isDuplicate: false };
  }
}

/**
 * Check if an assignment already exists for the given batch, courseCode, and title.
 * Title is normalized to lowercase for case-insensitive comparison.
 * Used by the DocumentIntelligenceRouter before creating new assignment entries.
 *
 * @param {string} batchId - The batch ObjectId
 * @param {string} courseCode - The course code (maps to subject field in Assignment model)
 * @param {string} title - The assignment title (will be normalized to lowercase)
 * @returns {Promise<{isDuplicate: boolean, existing?: object}>}
 */
export async function checkAssignmentDuplicate(batchId, courseCode, title) {
  try {
    if (!title) {
      return { isDuplicate: false };
    }

    const normalizedTitle = title.toLowerCase().trim();

    // Use case-insensitive regex for title matching
    const existing = await Assignment.findOne({
      batchId,
      subject: courseCode,
      title: { $regex: new RegExp(`^${normalizedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    }).lean();

    if (existing) {
      return {
        isDuplicate: true,
        existing: {
          title: existing.title,
          subject: existing.subject,
          deadline: existing.deadline,
          status: existing.status,
        },
      };
    }

    return { isDuplicate: false };
  } catch (err) {
    console.error('[TimetableManager] checkAssignmentDuplicate error:', err.message);
    return { isDuplicate: false };
  }
}
