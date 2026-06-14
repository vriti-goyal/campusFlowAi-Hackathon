import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['assignment', 'exam', 'placement', 'community', 'system'], default: 'system' },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'low' },
    isRead: { type: Boolean, default: false },
    reminderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reminder', default: null },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', default: null }
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema);
