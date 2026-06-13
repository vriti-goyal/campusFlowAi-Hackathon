import mongoose from 'mongoose';

const placementSchema = new mongoose.Schema(
  {
    company: { type: String, required: true },
    role: { type: String, required: true },
    deadline: { type: Date },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Placement = mongoose.model('Placement', placementSchema);
