import express from 'express';
import { runSeed } from '../scripts/seed.js';

const router = express.Router();

// Hidden admin route to reset demo data for the hackathon
router.post('/reset-demo', async (req, res) => {
  try {
    await runSeed();
    res.status(200).json({ message: 'Demo data reset successfully' });
  } catch (error) {
    console.error('Error resetting demo data:', error);
    res.status(500).json({ error: 'Failed to reset demo data' });
  }
});

export default router;
