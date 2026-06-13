import mongoose from 'mongoose';

const batchSchema = new mongoose.Schema(
  {
    batchName: { type: String, required: true },
    batchCode: { type: String, required: true, unique: true },
    college: { type: String },
    branch: { type: String },
    semester: { type: Number },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export const Batch = mongoose.model('Batch', batchSchema);
