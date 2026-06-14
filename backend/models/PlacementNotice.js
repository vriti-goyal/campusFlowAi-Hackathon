import mongoose from 'mongoose';

const eligibilityCriteriaSchema = new mongoose.Schema({
  minCGPA: { type: Number, default: null },
  maxBacklogs: { type: Number, default: null },
  branches: [{ type: String }],
  graduationYears: [{ type: Number }],
  otherConstraints: [{ type: String }],
}, { _id: false });

const parsedSchema = new mongoose.Schema({
  companyName: { type: String, default: null },
  roleTitle: { type: String, default: null },
  ctc: { type: String, default: null },
  stipend: { type: String, default: null },
  eligibilityCriteria: { type: eligibilityCriteriaSchema, default: () => ({}) },
  applicationDeadline: { type: Date, default: null },
  assessmentDate: { type: Date, default: null },
  interviewDate: { type: Date, default: null },
  jobLocation: { type: String, default: null },
  requiredSkills: [{ type: String }],
}, { _id: false });

const resourceSchema = new mongoose.Schema({
  title: { type: String },
  type: { type: String, enum: ['book', 'video', 'platform'] },
  url: { type: String, default: null },
}, { _id: false });

const preparationPlanSchema = new mongoose.Schema({
  summary: { type: String },
  codingTopics: [{ type: String }],
  aptitudeAreas: [{ type: String }],
  coreSubjects: [{ type: String }],
  interviewTips: [{ type: String }],
  resources: [resourceSchema],
}, { _id: false });

const reminderSchema = new mongoose.Schema({
  type: { type: String }, // e.g. 'applicationDeadline', 'assessmentDate', 'interviewDate'
  scheduledAt: { type: Date },
  sent: { type: Boolean, default: false },
}, { _id: false });

const placementNoticeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    emailId: { type: String, required: true }, // Gmail message ID — unique per user
    subject: { type: String, default: '' },
    receivedAt: { type: Date },
    rawBody: { type: String, default: '' },
    parsed: { type: parsedSchema, default: null },
    preparationPlan: { type: preparationPlanSchema, default: null },
    eligibilityStatus: {
      type: String,
      enum: ['eligible', 'not_eligible', 'partial', 'pending'],
      default: 'pending',
    },
    reminders: [reminderSchema],
  },
  { timestamps: true }
);

// Ensure no duplicate emails per user
placementNoticeSchema.index({ userId: 1, emailId: 1 }, { unique: true });

export const PlacementNotice = mongoose.model('PlacementNotice', placementNoticeSchema);
