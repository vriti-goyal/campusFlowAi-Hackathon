import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import healthRouter from './routes/health.js';
import uploadRouter from './routes/upload.js';
import finalizeRouter from './routes/finalize.js';
import assignmentsRouter from './routes/assignments.js';
import examsRouter from './routes/exams.js';
import placementsRouter from './routes/placements.js';
import userRoutes from './routes/userRoutes.js';
import batchRoutes from './routes/batchRoutes.js';
import postRoutes from './routes/postRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

const app = express();
const PORT = process.env.PORT || 8080;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────
app.use('/', healthRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/upload', finalizeRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/placements', placementsRouter);
app.use('/api/users', userRoutes);
app.use('/api/batch', batchRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/notifications', notificationRoutes);

// ── 404 catch-all ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// ── Start ────────────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  CampusFlow API running on http://localhost:${PORT}`);
  });
});
