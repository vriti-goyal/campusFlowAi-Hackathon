import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    time: { type: String, default: '' },
    venue: { type: String, default: '' },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    calendarEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarEvent', default: null },
  },
  { timestamps: true }
);

export const Exam = mongoose.model('Exam', examSchema);
