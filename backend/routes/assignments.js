import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Assignment } from '../models/Assignment.js';
import { StudentAssignmentStatus } from '../models/StudentAssignmentStatus.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { calculatePriorityScore } from '../services/priorityScore.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /api/assignments
 * Query: batchId (optional)
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};
    if (batchId) {
      filter.batchId = batchId;
    } else {
      filter.userId = req.user._id;
      filter.batchId = null;
    }

    const assignments = await Assignment.find(filter)
      .sort({ deadline: 1 })
      .populate('batchId', 'batchName');
    
    const statuses = await StudentAssignmentStatus.find({ userId: req.user._id });
    const statusMap = {};
    statuses.forEach(s => { statusMap[s.assignmentId.toString()] = s.status; });

    const enriched = assignments.map(a => {
      const aObj = a.toObject();
      aObj.status = statusMap[a._id.toString()] || a.status;
      return aObj;
    });

    return ok(res, enriched);
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

    const userStatus = await StudentAssignmentStatus.findOne({ userId: req.user._id, assignmentId: assignment._id });
    const aObj = assignment.toObject();
    if (userStatus) {
      aObj.status = userStatus.status;
    }

    return ok(res, aObj);
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
      userId: req.user._id,
      batchId: batchId === 'personal' ? null : batchId,
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
        batchId: batchId === 'personal' ? null : batchId,
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

    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return fail(res, 'Assignment not found', 404);

    const updatedStatus = await StudentAssignmentStatus.findOneAndUpdate(
      { userId: req.user._id, assignmentId: assignment._id },
      { status },
      { upsert: true, new: true }
    );

    const aObj = assignment.toObject();
    aObj.status = updatedStatus.status;

    return ok(res, aObj);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

export default router;
