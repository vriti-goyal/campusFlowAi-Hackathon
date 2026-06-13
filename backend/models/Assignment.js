import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    title: { type: String, required: true },
    subject: { type: String, default: '' },
    deadline: { type: Date, default: null },
    submissionMode: { type: String, enum: ['online', 'offline', 'both'], default: 'online' },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['Not Started', 'In Progress', 'Submitted', 'Missed'], default: 'Not Started' },
    actionRequired: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
