import mongoose from 'mongoose';

const aiChatHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sources: [{ type: String }],
  },
  { timestamps: true }
);

export const AIChatHistory = mongoose.model('AIChatHistory', aiChatHistorySchema);
