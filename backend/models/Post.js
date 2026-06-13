import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, default: 'general' },
    title: { type: String, default: '' },
    originalText: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    summary: { type: String, default: '' },
    actionRequired: { type: Boolean, default: false },
    category: { type: String, default: 'general' },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical', 'urgent'], default: 'medium' },
    verificationStatus: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPinned: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Post = mongoose.model('Post', postSchema);
