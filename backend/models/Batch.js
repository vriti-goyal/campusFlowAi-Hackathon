import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  faculty: { type: String, default: '' },
}, { _id: false });

const batchSchema = new mongoose.Schema(
  {
    batchName: { type: String, required: true },
    batchCode: { type: String, required: true, unique: true },
    college: { type: String },
    branch: { type: String },
    semester: { type: Number },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // ── Feature 4: Course Mapping ────────────────────────────
    courses: [courseSchema],

    // ── Feature 2: Soft Delete ───────────────────────────────
    status: { type: String, enum: ['active', 'deleted'], default: 'active' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Batch = mongoose.model('Batch', batchSchema);
