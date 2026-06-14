import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { PlacementNotice } from '../models/PlacementNotice.js';
import { parseEmailWithAI, checkEligibility, generatePrepPlan } from '../services/placementParser.js';
import { ok, fail } from '../utils/response.js';

const router = express.Router();

router.use(verifyFirebaseToken);

/**
 * GET /api/placement-notices
 * Returns all placement notices for the requesting user, sorted newest first.
 * Query params:
 *   - status: filter by eligibilityStatus ('eligible'|'not_eligible'|'partial'|'pending')
 */
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.status) {
      filter.eligibilityStatus = req.query.status;
    }

    const notices = await PlacementNotice.find(filter)
      .sort({ receivedAt: -1 })
      .select('-rawBody') // Exclude heavy raw body from list view
      .lean();

    return ok(res, notices);
  } catch (err) {
    console.error('[PlacementNotices] List error:', err.message);
    return fail(res, 'Failed to fetch placement notices', 500);
  }
});

/**
 * GET /api/placement-notices/:id
 * Returns a single placement notice with full rawBody.
 */
router.get('/:id', async (req, res) => {
  try {
    const notice = await PlacementNotice.findOne({
      _id: req.params.id,
      userId: req.user._id, // Ensure user can only access their own notices
    });

    if (!notice) return fail(res, 'Placement notice not found', 404);

    return ok(res, notice);
  } catch (err) {
    console.error('[PlacementNotices] Get error:', err.message);
    return fail(res, 'Failed to fetch placement notice', 500);
  }
});

/**
 * POST /api/placement-notices/:id/reparse
 * Re-run AI parsing on a notice (useful if initial parse failed).
 */
router.post('/:id/reparse', async (req, res) => {
  try {
    const notice = await PlacementNotice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!notice) return fail(res, 'Placement notice not found', 404);

    const parsed = await parseEmailWithAI(notice.rawBody);
    const { status, breakdown } = parsed
      ? checkEligibility(parsed, req.user)
      : { status: 'partial', breakdown: {} };

    const updated = await PlacementNotice.findByIdAndUpdate(
      notice._id,
      { parsed, eligibilityStatus: status },
      { new: true }
    );

    return ok(res, { notice: updated, breakdown });
  } catch (err) {
    console.error('[PlacementNotices] Reparse error:', err.message);
    return fail(res, 'Failed to reparse notice', 500);
  }
});

/**
 * POST /api/placement-notices/:id/prep-plan
 * Generate (or return cached) JD-based preparation plan using AI.
 */
router.post('/:id/prep-plan', async (req, res) => {
  try {
    const notice = await PlacementNotice.findOne({ _id: req.params.id, userId: req.user._id });
    if (!notice) return fail(res, 'Placement notice not found', 404);

    // Return cached plan if already generated
    if (notice.preparationPlan) {
      return ok(res, { plan: notice.preparationPlan, cached: true });
    }

    const roleTitle = notice.parsed?.roleTitle || 'Software Engineer';
    const requiredSkills = notice.parsed?.requiredSkills || [];

    const plan = await generatePrepPlan(roleTitle, requiredSkills);

    if (!plan) {
      return fail(res, 'AI failed to generate preparation plan. Please try again.', 500);
    }

    // Cache the plan on the notice document
    const updated = await PlacementNotice.findByIdAndUpdate(
      notice._id,
      { preparationPlan: plan },
      { new: true }
    );

    return ok(res, { plan: updated.preparationPlan, cached: false });
  } catch (err) {
    console.error('[PlacementNotices] Prep plan error:', err.message);
    return fail(res, 'Failed to generate preparation plan', 500);
  }
});

export default router;
