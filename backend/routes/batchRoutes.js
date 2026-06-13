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
    const { batchName, college, branch, semester } = req.body;
    if (!batchName) return res.status(400).json({ error: 'Batch name is required' });

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
      ownerId: req.user._id
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
    const batches = members.map(m => ({ ...m.batchId.toObject(), myRole: m.role }));
    res.json(batches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch batches' });
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

export default router;
