import mongoose from 'mongoose';

const studentAssignmentStatusSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    status: { 
      type: String, 
      enum: ['Not Started', 'In Progress', 'Submitted', 'Missed', 'Pending', 'Late'], 
      default: 'Not Started' 
    },
  },
  { timestamps: true }
);

studentAssignmentStatusSchema.index({ userId: 1, assignmentId: 1 }, { unique: true });

export const StudentAssignmentStatus = mongoose.model('StudentAssignmentStatus', studentAssignmentStatusSchema);
