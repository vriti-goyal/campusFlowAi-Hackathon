import mongoose from 'mongoose';

const reminderSchema = new mongoose.Schema(
  {
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
    referenceType: {
      type: String,
      enum: ['assignment', 'exam', 'exam_schedule', 'registration', 'custom'],
      required: true,
    },
    referenceId: { type: mongoose.Schema.Types.ObjectId },

    title: { type: String, required: true },
    deadlineDate: { type: Date, required: true },

    // Reminder schedule
    remindAt: { type: Date, required: true },
    intervalLabel: { type: String },

    // State
    status: { type: String, enum: ['pending', 'sent', 'cancelled'], default: 'pending' },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

reminderSchema.index({ status: 1, remindAt: 1 });
reminderSchema.index({ referenceId: 1, referenceType: 1 });

export const Reminder = mongoose.model('Reminder', reminderSchema);
