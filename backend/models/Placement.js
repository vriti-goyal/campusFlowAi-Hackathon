import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    company: { type: String, required: true },
    role: { type: String, default: '' },
    package: { type: String, default: '' },
    eligibleBranches: [{ type: String }],
    minimumCgpa: { type: Number, default: 0 },
    allowedBacklogs: { type: Number, default: 0 },
    deadline: { type: Date, default: null },
    testDate: { type: Date, default: null },
    applicationLink: { type: String, default: '' },
    priorityScore: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['upcoming', 'active', 'closed'], default: 'active' },
    source: { type: String, default: 'manual' },
    sourceId: { type: String, default: null },
  },
  { timestamps: true }
);

export const Placement = mongoose.model('Placement', placementSchema);
