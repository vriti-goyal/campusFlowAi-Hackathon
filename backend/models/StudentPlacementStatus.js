import mongoose from 'mongoose';

const studentPlacementStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    placementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
    eligibilityStatus: { type: String, enum: ['eligible', 'not_eligible', 'unknown'], default: 'unknown' },
    status: { type: String, enum: ['Applied', 'Interviewing', 'Offered', 'Rejected', 'Not Applied', 'Shortlisted', 'Dismissed'], default: 'Not Applied' },
    appliedAt: { type: Date, default: null },
    reminderSet: { type: Boolean, default: false },
  },
  { timestamps: true }
);

studentPlacementStatusSchema.index({ userId: 1, placementId: 1 }, { unique: true });

export const StudentPlacementStatus = mongoose.model('StudentPlacementStatus', studentPlacementStatusSchema);
