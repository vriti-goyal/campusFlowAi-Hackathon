import { Router } from 'express';
import multer from 'multer';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { uploadToS3 } from '../config/s3.js';
import { extractTextFromBuffer } from '../utils/extractText.js';
import { processUpload } from '../services/aiPipeline.js';
import { routeDocument } from '../services/documentRouter.js';
import { detectDocumentType, extractTimetableFromText, extractExamScheduleFromText, extractTimetableUpdateFromText } from '../services/documentExtractor.js';
import { Post } from '../models/Post.js';
import { Timetable } from '../models/Timetable.js';
import { TimetableOverride } from '../models/TimetableOverride.js';
import { TimetableLog } from '../models/TimetableLog.js';
import { ExamSchedule } from '../models/ExamSchedule.js';
import { Notification } from '../models/Notification.js';
import { BatchMember } from '../models/BatchMember.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

// Multer — memory storage, max 10 MB, accepted file types
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'image/png', 'image/jpg', 'image/jpeg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only PDF, PNG, JPG, JPEG files are accepted'));
  },
});

/**
 * POST /api/upload/file
 * Multipart file upload → S3 → AI pipeline → create Post
 *
 * Uses DocumentClassifier → CourseFilter → DocumentIntelligenceRouter pipeline.
 * Multi-category classification routes documents to appropriate modules.
 * Falls back to general Post creation for unclassified documents.
 */
router.post('/file', verifyFirebaseToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return fail(res, 'No file provided', 400);

    const { batchId, targetType, targetBatchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);

    const resolvedBatchId = (batchId && batchId !== 'personal') ? batchId : null;
    const resolvedTargetBatchId = (targetBatchId && targetBatchId !== 'personal') ? targetBatchId : null;

    // Upload to S3
    const fileUrl = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);

    // Extract text via local parsers/OCR (with Groq vision fallback for images)
    let extractedText = '';
    try {
      extractedText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
    } catch (err) {
      console.error('[Upload] Vision extraction failed:', err.message);
    }

    // ── Auto-detect document type ──
    const docType = extractedText ? detectDocumentType(extractedText) : 'general';
    console.log(`[Upload] Detected document type: ${docType}`);

    // ── Timetable detected ──
    if (docType === 'timetable' && targetBatchId && targetBatchId !== 'personal') {
      // Verify admin access
      const membership = await BatchMember.findOne({ batchId: resolvedTargetBatchId, userId: req.user._id });
      if (!membership || !['owner', 'moderator'].includes(membership.role)) {
        return fail(res, 'Only batch owners or moderators can upload timetables. This PDF looks like a timetable.', 403);
      }

      const rows = await extractTimetableFromText(extractedText);
      if (!rows || rows.length === 0) {
        return fail(res, 'AI detected a timetable but could not extract entries. Try a clearer PDF.', 400);
      }

      // Build day map and upsert
      const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayMap = {};
      for (const row of rows) {
        const rawDay = row.day?.trim() || '';
        const dayStr = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
        if (!validDays.includes(dayStr)) continue;
        if (!dayMap[dayStr]) dayMap[dayStr] = [];
        dayMap[dayStr].push({
          time: row.time?.trim() || '',
          courseCode: (row.course_code || '').trim().toUpperCase(),
          courseName: (row.course_name || '').trim(),
          venue: row.venue?.trim() || '',
          faculty: row.faculty?.trim() || '',
        });
      }

      let updatedDays = 0;
      for (const day of validDays) {
        const slots = dayMap[day];
        if (slots && slots.length > 0) {
          await Timetable.findOneAndUpdate(
            { batchId: resolvedTargetBatchId, dayOfWeek: day },
            { slots, uploadedBy: req.user._id },
            { upsert: true, new: true }
          );
          updatedDays++;
        }
      }

      const totalSlots = Object.values(dayMap).reduce((s, arr) => s + arr.length, 0);

      return ok(res, {
        autoDetected: 'timetable',
        message: `📅 Timetable detected! Extracted ${totalSlots} class slots across ${updatedDays} days.`,
        updatedDays,
        totalSlots,
        fileUrl,
      }, 201);
    }

    // ── Timetable Update detected ──
    if (docType === 'timetable_update' && targetBatchId && targetBatchId !== 'personal') {
      const membership = await BatchMember.findOne({ batchId: resolvedTargetBatchId, userId: req.user._id });
      if (!membership || !['owner', 'moderator'].includes(membership.role)) {
        return fail(res, 'Only batch owners or moderators can upload timetable updates.', 403);
      }

      const updates = await extractTimetableUpdateFromText(extractedText);
      if (!updates || updates.length === 0) {
        return fail(res, 'AI detected a timetable update but could not extract details. Try a clearer PDF.', 400);
      }

      let processedUpdates = 0;
      for (const update of updates) {
        // Find matching timetable slot for the course
        const timetables = await Timetable.find({ batchId: resolvedTargetBatchId });
        let targetSlot = null;
        let targetDayOfWeek = '';

        for (const tt of timetables) {
          const slot = tt.slots.find(s => s.courseCode === update.course_code);
          if (slot) {
            targetSlot = slot;
            targetDayOfWeek = tt.dayOfWeek;
            break;
          }
        }

        if (targetSlot) {
          if (update.change_type === 'permanent') {
            // Permanent Update
            targetSlot.time = update.new_details?.time || targetSlot.time;
            targetSlot.venue = update.new_details?.venue || targetSlot.venue;
            targetSlot.faculty = update.new_details?.faculty || targetSlot.faculty;
            
            await Timetable.updateOne(
              { batchId: resolvedTargetBatchId, dayOfWeek: targetDayOfWeek, 'slots._id': targetSlot._id },
              { $set: { 'slots.$': targetSlot } }
            );

            await TimetableLog.create({
              batchId: resolvedTargetBatchId,
              adminName: 'AI Notice Detector',
              changeType: 'permanent',
              reason: update.reason || 'Notice Upload',
              description: `AI Permanent Update for ${update.course_code}: ${update.override_type}`
            });
          } else {
            // Temporary Override
            await TimetableOverride.create({
              batchId: resolvedTargetBatchId,
              originalSlotId: targetSlot._id,
              date: update.date,
              overrideType: update.override_type,
              newDetails: update.new_details,
              reason: update.reason || 'AI extracted from notice',
              adminName: 'AI Notice Detector',
              status: 'pending_review' // Flag for admin review
            });

            await TimetableLog.create({
              batchId: resolvedTargetBatchId,
              adminName: 'AI Notice Detector',
              changeType: 'temporary',
              reason: update.reason || 'Notice Upload',
              description: `AI Temporary Override for ${update.course_code} on ${update.date}: ${update.override_type}`
            });
          }

          // Trigger Notification to enrolled members
          const members = await BatchMember.find({ batchId: resolvedTargetBatchId, role: 'student' });
          const notifications = members.map(m => ({
            userId: m.userId,
            batchId: resolvedTargetBatchId,
            title: `Class ${update.override_type.toUpperCase()}`,
            message: `${update.course_code} has been ${update.override_type.replace('_', ' ')} for ${update.date}.`,
            type: 'announcement'
          }));
          
          if (notifications.length > 0) {
            await Notification.insertMany(notifications);
          }

          processedUpdates++;
        }
      }

      return ok(res, {
        autoDetected: 'timetable_update',
        message: `🔄 Timetable update detected! Processed ${processedUpdates} modifications.`,
        processedUpdates,
        fileUrl,
      }, 201);
    }

    // ── Exam Schedule detected ──
    if (docType === 'exam_schedule' && targetBatchId && targetBatchId !== 'personal') {
      const membership = await BatchMember.findOne({ batchId: resolvedTargetBatchId, userId: req.user._id });
      if (!membership || !['owner', 'moderator'].includes(membership.role)) {
        return fail(res, 'Only batch owners or moderators can upload exam schedules. This PDF looks like an exam schedule.', 403);
      }

      const rows = await extractExamScheduleFromText(extractedText);
      if (!rows || rows.length === 0) {
        return fail(res, 'AI detected an exam schedule but could not extract entries. Try a clearer PDF.', 400);
      }

      // Build entries and insert
      const entries = [];
      for (const row of rows) {
        const courseCode = row.course_code?.trim();
        const rawDate = row.exam_date?.trim();
        if (!courseCode || !rawDate) continue;
        const examDate = new Date(rawDate);
        if (isNaN(examDate.getTime())) continue;

        entries.push({
          batchId: resolvedTargetBatchId,
          courseCode: courseCode.toUpperCase(),
          courseName: row.course_name?.trim() || '',
          examDate,
          examTime: row.exam_time?.trim() || '',
          venue: row.venue?.trim() || '',
          uploadedBy: req.user._id,
          uploadedAt: new Date(),
        });
      }

      if (entries.length === 0) {
        return fail(res, 'AI detected an exam schedule but entries had invalid dates. Try a clearer PDF.', 400);
      }

      await ExamSchedule.deleteMany({ batchId: resolvedTargetBatchId });
      await ExamSchedule.insertMany(entries);

      return ok(res, {
        autoDetected: 'exam_schedule',
        message: `📝 Exam schedule detected! Extracted ${entries.length} exam entries.`,
        inserted: entries.length,
        fileUrl,
      }, 201);
    }

    const resolvedTargetType = targetType === 'personal' ? 'personal' : 'batch';
    const finalTargetBatchId = resolvedTargetType === 'batch' && resolvedTargetBatchId ? resolvedTargetBatchId : null;

    // Determine routing batchId: prefer targetBatchId when available and not 'personal'
    const routingBatchId = finalTargetBatchId ? finalTargetBatchId : resolvedBatchId;

    // ── Route through DocumentIntelligenceRouter pipeline ──
    if (extractedText) {
      try {
        const routeResult = await routeDocument({
          text: extractedText,
          userId: req.user._id,
          batchId: routingBatchId,
          fileUrl,
          user: req.user,
          targetType: resolvedTargetType,
          targetBatchId: finalTargetBatchId,
        });

        // Determine if we should fall back to general Post creation:
        // 1. categories is ['general'] (classification fallback or all extractions/routing failed)
        // 2. routing.general has status 'fallback' (all routing failed in Step 6)
        // 3. ALL routing entries have status 'failed' (independent safety check)
        const categories = routeResult?.data?.categories || [];
        const isGeneralFallback = categories.length === 1 && categories[0] === 'general';
        const allRoutingFailed = routeResult?.data?.routing?.general?.status === 'fallback';

        // Independent check: if every routing entry has status 'failed', treat as all-failed
        const routingEntries = Object.values(routeResult?.data?.routing || {});
        const allEntriesFailed = routingEntries.length > 0 &&
          routingEntries.every((r) => r.status === 'failed');

        if (!isGeneralFallback && !allRoutingFailed && !allEntriesFailed) {
          // Return enhanced multi-category response from the router
          return ok(res, routeResult.data, 201);
        }
      } catch (routeErr) {
        console.error('[Upload] DocumentRouter failed, falling back to general pipeline:', routeErr.message);
        // Fall through to general Post creation below
      }
    }

    // ── General document fallback (existing pipeline) ──
    const extraction = await processUpload(fileUrl, resolvedBatchId, req.user._id, extractedText);

    const post = await Post.create({
      batchId: resolvedBatchId,
      uploadedBy: req.user._id,
      type: extraction.extractedType || 'general',
      title: extraction.title,
      originalText: '',
      fileUrl,
      summary: extraction.summary,
      actionRequired: extraction.actionRequired,
      category: extraction.category,
      priorityScore: extraction.priorityScore,
      priorityLevel: extraction.priorityLevel,
      verificationStatus: 'unverified',
      isDuplicate: false,
      targetType: resolvedTargetType,
      targetBatchId: finalTargetBatchId,
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload file error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

/**
 * POST /api/upload/text
 * Text input → DocumentClassifier → CourseFilter → DocumentIntelligenceRouter pipeline.
 * Multi-category classification routes text to appropriate modules.
 * Falls back to general Post creation for unclassified or "general" fallback documents.
 */
router.post('/text', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, text, targetType, targetBatchId } = req.body;
    if (!batchId) return fail(res, 'batchId is required', 400);
    if (!text || !text.trim()) return fail(res, 'text is required', 400);

    const resolvedBatchId = (batchId && batchId !== 'personal') ? batchId : null;
    const resolvedTargetBatchId = (targetBatchId && targetBatchId !== 'personal') ? targetBatchId : null;

    const resolvedTargetType = targetType === 'personal' ? 'personal' : 'batch';
    const finalTargetBatchId = resolvedTargetType === 'batch' && resolvedTargetBatchId ? resolvedTargetBatchId : null;

    // Determine routing batchId: prefer targetBatchId when available and not 'personal'
    const routingBatchId = finalTargetBatchId ? finalTargetBatchId : resolvedBatchId;

    // ── Route through DocumentIntelligenceRouter pipeline ──
    try {
      const routeResult = await routeDocument({
        text,
        userId: req.user._id,
        batchId: routingBatchId,
        fileUrl: '',
        user: req.user,
        targetType: resolvedTargetType,
        targetBatchId: finalTargetBatchId,
      });

      // Determine if we should fall back to general Post creation:
      const categories = routeResult?.data?.categories || [];
      const isGeneralFallback = categories.length === 1 && categories[0] === 'general';
      const allRoutingFailed = routeResult?.data?.routing?.general?.status === 'fallback';

      const routingEntries = Object.values(routeResult?.data?.routing || {});
      const allEntriesFailed = routingEntries.length > 0 &&
        routingEntries.every((r) => r.status === 'failed');

      if (!isGeneralFallback && !allRoutingFailed && !allEntriesFailed) {
        return ok(res, routeResult.data, 201);
      }
    } catch (routeErr) {
      console.error('[Upload] DocumentRouter failed for text, falling back to general pipeline:', routeErr.message);
    }

    // ── General document fallback (existing pipeline) ──
    const extraction = await processUpload(null, resolvedBatchId, req.user._id, text);

    const post = await Post.create({
      batchId: resolvedBatchId,
      uploadedBy: req.user._id,
      type: extraction.extractedType || 'general',
      title: extraction.title,
      originalText: text,
      fileUrl: '',
      summary: extraction.summary,
      actionRequired: extraction.actionRequired,
      category: extraction.category,
      priorityScore: extraction.priorityScore,
      priorityLevel: extraction.priorityLevel,
      verificationStatus: 'unverified',
      isDuplicate: false,
      targetType: resolvedTargetType,
      targetBatchId: finalTargetBatchId,
    });

    return ok(res, { post, extraction }, 201);
  } catch (err) {
    console.error('Upload text error:', err);
    return fail(res, err.message || 'Upload failed', 500);
  }
});

export default router;
