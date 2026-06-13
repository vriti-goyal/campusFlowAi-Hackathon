import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    title: { type: String, required: true },
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Submitted', 'Late'], default: 'Pending' }
  },
  { timestamps: true }
);

export const Assignment = mongoose.model('Assignment', assignmentSchema);
