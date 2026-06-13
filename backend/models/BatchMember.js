import mongoose from 'mongoose';

const batchMemberSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'moderator', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Ensure a user can only be in a batch once
batchMemberSchema.index({ batchId: 1, userId: 1 }, { unique: true });

export const BatchMember = mongoose.model('BatchMember', batchMemberSchema);
