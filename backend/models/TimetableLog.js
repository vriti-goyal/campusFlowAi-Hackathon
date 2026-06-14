import mongoose from 'mongoose';

const timetableLogSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    adminName: { type: String, required: true },
    changeType: {
      type: String,
      enum: ['temporary', 'permanent', 'deletion', 'creation'],
      required: true,
    },
    reason: { type: String, default: '' },
    description: { type: String, required: true }, // E.g., "Deleted slot XYZ", "Applied temporary override for 2026-06-15"
  },
  { timestamps: true }
);

export const TimetableLog = mongoose.model('TimetableLog', timetableLogSchema);
