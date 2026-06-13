import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    firebaseUid: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String },
    college: { type: String },
    branch: { type: String },
    semester: { type: Number },
    section: { type: String },
    rollNumber: { type: String },
    cgpa: { type: Number },
    backlogs: { type: Number, default: 0 },
    skills: [{ type: String }],
    hostelStatus: { type: String },
    busRoute: { type: String },
    placementInterests: [{ type: String }],
    subjects: [{ type: String }],
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
