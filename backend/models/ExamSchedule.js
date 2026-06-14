import mongoose from 'mongoose';

const examScheduleSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    courseCode: { type: String, required: true },
    courseName: { type: String, default: '' },
    examDate: { type: Date, required: true },
    examTime: { type: String, default: '' },
    venue: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for efficient student-facing queries
examScheduleSchema.index({ batchId: 1, courseCode: 1 });
examScheduleSchema.index({ batchId: 1, examDate: 1 });

export const ExamSchedule = mongoose.model('ExamSchedule', examScheduleSchema);
