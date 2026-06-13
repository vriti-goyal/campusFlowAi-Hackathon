import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { User } from '../models/User.js';

const router = express.Router();

router.use(verifyFirebaseToken);

// GET /api/users/me
router.get('/me', async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/me
router.patch('/me', async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'college', 'branch', 'semester', 'section', 'rollNumber', 
      'cgpa', 'backlogs', 'skills', 'hostelStatus', 'busRoute', 
      'placementInterests', 'subjects', 'routine'
    ];
    
    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
