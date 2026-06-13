import { Router } from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Placement } from '../models/Placement.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { calculatePriorityScore } from '../services/priorityScore.js';
import { ok, fail } from '../utils/response.js';

const router = Router();

/**
 * GET /api/placements
 * Returns placements with computed eligibilityStatus for the requesting user.
 * Query: batchId
 */
router.get('/', verifyFirebaseToken, async (req, res) => {
  try {
    const { batchId } = req.query;
    const filter = {};
    if (batchId) filter.batchId = batchId;

    const placements = await Placement.find(filter).sort({ deadline: 1 });

    // Get user's profile for eligibility check
    const userCgpa = req.user.cgpa || 0;
    const userBranch = req.user.branch || '';

    // Get existing application statuses
    const statuses = await StudentPlacementStatus.find({ userId: req.user._id });
    const statusMap = {};
    statuses.forEach((s) => {
      statusMap[s.placementId.toString()] = s;
    });

    const enriched = placements.map((p) => {
      const pObj = p.toObject();
      const existing = statusMap[p._id.toString()];

      // Compute eligibility
      const meetsGpa = userCgpa >= (p.minimumCgpa || 0);
      const meetsBranch = !p.eligibleBranches.length || p.eligibleBranches.includes(userBranch);
      const eligible = meetsGpa && meetsBranch;

      pObj.eligibilityStatus = eligible ? 'eligible' : 'not_eligible';
      pObj.applicationStatus = existing?.status || 'Not Applied';
      pObj.appliedAt = existing?.appliedAt || null;

      return pObj;
    });

    return ok(res, enriched);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * POST /api/placements
 */
router.post('/', verifyFirebaseToken, async (req, res) => {
  try {
    const {
      batchId, postId, company, role, package: pkg, eligibleBranches,
      minimumCgpa, allowedBacklogs, deadline, testDate, applicationLink,
    } = req.body;
    if (!batchId || !company) return fail(res, 'batchId and company are required', 400);

    const { priorityScore } = calculatePriorityScore({ deadline, category: 'placement', verified: true });

    const placement = await Placement.create({
      batchId,
      postId: postId || null,
      company,
      role: role || '',
      package: pkg || '',
      eligibleBranches: eligibleBranches || [],
      minimumCgpa: minimumCgpa || 0,
      allowedBacklogs: allowedBacklogs || 0,
      deadline: deadline ? new Date(deadline) : null,
      testDate: testDate ? new Date(testDate) : null,
      applicationLink: applicationLink || '',
      priorityScore,
      status: 'active',
    });

    // Calendar event for deadline
    if (deadline) {
      await CalendarEvent.create({
        userId: req.user._id,
        batchId,
        title: `Placement: ${company} - ${role || 'Apply'}`,
        category: 'placement',
        date: new Date(deadline),
        sourceType: 'placement',
        sourceId: placement._id,
        status: 'upcoming',
      });
    }

    return ok(res, placement, 201);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

/**
 * POST /api/placements/:id/apply
 * Mark the user as "Applied" for a placement.
 */
router.post('/:id/apply', verifyFirebaseToken, async (req, res) => {
  try {
    const placementId = req.params.id;
    const placement = await Placement.findById(placementId);
    if (!placement) return fail(res, 'Placement not found', 404);

    const status = await StudentPlacementStatus.findOneAndUpdate(
      { userId: req.user._id, placementId },
      {
        userId: req.user._id,
        placementId,
        status: 'Applied',
        appliedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    return ok(res, status);
  } catch (err) {
    return fail(res, err.message, 500);
  }
});

export default router;
