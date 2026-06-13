import { Router } from 'express';

const router = Router();

// GET /health
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CampusFlow AI API',
    timestamp: new Date().toISOString(),
  });
});

export default router;
