import mongoose from 'mongoose';

const studentPlacementStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    placementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Placement', required: true },
    status: { type: String, enum: ['Applied', 'Interviewing', 'Offered', 'Rejected'], default: 'Applied' }
  },
  { timestamps: true }
);

export const StudentPlacementStatus = mongoose.model('StudentPlacementStatus', studentPlacementStatusSchema);
