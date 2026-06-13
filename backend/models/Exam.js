import mongoose from 'mongoose';

const examSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
    title: { type: String, required: true },
    date: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Exam = mongoose.model('Exam', examSchema);
