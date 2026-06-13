// models/User.js — extend this with your full schema
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true }, // Firebase UID
    email: { type: String, required: true },
    displayName: { type: String },
    photoURL: { type: String },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
    batch: { type: String },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
