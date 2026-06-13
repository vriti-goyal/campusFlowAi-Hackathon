import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { CalendarEvent } from '../models/CalendarEvent.js';

const router = express.Router();

router.use(verifyFirebaseToken);

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

    const events = await CalendarEvent.find(query).sort({ date: 1, time: 1 });
    res.json(events);
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
