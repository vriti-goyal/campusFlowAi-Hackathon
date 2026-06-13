import mongoose from 'mongoose';

const postSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { 
      type: String, 
      enum: ['academic', 'assignment', 'exam', 'placement', 'event', 'hostel', 'transport', 'resource', 'general'],
      required: true
    },
    title: { type: String, required: true },
    originalText: { type: String, required: true },
    fileUrl: { type: String },
    summary: { type: String },
    actionRequired: { type: Boolean, default: false },
    category: { type: String },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'low' },
    verificationStatus: { type: String, enum: ['verified', 'unverified'], default: 'unverified' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isPinned: { type: Boolean, default: false },
    isDuplicate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Post = mongoose.model('Post', postSchema);
