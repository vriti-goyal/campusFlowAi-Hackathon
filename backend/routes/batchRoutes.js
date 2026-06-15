import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Batch } from '../models/Batch.js';
import { BatchMember } from '../models/BatchMember.js';

const router = express.Router();

router.use(verifyFirebaseToken);

const generateBatchCode = () => Math.random().toString(36).substring(2, 10).toUpperCase();

// POST /api/batch/create
router.post('/create', async (req, res) => {
  try {
    const { batchName, college, branch, semester, courses = [] } = req.body;
    if (!batchName) return res.status(400).json({ error: 'Batch name is required' });

    // Validate courses: code + name required, codes unique within batch
    const seenCodes = new Set();
    const validatedCourses = [];
    for (const c of courses) {
      if (!c.code?.trim() || !c.name?.trim()) {
        return res.status(400).json({ error: 'Each course must have a code and a name' });
      }
      const code = c.code.trim().toUpperCase();
      if (seenCodes.has(code)) {
        return res.status(400).json({ error: `Duplicate course code: ${code}` });
      }
      seenCodes.add(code);
      validatedCourses.push({ code, name: c.name.trim(), faculty: c.faculty?.trim() || '' });
    }

    let batchCode;
    let isUnique = false;
    while (!isUnique) {
      batchCode = generateBatchCode();
      const existing = await Batch.findOne({ batchCode });
      if (!existing) isUnique = true;
    }

    const batch = await Batch.create({
      batchName,
      batchCode,
      college,
      branch,
      semester,
      ownerId: req.user._id,
      courses: validatedCourses,
    });

    await BatchMember.create({
      batchId: batch._id,
      userId: req.user._id,
      role: 'owner'
    });

    res.status(201).json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// POST /api/batch/join
router.post('/join', async (req, res) => {
  try {
    const { batchCode } = req.body;
    if (!batchCode) return res.status(400).json({ error: 'Batch code is required' });

    const batch = await Batch.findOne({ batchCode });
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const existingMember = await BatchMember.findOne({ batchId: batch._id, userId: req.user._id });
    if (existingMember) return res.status(400).json({ error: 'Already a member of this batch' });

    const member = await BatchMember.create({
      batchId: batch._id,
      userId: req.user._id,
      role: 'member'
    });

    res.status(201).json({ message: 'Joined batch successfully', batch });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to join batch' });
  }
});

// GET /api/batch/my-batches
router.get('/my-batches', async (req, res) => {
  try {
    const members = await BatchMember.find({ userId: req.user._id }).populate('batchId');
    const batches = members
      .filter(m => m.batchId && m.batchId.status !== 'deleted')
      .map(m => ({ ...m.batchId.toObject(), myRole: m.role }));
    res.json(batches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /api/batch/:batchId  — batch detail with courses
router.get('/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch || batch.status === 'deleted') return res.status(404).json({ error: 'Batch not found' });

    // Verify membership
    const membership = await BatchMember.findOne({ batchId: batch._id, userId: req.user._id });
    if (!membership) return res.status(403).json({ error: 'You are not a member of this batch' });

    res.json({ ...batch.toObject(), myRole: membership.role });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

/**
 * PATCH /api/batch/:batchId/courses
 * Replace the courses array for a batch (owner/moderator only).
 * Validates unique codes within the new list.
 */
router.patch('/:batchId/courses', async (req, res) => {
  try {
    const { courses = [] } = req.body;
    const batch = await Batch.findById(req.params.batchId);
    if (!batch || batch.status === 'deleted') return res.status(404).json({ error: 'Batch not found' });

    const membership = await BatchMember.findOne({ batchId: batch._id, userId: req.user._id });
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only owners or moderators can update courses' });
    }

    const seenCodes = new Set();
    const validatedCourses = [];
    for (const c of courses) {
      if (!c.code?.trim() || !c.name?.trim()) {
        return res.status(400).json({ error: 'Each course must have a code and a name' });
      }
      const code = c.code.trim().toUpperCase();
      if (seenCodes.has(code)) {
        return res.status(400).json({ error: `Duplicate course code: ${code}` });
      }
      seenCodes.add(code);
      validatedCourses.push({ code, name: c.name.trim(), faculty: c.faculty?.trim() || '' });
    }

    batch.courses = validatedCourses;
    await batch.save();

    res.json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update courses' });
  }
});

/**
 * PATCH /api/batch/:batchId
 * Update basic batch details and courses (owner/moderator only).
 */
router.patch('/:batchId', async (req, res) => {
  try {
    const { batchName, college, branch, semester, courses } = req.body;
    const batch = await Batch.findById(req.params.batchId);
    if (!batch || batch.status === 'deleted') return res.status(404).json({ error: 'Batch not found' });

    const membership = await BatchMember.findOne({ batchId: batch._id, userId: req.user._id });
    if (!membership || !['owner', 'moderator'].includes(membership.role)) {
      return res.status(403).json({ error: 'Only owners or moderators can update a batch' });
    }

    if (batchName !== undefined) {
      if (!batchName.trim()) return res.status(400).json({ error: 'Batch name cannot be empty' });
      batch.batchName = batchName.trim();
    }
    if (college !== undefined) batch.college = college.trim();
    if (branch !== undefined) batch.branch = branch.trim();
    if (semester !== undefined) batch.semester = semester;

    if (courses !== undefined) {
      const seenCodes = new Set();
      const validatedCourses = [];
      for (const c of courses) {
        if (!c.code?.trim() || !c.name?.trim()) {
          return res.status(400).json({ error: 'Each course must have a code and a name' });
        }
        const code = c.code.trim().toUpperCase();
        if (seenCodes.has(code)) {
          return res.status(400).json({ error: `Duplicate course code: ${code}` });
        }
        seenCodes.add(code);
        validatedCourses.push({ code, name: c.name.trim(), faculty: c.faculty?.trim() || '' });
      }
      batch.courses = validatedCourses;
    }

    await batch.save();
    res.json(batch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update batch details' });
  }
});



// GET /api/batch/:batchId/members
router.get('/:batchId/members', async (req, res) => {
  try {
    const members = await BatchMember.find({ batchId: req.params.batchId }).populate('userId', 'name email');
    res.json(members);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// PATCH /api/batch/:batchId/member/:userId/role
router.patch('/:batchId/member/:userId/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['owner', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const requesterMember = await BatchMember.findOne({ batchId: req.params.batchId, userId: req.user._id });
    if (!requesterMember || requesterMember.role !== 'owner') {
      return res.status(403).json({ error: 'Only owners can change roles' });
    }

    const updatedMember = await BatchMember.findOneAndUpdate(
      { batchId: req.params.batchId, userId: req.params.userId },
      { role },
      { new: true }
    );

    if (!updatedMember) return res.status(404).json({ error: 'Member not found' });
    res.json(updatedMember);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * DELETE /api/batch/:batchId
 * Soft-deletes (archives) a batch.
 * Only the batch owner or a platform admin can do this.
 * Requires body: { confirmName: "<exact batch name>" }
 * Returns 409 if there are still active members other than the owner.
 */
router.delete('/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { confirmName } = req.body;

    const batch = await Batch.findById(batchId);
    if (!batch || batch.status === 'deleted') {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Access control: must be owner or platform admin
    const isOwner = batch.ownerId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the batch owner or an admin can delete a batch' });
    }

    // Typed confirmation: the caller must provide the exact batch name
    if (!confirmName || confirmName !== batch.batchName) {
      return res.status(400).json({
        error: `Confirmation failed. Please type the exact batch name: "${batch.batchName}"`,
      });
    }

    // Soft delete (archive) — NEVER hard delete
    batch.status = 'deleted';
    batch.deletedAt = new Date();
    await batch.save();

    // Delete all batch memberships so it disappears from all members
    await BatchMember.deleteMany({ batchId: batch._id });

    console.log(`[Batch] Archived batch ${batch._id} ("${batch.batchName}") by user ${req.user._id}`);

    res.json({ message: `Batch "${batch.batchName}" has been archived successfully.` });
  } catch (error) {
    console.error('[Batch Delete] Error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

/**
 * DELETE /api/batch/:batchId/leave
 * Allows a member or moderator to leave a batch.
 * The owner cannot leave a batch (they must delete it or transfer ownership).
 */
router.delete('/:batchId/leave', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const membership = await BatchMember.findOne({ batchId, userId: req.user._id });
    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this batch' });
    }

    if (membership.role === 'owner') {
      return res.status(403).json({ error: 'The owner cannot leave the batch. You must delete it instead.' });
    }

    await BatchMember.deleteOne({ _id: membership._id });
    
    console.log(`[Batch] User ${req.user._id} left batch ${batchId}`);
    res.json({ message: 'Successfully left the batch' });
  } catch (error) {
    console.error('[Batch Leave] Error:', error);
    res.status(500).json({ error: 'Failed to leave batch' });
  }
});

export default router;
