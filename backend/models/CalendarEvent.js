import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    title: { type: String, required: true },
    category: { 
      type: String, 
      enum: ['Assignment', 'Exam', 'Placement', 'Event', 'Hostel', 'Transport', 'Personal'],
      required: true
    },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String }, // HH:mm
    sourceType: { type: String }, // e.g., 'post', 'manual'
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    reminderTime: { type: String },
    status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' }
  },
  { timestamps: true }
);

export const CalendarEvent = mongoose.model('CalendarEvent', calendarEventSchema);
