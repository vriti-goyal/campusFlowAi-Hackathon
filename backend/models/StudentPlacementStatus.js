import mongoose from 'mongoose';

const studentPlacementStatusSchema = new mongoose.Schema(
  {
    studentId: { type: String, required: true }, // Firebase UID
    placementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
    eligibilityStatus: { type: String, enum: ['eligible', 'not_eligible', 'unknown'], default: 'unknown' },
    applicationStatus: { type: String, enum: ['Not Applied', 'Applied', 'Shortlisted', 'Rejected'], default: 'Not Applied' },
    appliedAt: { type: Date, default: null },
    reminderSet: { type: Boolean, default: false },
  },
  { timestamps: true }
);

studentPlacementStatusSchema.index({ studentId: 1, placementId: 1 }, { unique: true });

export const StudentPlacementStatus = mongoose.model('StudentPlacementStatus', studentPlacementStatusSchema);
