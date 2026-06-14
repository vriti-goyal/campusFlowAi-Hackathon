import mongoose from 'mongoose';

const timetableSlotSchema = new mongoose.Schema({
  time: { type: String, required: true },
  courseCode: { type: String, required: true },
  courseName: { type: String, default: '' },
  venue: { type: String, default: '' },
  faculty: { type: String, default: '' },
});

const timetableSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true,
    },
    slots: [timetableSlotSchema],
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Enforce one timetable per day per batch
timetableSchema.index({ batchId: 1, dayOfWeek: 1 }, { unique: true });

export const Timetable = mongoose.model('Timetable', timetableSchema);
