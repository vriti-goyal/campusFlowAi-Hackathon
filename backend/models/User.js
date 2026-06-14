import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String },

    // ── Contact ─────────────────────────────────────────────
    phoneNumber: { type: String },

    // ── Academic ─────────────────────────────────────────────
    college: { type: String },
    branch: { type: String },
    semester: { type: Number },
    currentYear: { type: Number, min: 1, max: 4 },
    graduationYear: { type: Number },
    section: { type: String },
    rollNumber: { type: String },

    // ── Placement ────────────────────────────────────────────
    cgpa: { type: Number, min: 0, max: 10 },
    backlogs: { type: Number, default: 0, min: 0 },
    tnpEmail: { type: String },

    // ── Interests & Skills ───────────────────────────────────
    skills: [{ type: String }],
    interests: [{ type: String }],
    placementInterests: [{ type: String }], // kept for backward compat

    // ── Gmail Integration ────────────────────────────────────
    gmailRefreshToken: { type: String, default: null }, // AES-256 encrypted
    gmailConnected: { type: Boolean, default: false },

    // ── Profile Completion ───────────────────────────────────
    profileComplete: { type: Boolean, default: false },

    // ── Legacy / Misc ────────────────────────────────────────
    subjects: [{ type: String }],
    hostelStatus: { type: String },
    busRoute: { type: String },
    routine: {
      wakeUpTime: { type: String },
      classTiming: { type: String },
      studyTime: { type: String },
      sleepTime: { type: String },
      reminderTime: { type: String },
      notificationPref: { type: String, enum: ['email', 'push', 'none'], default: 'push' }
    },
    role: { type: String, enum: ['student', 'admin'], default: 'student' },
  },
  { timestamps: true }
);

export const User = mongoose.model('User', userSchema);
