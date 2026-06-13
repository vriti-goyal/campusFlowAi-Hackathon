import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true }, // Firebase UID
    batchId: { type: String, default: '' },
    title: { type: String, required: true },
    category: { type: String, enum: ['assignment', 'exam', 'placement', 'general'], default: 'general' },
    date: { type: Date, required: true },
    time: { type: String, default: '' },
    sourceType: { type: String, enum: ['assignment', 'exam', 'placement', 'manual'], default: 'manual' },
    sourceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' },
  },
  { timestamps: true }
);

export const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
