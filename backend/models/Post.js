import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    uploadedBy: { type: String, required: true }, // Firebase UID
    type: { type: String, enum: ['assignment', 'exam', 'placement', 'general'], default: 'general' },
    title: { type: String, default: '' },
    originalText: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    summary: { type: String, default: '' },
    actionRequired: { type: String, default: '' },
    category: { type: String, enum: ['assignment', 'exam', 'placement', 'general'], default: 'general' },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    verificationStatus: { type: String, enum: ['unverified', 'verified', 'rejected'], default: 'unverified' },
    isDuplicate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Post = mongoose.model('Post', postSchema);
