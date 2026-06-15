import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { Assignment } from '../models/Assignment.js';
import { Exam } from '../models/Exam.js';
import { Placement } from '../models/Placement.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';
import { StudentAssignmentStatus } from '../models/StudentAssignmentStatus.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { Post } from '../models/Post.js';
import { BatchMember } from '../models/BatchMember.js';

const router = express.Router();

router.use(verifyFirebaseToken);

router.get('/summary', async (req, res) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    
    // Time boundaries
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const endOfTomorrow = new Date(now);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    endOfTomorrow.setHours(23, 59, 59, 999);

    const focusItems = [];
    const urgentAlerts = [];
    const counts = { assignments: 0, exams: 0, placements: 0, events: 0, urgent: 0 };

    const memberships = await BatchMember.find({ userId }).lean();
    const userBatches = memberships.map(m => m.batchId);

    const submittedAssignmentStatuses = await StudentAssignmentStatus.find({
      userId,
      status: 'Submitted'
    }).lean();
    const submittedAssignmentIds = submittedAssignmentStatuses.map(s => s.assignmentId);

    // 1. Assignments
    const assignments = await Assignment.find({ 
      $or: [{ userId }, { batchId: { $in: userBatches } }],
      _id: { $nin: submittedAssignmentIds },
      deadline: { $lte: in7Days, $gte: now } 
    }).lean();
    
    counts.assignments = assignments.length;
    assignments.forEach(a => {
      const isUrgent = new Date(a.deadline) <= in24Hours;
      const item = { type: 'Assignment', title: a.title, deadline: a.deadline, priority: isUrgent ? 'high' : 'medium' };
      focusItems.push(item);
      if (isUrgent) {
        urgentAlerts.push(item);
        counts.urgent++;
      }
    });

    // 2. Exams
    const exams = await Exam.find({
      $or: [{ userId }, { batchId: { $in: userBatches } }],
      date: { $lte: in14Days, $gte: now }
    }).lean();
    
    counts.exams = exams.length;
    exams.forEach(e => {
      const isUrgent = new Date(e.date) <= in24Hours;
      const item = { type: 'Exam', title: e.title, deadline: e.date, priority: isUrgent ? 'high' : 'medium' };
      focusItems.push(item);
      if (isUrgent) {
        urgentAlerts.push(item);
        counts.urgent++;
      }
    });

    // 3. Placements
    // Find all active placements
    const activePlacements = await Placement.find({ isActive: true }).lean();
    // Find where user has applied
    const appliedStatuses = await StudentPlacementStatus.find({ userId }).lean();
    const appliedPlacementIds = appliedStatuses.map(s => s.placementId.toString());
    
    const openPlacements = activePlacements.filter(p => !appliedPlacementIds.includes(p._id.toString()));
    counts.placements = openPlacements.length;
    
    openPlacements.forEach(p => {
      const isUrgent = p.deadline && new Date(p.deadline) <= in24Hours;
      const item = { type: 'Placement', title: `${p.company} - ${p.role}`, deadline: p.deadline, priority: isUrgent ? 'high' : 'low' };
      focusItems.push(item);
      if (isUrgent) {
        urgentAlerts.push(item);
        counts.urgent++;
      }
    });

    // 4. Calendar Events (Today & Tomorrow)
    // Convert to YYYY-MM-DD for matching string format in DB
    const todayStr = now.toISOString().split('T')[0];
    const tomorrowStr = new Date(now.getTime() + 24*60*60*1000).toISOString().split('T')[0];
    
    const events = await CalendarEvent.find({
      userId,
      date: { $in: [todayStr, tomorrowStr] }
    }).lean();
    
    counts.events = events.length;
    events.forEach(e => {
      focusItems.push({ type: 'Event', title: e.title, deadline: e.date, priority: 'low' });
    });

    // Sort focus items by urgency
    focusItems.sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    res.json({
      focusItems: focusItems.slice(0, 5),
      urgentAlerts,
      counts
    });
  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({ error: 'Failed to aggregate dashboard data' });
  }
});

export default router;
