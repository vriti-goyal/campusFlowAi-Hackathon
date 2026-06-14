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
      'name', 'college', 'branch', 'semester', 'currentYear', 'graduationYear',
      'section', 'rollNumber', 'cgpa', 'backlogs', 'skills', 'hostelStatus',
      'busRoute', 'placementInterests', 'subjects', 'routine',
      'phoneNumber', 'tnpEmail', 'interests',
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

/**
 * PATCH /api/users/me/complete-profile
 * Called after completing the multi-step signup form.
 * Sets profileComplete: true in addition to updating fields.
 */
router.patch('/me/complete-profile', async (req, res) => {
  try {
    const allowedUpdates = [
      'name', 'phoneNumber', 'college', 'branch', 'semester', 'currentYear',
      'graduationYear', 'section', 'rollNumber', 'cgpa', 'backlogs',
      'tnpEmail', 'skills', 'interests', 'placementInterests',
    ];

    const updates = {};
    for (const key of Object.keys(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = req.body[key];
      }
    }

    // Validate CGPA
    if (updates.cgpa !== undefined) {
      const cgpa = parseFloat(updates.cgpa);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        return res.status(400).json({ error: 'CGPA must be between 0.0 and 10.0' });
      }
    }

    // Validate backlogs
    if (updates.backlogs !== undefined) {
      const backlogs = parseInt(updates.backlogs, 10);
      if (isNaN(backlogs) || backlogs < 0) {
        return res.status(400).json({ error: 'Backlogs must be a non-negative integer' });
      }
    }

    // Mark profile as complete
    updates.profileComplete = true;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to complete profile' });
  }
});

export default router;

