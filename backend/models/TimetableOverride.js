import mongoose from 'mongoose';

const timetableOverrideSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    timetableId: { type: mongoose.Schema.Types.ObjectId, ref: 'Timetable', required: true },
    slotIndex: { type: Number, required: true },
    effectiveDate: { type: Date, required: true },
    overrideType: {
      type: String,
      enum: ['rescheduled', 'cancelled', 'room_changed', 'faculty_changed'],
      required: true,
    },
    newTime: { type: String, default: null },
    newVenue: { type: String, default: null },
    newFaculty: { type: String, default: null },
    newDay: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      default: null,
    },
    reason: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    source: { type: String, enum: ['admin', 'notice_ai'], default: 'admin' },
    flaggedForReview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

timetableOverrideSchema.index({ batchId: 1, effectiveDate: 1 });
timetableOverrideSchema.index({ timetableId: 1, effectiveDate: 1 });

export const TimetableOverride = mongoose.model('TimetableOverride', timetableOverrideSchema);
