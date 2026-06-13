import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    title: { type: String, required: true },
    subject: { type: String, default: '' },
    date: { type: Date, required: true },
    time: { type: String, default: '' },
    venue: { type: String, default: '' },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'high' },
    calendarEventId: { type: mongoose.Schema.Types.ObjectId, ref: 'CalendarEvent', default: null },
  },
  { timestamps: true }
);

export const Exam = mongoose.model('Exam', examSchema);
