import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    title: { type: String, required: true },
    category: { type: String, default: 'general' },
    date: { type: String, required: true },
    time: { type: String, default: '' },
    sourceType: { type: String, default: 'manual' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    reminderTime: { type: String },
    status: { type: String, enum: ['upcoming', 'pending', 'completed', 'cancelled'], default: 'upcoming' },
  },
  { timestamps: true }
);

export const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
