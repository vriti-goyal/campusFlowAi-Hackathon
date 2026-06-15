import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { ExamSchedule } from '../models/ExamSchedule.js';
import { BatchMember } from '../models/BatchMember.js';
import { Batch } from '../models/Batch.js';
import { uploadToS3 } from '../config/s3.js';
import { extractTextFromBuffer } from '../utils/extractText.js';
import { extractExamScheduleFromText } from '../services/documentExtractor.js';
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
  if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

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
 * Convert rows (from CSV or AI extraction) into exam schedule entries.
 */
function buildExamEntries(rows, batchId, userId) {
  const entries = [];
  const skipped = [];

  for (const row of rows) {
    const courseCode = row.course_code?.trim();
    const rawDate = row.exam_date?.trim();
    if (!courseCode || !rawDate) { skipped.push(row); continue; }

    const examDate = new Date(rawDate);
    if (isNaN(examDate.getTime())) { skipped.push(row); continue; }

    entries.push({
      batchId,
      courseCode: courseCode.toUpperCase(),
      courseName: row.course_name?.trim() || '',
      examDate,
      examTime: row.exam_time?.trim() || '',
      venue: row.venue?.trim() || '',
      uploadedBy: userId,
      uploadedAt: new Date(),
    });
  }

  return { entries, skipped };
}

/**
 * POST /api/exam-schedule/upload
 * Accepts CSV or PDF/image.
 * - CSV: parsed directly
 * - PDF/image: S3 → Textract → AI extraction via Bedrock
 */
router.post('/upload', verifyFirebaseToken, fileUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file provided', 400);

    const { batchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);

    const membership = await BatchMember.findOne({ batchId, userId: req.user._id });
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      return fail(res, 'Only batch owners or moderators can upload exam schedules', 403);
    }

    const isCSV = req.file.mimetype === 'text/csv' || req.file.originalname.endsWith('.csv');
    let rows;

    if (isCSV) {
      // ── CSV path ──
      try {
        rows = parseCSV(req.file.buffer);
      } catch (parseErr) {
        return fail(res, `CSV parse error: ${parseErr.message}`, 400);
      }

      // Validate required columns
      if (rows.length > 0) {
        const sample = rows[0];
        if (!('course_code' in sample) || !('exam_date' in sample)) {
          return fail(res, 'CSV must contain columns: course_code, exam_date', 400);
        }
      }
    } else {
      // ── PDF/Image path: AI extraction ──
      console.log('[ExamSchedule] PDF/image upload detected, running AI extraction...');

      let extractedText = '';
      try {
        extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
      } catch (extractErr) {
        console.error('[ExamSchedule] AI extraction failed:', extractErr.message);
        // Give a clean, actionable error — not the raw AI error
        return fail(res, '⚠️ AI extraction is currently unavailable (API quota exceeded). Please use CSV format instead.\n\nCSV columns needed: course_code, course_name, exam_date, exam_time, venue', 400);
      }

      if (!extractedText || !extractedText.trim()) {
        return fail(res, '⚠️ AI could not read text from this file. Please use CSV format instead.\n\nCSV columns needed: course_code, course_name, exam_date, exam_time, venue', 400);
      }

      rows = await extractExamScheduleFromText(extractedText);
      if (!rows || rows.length === 0) {
        return fail(res, 'AI could not detect exam schedule entries in this document. Try a clearer PDF or switch to CSV format.', 400);
      }

      console.log(`[ExamSchedule] AI extracted ${rows.length} exam entries from PDF`);
    }

    const { entries, skipped } = buildExamEntries(rows, batchId, req.user._id);

    if (entries.length === 0) {
      return fail(res, 'No valid exam entries found. Check that course_code and exam_date are present.', 400);
    }

    // Replace existing schedule for this batch
    await ExamSchedule.deleteMany({ batchId });
    await ExamSchedule.insertMany(entries);

    console.log(`[ExamSchedule] Uploaded ${entries.length} entries for batch ${batchId}`);

    return ok(res, {
      inserted: entries.length,
      skipped: skipped.length,
      message: `Exam schedule uploaded: ${entries.length} entries added, ${skipped.length} rows skipped.`,
      source: isCSV ? 'csv' : 'ai_extraction',
    }, 201);
  } catch (err) {
    console.error('[ExamSchedule Upload] Error:', err.message);
    return fail(res, err.message || 'Failed to upload exam schedule', 500);
  }
});

/**
 * GET /api/exam-schedule
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const memberships = await BatchMember.find({ userId: req.user._id }).lean();
    if (!memberships.length) return ok(res, []);

    const batchIds = memberships.map((m) => m.batchId);

    const batches = await Batch.find({
      _id: { $in: batchIds },
      status: { $ne: 'deleted' },
    }).lean();

    if (!batches.length) return ok(res, []);

    const batchCourseMap = {};
    for (const batch of batches) {
      batchCourseMap[batch._id.toString()] = new Set(
        (batch.courses || []).map((c) => c.code.toUpperCase())
      );
    }

    const allEntries = await ExamSchedule.find({
      batchId: { $in: batchIds },
      examDate: { $gte: new Date() },
    })
      .sort({ examDate: 1 })
      .lean();

    const relevant = allEntries.filter((entry) => {
      const batchCodes = batchCourseMap[entry.batchId.toString()];
      if (!batchCodes || batchCodes.size === 0) return true;
      return batchCodes.has(entry.courseCode.toUpperCase());
    });

    return ok(res, relevant);
  } catch (err) {
    console.error('[ExamSchedule Get] Error:', err.message);
    return fail(res, 'Failed to fetch exam schedule', 500);
  }
});

/**
 * GET /api/exam-schedule/batch/:batchId
 */
router.get('/batch/:batchId', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.params;

    const membership = await BatchMember.findOne({ batchId, userId: req.user._id });
    if (!membership) return fail(res, 'You are not a member of this batch', 403);

    const entries = await ExamSchedule.find({ batchId })
      .sort({ examDate: 1 })
      .lean();

    return ok(res, entries);
  } catch (err) {
    console.error('[ExamSchedule Batch Get] Error:', err.message);
    return fail(res, 'Failed to fetch batch exam schedule', 500);
  }
});

export default router;
