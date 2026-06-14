import mongoose from 'mongoose';

const gmailTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  accessToken: String,
  refreshToken: String,
  expiryDate: Number,
  email: String,
  connectedAt: { type: Date, default: Date.now },
});

export default mongoose.model('GmailToken', gmailTokenSchema);
