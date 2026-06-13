import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Assignment } from '../models/Assignment.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { calculatePriorityScore } from '../services/priorityScore.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /api/assignments
 * Query: batchId (required)
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};
    if (batchId) filter.batchId = batchId;

    const assignments = await Assignment.find(filter).sort({ deadline: 1 });
    return ok(res, assignments);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * GET /api/assignments/:id
 */
router.get('/:id', verifyFirebaseToken, async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return fail(res, 'Assignment not found', 404);
    return ok(res, assignment);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * POST /api/assignments
 * Create manually or from upload finalize
 */
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId, postId, title, subject, deadline, submissionMode, actionRequired } = req.body;
    if (!batchId || !title) return fail(res, 'batchId and title are required', 400);

    const { priorityScore, priorityLevel } = calculatePriorityScore({
      deadline,
      category: 'assignment',
      verified: true,
    });

    const assignment = await Assignment.create({
      batchId,
      postId: postId || null,
      title,
      subject: subject || '',
      deadline: deadline || null,
      submissionMode: submissionMode || 'online',
      priorityScore,
      priorityLevel,
      status: 'Not Started',
      actionRequired: actionRequired || '',
    });

    // Create calendar event
    if (deadline) {
      await CalendarEvent.create({
        userId: req.user._id,
        batchId,
        title: `Assignment: ${title}`,
        category: 'assignment',
        date: new Date(deadline),
        sourceType: 'assignment',
        sourceId: assignment._id,
        status: 'upcoming',
      });
    }

    return ok(res, assignment, 201);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * PATCH /api/assignments/:id/status
 * Body: { status: 'Not Started' | 'In Progress' | 'Submitted' | 'Missed' }
 */
router.patch('/:id/status', verifyFirebaseToken, async (req, res) => {
  try {
    const { status } = req.body;
    const valid = ['Not Started', 'In Progress', 'Submitted', 'Missed'];
    if (!valid.includes(status)) return fail(res, `status must be one of: ${valid.join(', ')}`, 400);

    const assignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!assignment) return fail(res, 'Assignment not found', 404);
    return ok(res, assignment);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

export default router;
