import mongoose from 'mongoose';

const timetableOverrideSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    originalSlotId: { type: mongoose.Schema.Types.ObjectId, required: true }, // References a slot in Timetable.slots
    date: { type: String, required: true }, // Format YYYY-MM-DD
    overrideType: {
      type: String,
      enum: ['rescheduled', 'cancelled', 'room_changed', 'faculty_changed'],
      required: true,
    },
    newDetails: {
      time: { type: String },
      venue: { type: String },
      faculty: { type: String },
    },
    reason: { type: String, default: '' },
    adminName: { type: String, default: 'AI System' },
    status: {
      type: String,
      enum: ['active', 'pending_review'],
      default: 'active',
    },
  },
  { timestamps: true }
);

export const TimetableOverride = mongoose.model('TimetableOverride', timetableOverrideSchema);
