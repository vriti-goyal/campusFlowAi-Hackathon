import mongoose from 'mongoose';

const timetableAuditLogSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    action: {
      type: String,
      enum: ['create', 'update', 'delete', 'override_temp', 'override_perm', 'notice_applied'],
      required: true,
    },
    targetDay: { type: String },
    targetSlotIndex: { type: Number },
    changeDetails: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String },
  },
  { timestamps: true }
);

timetableAuditLogSchema.index({ batchId: 1, createdAt: -1 });

export const TimetableAuditLog = mongoose.model('TimetableAuditLog', timetableAuditLogSchema);
