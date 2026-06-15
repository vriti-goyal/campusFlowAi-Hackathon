import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Exam } from '../models/Exam.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /api/exams
 * Query: batchId
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};
    if (batchId) filter.batchId = batchId;

    const exams = await Exam.find(filter)
      .sort({ date: 1 })
      .populate('batchId', 'batchName');
    return ok(res, exams);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * GET /api/exams/:id
 */
router.get('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return fail(res, 'Exam not found', 404);
    return ok(res, exam);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * POST /api/exams
 */
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, postId, subject, date, time, venue, priorityLevel } = req.body;
    if (!batchId || !subject || !date) return fail(res, 'batchId, subject, and date are required', 400);

    const exam = await Exam.create({
      batchId,
      postId: postId || null,
      subject,
      date: new Date(date),
      time: time || '',
      venue: venue || '',
      priorityLevel: priorityLevel || 'high',
    });

    // Create calendar event
    const calEvent = await CalendarEvent.create({
      userId: req.user._id,
      batchId,
      title: `Exam: ${subject}`,
      category: 'exam',
      date: new Date(date),
      time: time || '',
      sourceType: 'exam',
      sourceId: exam._id,
      status: 'upcoming',
    });

    // Link calendar event
    exam.calendarEventId = calEvent._id;
    await exam.save();

    return ok(res, exam, 201);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

export default router;
