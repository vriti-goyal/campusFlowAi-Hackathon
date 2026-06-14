import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: false, default: null },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', default: null },
    title: { type: String, required: true },
    subject: { type: String, default: '' },
    deadline: { type: Date, default: null },
    submissionMode: { type: String, enum: ['online', 'offline', 'both'], default: 'online' },
    priorityScore: { type: Number, default: 0 },
    priorityLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    status: { type: String, enum: ['Not Started', 'In Progress', 'Submitted', 'Missed', 'Pending', 'Late'], default: 'Not Started' },
    actionRequired: { type: String, default: '' },
    questions: [{ type: String }],
    instructions: { type: String, default: '' },
    marksAllocation: { type: String, default: '' },
    faculty: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    extractedFrom: { type: String, default: '' },
    deadlineUnknown: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
