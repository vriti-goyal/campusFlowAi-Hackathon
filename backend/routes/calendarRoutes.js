import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { CalendarEvent } from '../models/CalendarEvent.js';
import { Assignment } from '../models/Assignment.js';
import { Exam } from '../models/Exam.js';
import { ExamSchedule } from '../models/ExamSchedule.js';
import { BatchMember } from '../models/BatchMember.js';
import { Batch } from '../models/Batch.js';

const router = express.Router();

router.use(verifyFirebaseToken);

const toDateKey = (value) => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
};

// GET /api/calendar/events
router.get('/events', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const query = { userId: req.user._id };
    
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }
    
    if (category) {
      query.category = category;
    }

    const baseEvents = await CalendarEvent.find(query).sort({ date: 1, time: 1 }).lean();
    const existingSourceKeys = new Set(
      baseEvents
        .filter((event) => event.sourceType && event.sourceId)
        .map((event) => `${String(event.sourceType).toLowerCase()}:${String(event.sourceId)}`)
    );

    const memberships = await BatchMember.find({ userId: req.user._id }).select('batchId').lean();
    const memberBatchIds = memberships.map((m) => m.batchId);

    const assignmentFilter = {
      $or: [
        { userId: req.user._id },
        { batchId: { $in: memberBatchIds } },
      ],
      deadline: { $ne: null },
    };

    const assignments = await Assignment.find(assignmentFilter).select('_id title deadline').lean();
    const derivedAssignments = assignments
      .filter((a) => !existingSourceKeys.has(`assignment:${String(a._id)}`))
      .map((a) => ({
        _id: `derived-assignment-${a._id}`,
        title: `Assignment: ${a.title}`,
        category: 'Assignment',
        date: toDateKey(a.deadline),
        time: '',
        sourceType: 'assignment',
        sourceId: a._id,
        readOnly: true,
      }))
      .filter((a) => Boolean(a.date));

    const legacyExamFilter = {
      $or: [
        { userId: req.user._id },
        { batchId: { $in: memberBatchIds } },
      ],
      date: { $ne: null },
    };
    const legacyExams = await Exam.find(legacyExamFilter).select('_id title subject date time venue').lean();
    const derivedLegacyExams = legacyExams
      .filter((e) => !existingSourceKeys.has(`exam:${String(e._id)}`))
      .map((e) => ({
        _id: `derived-exam-${e._id}`,
        title: e.subject || e.title || 'Exam',
        category: 'Exam',
        date: toDateKey(e.date),
        time: e.time || '',
        sourceType: 'exam',
        sourceId: e._id,
        readOnly: true,
      }))
      .filter((e) => Boolean(e.date));

    const batches = await Batch.find({
      _id: { $in: memberBatchIds },
      status: { $ne: 'deleted' },
    }).select('courses').lean();

    const batchCourseMap = {};
    for (const batch of batches) {
      batchCourseMap[String(batch._id)] = new Set(
        (batch.courses || []).map((course) => String(course.code || '').toUpperCase()).filter(Boolean)
      );
    }

    const allScheduleExams = await ExamSchedule.find({
      batchId: { $in: memberBatchIds },
    }).select('_id batchId courseCode courseName examDate examTime venue').lean();

    const filteredScheduleExams = allScheduleExams.filter((entry) => {
      const codes = batchCourseMap[String(entry.batchId)];
      if (!codes || codes.size === 0) return true;
      return codes.has(String(entry.courseCode || '').toUpperCase());
    });

    const derivedScheduleExams = filteredScheduleExams.map((entry) => ({
      _id: `derived-exam-schedule-${entry._id}`,
      title: `${entry.courseCode}${entry.courseName ? ` - ${entry.courseName}` : ''}`,
      category: 'Exam',
      date: toDateKey(entry.examDate),
      time: entry.examTime || '',
      sourceType: 'exam_schedule',
      sourceId: entry._id,
      readOnly: true,
      venue: entry.venue || '',
    })).filter((entry) => Boolean(entry.date));

    let allEvents = [...baseEvents, ...derivedAssignments, ...derivedLegacyExams, ...derivedScheduleExams]
      .sort((a, b) => {
        const left = `${a.date || ''} ${a.time || ''}`;
        const right = `${b.date || ''} ${b.time || ''}`;
        return left.localeCompare(right);
      });

    if (from) {
      allEvents = allEvents.filter((event) => event.date >= from);
    }
    if (to) {
      allEvents = allEvents.filter((event) => event.date <= to);
    }
    if (category) {
      const normalizedCategory = String(category).toLowerCase();
      allEvents = allEvents.filter((event) => String(event.category || '').toLowerCase() === normalizedCategory);
    }

    res.json(allEvents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar/events
router.post('/events', async (req, res) => {
  try {
    const { title, category, date, time, reminderTime } = req.body;
    
    if (!title || !category || !date) {
      return res.status(400).json({ error: 'Title, category, and date are required' });
    }

    const event = await CalendarEvent.create({
      userId: req.user._id,
      title,
      category,
      date,
      time,
      sourceType: 'manual',
      reminderTime
    });

    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /api/calendar/events/:id
router.patch('/events/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    );
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/calendar/events/:id
router.delete('/events/:id', async (req, res) => {
  try {
    const event = await CalendarEvent.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Event deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export default router;
