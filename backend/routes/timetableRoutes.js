import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Timetable } from '../models/Timetable.js';
import { TimetableOverride } from '../models/TimetableOverride.js';
import { TimetableLog } from '../models/TimetableLog.js';
import { BatchMember } from '../models/BatchMember.js';
import { Notification } from '../models/Notification.js';
import { uploadToS3 } from '../config/s3.js';
import { extractTextFromBuffer } from '../utils/extractText.js';
import { extractTimetableFromText } from '../services/documentExtractor.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Accept both CSV and PDF/image files
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['text/csv', 'application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith('.csv')) cb(null, true);
    else cb(new Error('Only CSV, PDF, PNG, JPG files are accepted'));
  },
});

function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('CSV must have a header row and data');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    if (values.length < 2) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

/**
 * Convert rows (from CSV or AI extraction) into dayMap grouped by day.
 */
function buildDayMap(rows) {
  const dayMap = {};
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  for (const row of rows) {
    const rawDay = row.day?.trim() || '';
    const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();

    if (!validDays.includes(dayStr)) continue;
    if (!row.time && !row.course_code) continue;

    if (!dayMap[dayStr]) dayMap[dayStr] = [];
    dayMap[dayStr].push({
      time: row.time?.trim() || '',
      courseCode: (row.course_code || row.courseCode || '').trim().toUpperCase(),
      courseName: (row.course_name || row.courseName || '').trim(),
      venue: row.venue?.trim() || '',
      faculty: row.faculty?.trim() || '',
      classType: row.classType?.trim() || 'Theory',
    });
  }

  return dayMap;
}

/**
 * Upsert timetable slots from a dayMap into DB.
 */
async function upsertTimetable(batchId, dayMap, userId) {
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  let updatedDays = 0;
  for (const day of validDays) {
    const slots = dayMap[day];
    if (slots && slots.length > 0) {
      await Timetable.findOneAndUpdate(
        { batchId, dayOfWeek: day },
        { slots, uploadedBy: userId },
        { upsert: true, new: true }
      );
      updatedDays++;
    }
  }
  return updatedDays;
}

/**
 * POST /api/timetable/upload
 * Accepts CSV or PDF/image.
 * - CSV: parsed directly
 * - PDF/image: uploaded to S3 → Textract → AI extraction via Bedrock
 */
router.post('/upload', verifyFirebaseToken, fileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file provided', 400);

    const { batchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);

    await requireOwner(batchId, req.user._id);

    const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
    let rows;

    if (isCSV) {
      // ── CSV path (same as before) ──
      try {
        rows = parseCSV(req.file.buffer);
      } catch (parseErr) {
        return fail(res, `CSV parse error: ${parseErr.message}`, 400);
      }
    } else {
      // ── PDF/Image path: S3 → Textract → AI ──
      console.log('[Timetable] PDF/image upload detected, running AI extraction...');

      // Upload to S3
      const fileUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

      // Extract text via local extraction utility
      const extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      if (!extractedText || !extractedText.trim()) {
        return fail(res, 'Could not extract text from the uploaded file. Try a clearer image/PDF.', 400);
      }

      // AI extraction
      rows = await extractTimetableFromText(extractedText);
      if (!rows || rows.length === 0) {
        return fail(res, 'AI could not detect any timetable entries in the document. Please try a clearer PDF or use CSV format.', 400);
      }

      console.log(`[Timetable] AI extracted ${rows.length} slots from PDF`);
    }

    // Build day map and upsert
    const dayMap = buildDayMap(rows);
    const updatedDays = await upsertTimetable(batchId, dayMap, req.user._id);

    const totalSlots = Object.values(dayMap).reduce((sum, s) => sum + s.length, 0);

    return ok(res, {
      message: `Timetable updated: ${totalSlots} slots across ${updatedDays} days.`,
      updatedDays,
      totalSlots,
      source: isCSV ? 'csv' : 'ai_extraction',
    }, 201);
  } catch (err) {
    console.error('[Timetable Upload Error]', err.message);
    return fail(res, err.message, 500);
  }
});

/**
 * GET /api/timetable/my-timetable
 */
router.get('/my-timetable', verifyFirebaseToken, async (req, res) => {
  try {
    const { day } = req.query;
    
    let targetDay = day;
    if (!targetDay) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      targetDay = days[new Date().getDay()];
    }

    const memberships = await BatchMember.find({ userId: req.user._id }).lean();
    if (!memberships.length) return ok(res, []);

    const batchIds = memberships.map(m => m.batchId);

    const timetables = await Timetable.find({
      batchId: { $in: batchIds },
      dayOfWeek: targetDay
    }).populate('batchId', 'batchName batchCode').lean();

    // Fetch applicable overrides for the exact target date
    const dateObj = new Date();
    // Assuming targetDate could be passed in query or we just find overrides for today
    const reqDate = req.query.date || dateObj.toISOString().split('T')[0];

    const overrides = await TimetableOverride.find({
      batchId: { $in: batchIds },
      date: reqDate,
      status: 'active'
    }).lean();

    return ok(res, { timetables, overrides });
  } catch (err) {
    console.error('[My Timetable Get Error]', err.message);
    return fail(res, 'Failed to fetch timetable', 500);
  }
});

/**
 * GET /api/timetable/batch/:batchId
 */
router.get('/batch/:batchId', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.params;

    const membership = await BatchMember.findOne({ batchId, userId: req.user._id });
    if (!membership) return fail(res, 'You are not a member of this batch', 403);

    const timetables = await Timetable.find({ batchId }).lean();
    
    // Fetch overrides for today
    const reqDate = req.query.date || new Date().toISOString().split('T')[0];
    const overrides = await TimetableOverride.find({
      batchId,
      date: reqDate,
      status: 'active'
    }).lean();

    return ok(res, { timetables, overrides });
  } catch (err) {
    console.error('[Batch Timetable Get Error]', err.message);
    return fail(res, 'Failed to fetch batch timetable', 500);
  }
});

/**
 * DELETE /api/timetable/batch/:batchId
 * Clear the entire timetable for a batch (Super Admin only)
 */
router.delete('/batch/:batchId', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.params;
    await requireOwner(batchId, req.user._id);

    await Timetable.deleteMany({ batchId });
    await TimetableOverride.deleteMany({ batchId });

    await TimetableLog.create({
      batchId,
      adminName: req.user.name || 'Admin',
      changeType: 'deletion',
      reason: 'Batch Timetable Cleared',
      description: 'The entire timetable was deleted by the owner.'
    });

    return ok(res, { message: 'Timetable cleared successfully' });
  } catch (err) {
    return fail(res, err.message, err.message.includes('Unauthorized') ? 403 : 500);
  }
});

// ── Admin Timetable Management (CRUD) ──

async function requireOwner(batchId, userId) {
  const membership = await BatchMember.findOne({ batchId, userId });
  if (!membership || membership.role !== 'owner') {
    throw new Error('Unauthorized. Only batch owners can manage permanent timetable schedules.');
  }
}

async function requireModerator(batchId, userId) {
  const membership = await BatchMember.findOne({ batchId, userId });
  if (!membership || !['owner', 'moderator'].includes(membership.role)) {
    throw new Error('Unauthorized. Only batch owners or moderators can apply temporary overrides.');
  }
}

/**
 * POST /api/timetable/slot
 */
router.post('/slot', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, dayOfWeek, time, courseCode, courseName, venue, faculty, classType, reason } = req.body;
    await requireOwner(batchId, req.user._id);

    let timetable = await Timetable.findOne({ batchId, dayOfWeek });
    if (!timetable) {
      timetable = new Timetable({ batchId, dayOfWeek, slots: [], uploadedBy: req.user._id });
    }

    timetable.slots.push({ time, courseCode, courseName, venue, faculty, classType: classType || 'Theory' });
    await timetable.save();

    await TimetableLog.create({
      batchId,
      adminName: req.user.name || 'Admin',
      changeType: 'creation',
      reason: reason || '',
      description: `Added slot for ${courseCode} on ${dayOfWeek} at ${time}`
    });

    return ok(res, { message: 'Slot added', timetable });
  } catch (err) {
    return fail(res, err.message, err.message.includes('Unauthorized') ? 403 : 500);
  }
});

/**
 * PUT /api/timetable/slot/:slotId
 */
router.put('/slot/:slotId', verifyFirebaseToken, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { batchId, time, courseCode, courseName, venue, faculty, classType, reason } = req.body;
    await requireOwner(batchId, req.user._id);

    const timetable = await Timetable.findOne({ batchId, 'slots._id': slotId });
    if (!timetable) return fail(res, 'Slot not found', 404);

    const slot = timetable.slots.id(slotId);
    if (!slot) return fail(res, 'Slot not found', 404);

    slot.time = time || slot.time;
    slot.courseCode = courseCode || slot.courseCode;
    slot.courseName = courseName !== undefined ? courseName : slot.courseName;
    slot.venue = venue !== undefined ? venue : slot.venue;
    slot.faculty = faculty !== undefined ? faculty : slot.faculty;
    slot.classType = classType !== undefined ? classType : slot.classType;
    
    await timetable.save();

    await TimetableLog.create({
      batchId,
      adminName: req.user.name || 'Admin',
      changeType: 'permanent',
      reason: reason || '',
      description: `Updated slot ${courseCode} for ${timetable.dayOfWeek} at ${time}`
    });

    return ok(res, { message: 'Slot updated', timetable });
  } catch (err) {
    return fail(res, err.message, err.message.includes('Unauthorized') ? 403 : 500);
  }
});

/**
 * DELETE /api/timetable/slot/:slotId
 */
router.delete('/slot/:slotId', verifyFirebaseToken, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { batchId, reason } = req.body;
    await requireOwner(batchId, req.user._id);

    const timetable = await Timetable.findOne({ batchId, 'slots._id': slotId });
    if (!timetable) return fail(res, 'Slot not found', 404);

    const slot = timetable.slots.id(slotId);
    if (!slot) return fail(res, 'Slot not found', 404);
    
    const courseInfo = `${slot.courseCode} at ${slot.time}`;
    timetable.slots.pull(slotId);
    await timetable.save();

    await TimetableLog.create({
      batchId,
      adminName: req.user.name || 'Admin',
      changeType: 'deletion',
      reason: reason || '',
      description: `Deleted slot ${courseInfo} on ${timetable.dayOfWeek}`
    });

    return ok(res, { message: 'Slot deleted' });
  } catch (err) {
    return fail(res, err.message, err.message.includes('Unauthorized') ? 403 : 500);
  }
});

/**
 * POST /api/timetable/override
 */
router.post('/override', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, originalSlotId, date, overrideType, newDetails, reason } = req.body;
    await requireModerator(batchId, req.user._id);

    const override = await TimetableOverride.create({
      batchId,
      originalSlotId,
      date,
      overrideType,
      newDetails,
      reason,
      adminName: req.user.name || 'Admin'
    });

    await TimetableLog.create({
      batchId,
      adminName: req.user.name || 'Admin',
      changeType: 'temporary',
      reason: reason || '',
      description: `Applied ${overrideType} override for slot ${originalSlotId} on ${date}`
    });

    // Notify all students in the batch
    const students = await BatchMember.find({ batchId, role: 'student' }).select('userId');
    if (students.length > 0) {
      const studentIds = students.map(s => s.userId);
      await Notification.insertMany(studentIds.map(userId => ({
        userId,
        title: 'Timetable Update',
        message: `A timetable slot on ${date} has been ${overrideType.replace('_', ' ')}. Check your timetable for details.`,
        type: 'timetable_update',
        link: '/dashboard/timetable'
      })));
    }

    return ok(res, { message: 'Override applied', override });
  } catch (err) {
    return fail(res, err.message, err.message.includes('Unauthorized') ? 403 : 500);
  }
});

export default router;
