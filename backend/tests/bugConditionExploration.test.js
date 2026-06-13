/**
 * Bug Condition Exploration Tests — Task 1
 *
 * These tests are written BEFORE any fixes are applied.
 * They are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 *
 * Test 1 — CalendarEvent ownership:
 *   POST /api/assignments stores CalendarEvent.userId as req.user.uid (string),
 *   not req.user._id (ObjectId). Query by ObjectId returns null → BUG CONFIRMED.
 *
 * Test 2 — StudentPlacementStatus apply:
 *   POST /api/placements/:id/apply upserts with { studentId: req.user.uid }
 *   but the schema field is { userId: ObjectId }. Query by userId returns null → BUG CONFIRMED.
 *
 * Test 3 — Placements eligibility:
 *   GET /api/placements does User.findOne({ uid: req.user.uid }) but User schema
 *   uses firebaseUid, not uid. findOne returns null → userCgpa=0 → ineligible → BUG CONFIRMED.
 *
 * Test 4 — Dashboard assignment count:
 *   POST /api/upload/finalize (category=assignment) never sets userId on Assignment.create.
 *   Query Assignment.findOne({ userId: req.user._id }) returns null → BUG CONFIRMED.
 */

import { jest } from '@jest/globals';

// ── Mock firebase-admin BEFORE any route imports try to use it ─────────────
jest.mock('firebase-admin', () => ({
  apps: ['mock-app'],          // makes `!admin.apps.length` false → no initializeApp call
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'firebase-uid-string', email: 'test@example.com' }),
  })),
}));

// ── Mock AWS SDK clients used in finalize.js/upload.js ────────────────────
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn() })),
  InvokeModelCommand: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/client-textract', () => ({
  TextractClient: jest.fn(() => ({ send: jest.fn() })),
  DetectDocumentTextCommand: jest.fn(),
  StartDocumentTextDetectionCommand: jest.fn(),
  GetDocumentTextDetectionCommand: jest.fn(),
}));
jest.mock('@aws-sdk/client-bedrock', () => ({
  BedrockClient: jest.fn(() => ({ send: jest.fn() })),
}));

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import express from 'express';
import request from 'supertest';

// Import models (they define Mongoose schemas)
import { CalendarEvent } from '../models/CalendarEvent.js';
import { StudentPlacementStatus } from '../models/StudentPlacementStatus.js';
import { Assignment } from '../models/Assignment.js';
import { Placement } from '../models/Placement.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';

// ── Auth middleware mock ───────────────────────────────────────────────────
// We replace verifyFirebaseToken with a function that injects our test user.
// mockUser is set per-test so each test can use a different ObjectId if needed.
let mockUser = null;

jest.mock('../middleware/auth.js', () => ({
  verifyFirebaseToken: (req, _res, next) => {
    req.user = mockUser;
    next();
  },
}));

// Import routers AFTER mocking auth and AWS
import assignmentsRouter from '../routes/assignments.js';
import placementsRouter from '../routes/placements.js';
import finalizeRouter from '../routes/finalize.js';

// ── Build a minimal Express app for testing ───────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/placements', placementsRouter);
  app.use('/api/upload', finalizeRouter);
  app.use((err, _req, res, _next) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

// ── In-memory MongoDB lifecycle ───────────────────────────────────────────
let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  app = buildApp();
});

afterEach(async () => {
  // Clean up all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 1 — CalendarEvent ownership
//   Bug: assignments.js uses `userId: req.user.uid` (Firebase UID string)
//   instead of `userId: req.user._id` (ObjectId).
//   CalendarEvent.userId is typed ObjectId — storing a string causes mismatch.
//   Query CalendarEvent.findOne({ userId: req.user._id }) returns null on buggy code.
//
// **Validates: Requirements 1.2**
// ═══════════════════════════════════════════════════════════════════════════
test('Test 1 — CalendarEvent.userId should be a Mongoose ObjectId matching req.user._id', async () => {
  const userId = new mongoose.Types.ObjectId();
  const firebaseUid = 'firebase-uid-test1';
  const batchId = new mongoose.Types.ObjectId();

  // Create a real User doc so the User model has this user
  await User.create({
    _id: userId,
    firebaseUid,
    email: 'test1@example.com',
    name: 'Test User 1',
  });

  // Inject mock user with both _id (ObjectId) and uid (Firebase UID string)
  mockUser = {
    _id: userId,
    firebaseUid,
    uid: firebaseUid,
    email: 'test1@example.com',
    name: 'Test User 1',
    cgpa: 8.5,
    branch: 'CSE',
  };

  const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await request(app)
    .post('/api/assignments')
    .set('Authorization', 'Bearer fake-token')
    .send({
      batchId: batchId.toString(),
      title: 'Test Assignment Bug 1',
      subject: 'Computer Science',
      deadline: deadlineDate,
      submissionMode: 'online',
    });

  expect(res.status).toBe(201);

  // Query for the CalendarEvent using req.user._id (ObjectId)
  const calendarEvent = await CalendarEvent.findOne({ userId: userId });

  // On BUGGY code: calendarEvent will be null because userId was stored as a string
  // (req.user.uid = "firebase-uid-test1"), not as an ObjectId.
  // This assertion SHOULD FAIL on unfixed code → confirms Bug 1.2 exists.
  expect(calendarEvent).not.toBeNull();

  if (calendarEvent) {
    // Verify the stored userId is actually an ObjectId instance, not a string
    expect(calendarEvent.userId).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(calendarEvent.userId.toString()).toBe(userId.toString());
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 2 — StudentPlacementStatus apply
//   Bug: placements.js /:id/apply uses `studentId: req.user.uid` but
//   StudentPlacementStatus schema has field `userId` (not `studentId`).
//   Record is created with an extra `studentId` field and missing `userId`.
//   Query StudentPlacementStatus.findOne({ userId: req.user._id }) returns null.
//
// **Validates: Requirements 1.5**
// ═══════════════════════════════════════════════════════════════════════════
test('Test 2 — StudentPlacementStatus should be queryable by userId (ObjectId) after apply', async () => {
  const userId = new mongoose.Types.ObjectId();
  const firebaseUid = 'firebase-uid-test2';
  const batchId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userId,
    firebaseUid,
    email: 'test2@example.com',
    name: 'Test User 2',
    cgpa: 8.5,
    branch: 'CSE',
  });

  // Create a placement to apply to
  const placement = await Placement.create({
    batchId,
    company: 'Test Corp',
    role: 'Software Engineer',
    eligibleBranches: ['CSE'],
    minimumCgpa: 7.0,
    status: 'active',
  });

  mockUser = {
    _id: userId,
    firebaseUid,
    uid: firebaseUid,
    email: 'test2@example.com',
    name: 'Test User 2',
    cgpa: 8.5,
    branch: 'CSE',
  };

  const res = await request(app)
    .post(`/api/placements/${placement._id}/apply`)
    .set('Authorization', 'Bearer fake-token')
    .send({});

  // The route may succeed (201/200) or fail depending on schema validation
  // Either way, we check what was actually stored in the DB
  console.log('Test 2 apply response status:', res.status);
  console.log('Test 2 apply response body:', JSON.stringify(res.body));

  // Query using the correct field name from the schema (userId, not studentId)
  const statusRecord = await StudentPlacementStatus.findOne({
    userId,
    placementId: placement._id,
  });

  // On BUGGY code: statusRecord will be null because the route used
  // `studentId: req.user.uid` instead of `userId: req.user._id`.
  // This assertion SHOULD FAIL on unfixed code → confirms Bug 1.5 exists.
  expect(statusRecord).not.toBeNull();
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 3 — Placements eligibility
//   Bug: placements.js GET / uses `User.findOne({ uid: req.user.uid })` but
//   the User schema field is `firebaseUid` (not `uid`). findOne returns null,
//   so userCgpa defaults to 0 and every placement shows as 'not_eligible'.
//   A user with cgpa=8.5 should be eligible for minimumCgpa=7.0 placements.
//
// **Validates: Requirements 1.1 (Bug Group A)**
// ═══════════════════════════════════════════════════════════════════════════
test('Test 3 — GET /api/placements should show eligibilityStatus=eligible for user with cgpa 8.5', async () => {
  const userId = new mongoose.Types.ObjectId();
  const firebaseUid = 'firebase-uid-test3';
  const batchId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userId,
    firebaseUid,
    email: 'test3@example.com',
    name: 'Test User 3',
    cgpa: 8.5,
    branch: 'CSE',
  });

  // Create a placement the user should be eligible for
  const placement = await Placement.create({
    batchId,
    company: 'EligibleCorp',
    role: 'Backend Engineer',
    eligibleBranches: ['CSE', 'IT'],
    minimumCgpa: 7.0,
    allowedBacklogs: 0,
    status: 'active',
  });

  mockUser = {
    _id: userId,
    firebaseUid,
    uid: firebaseUid,     // Bug: route uses req.user.uid to look up User, but schema has firebaseUid
    email: 'test3@example.com',
    name: 'Test User 3',
    cgpa: 8.5,
    branch: 'CSE',
  };

  const res = await request(app)
    .get('/api/placements')
    .set('Authorization', 'Bearer fake-token');

  expect(res.status).toBe(200);

  const placements = res.body.data;
  expect(Array.isArray(placements)).toBe(true);
  expect(placements.length).toBeGreaterThan(0);

  const eligibleCorp = placements.find(p => p.company === 'EligibleCorp');
  expect(eligibleCorp).toBeDefined();

  console.log('Test 3 eligibilityStatus for EligibleCorp:', eligibleCorp?.eligibilityStatus);

  // On BUGGY code: User.findOne({ uid: req.user.uid }) returns null → userCgpa = 0
  // 0 < 7.0 → not_eligible. This assertion SHOULD FAIL on unfixed code → confirms Bug 1.1.
  expect(eligibleCorp.eligibilityStatus).toBe('eligible');
});

// ═══════════════════════════════════════════════════════════════════════════
// Test 4 — Dashboard assignment count
//   Bug: finalize.js POST /finalize does not pass `userId` to Assignment.create.
//   So Assignment.userId is undefined/null. Querying Assignment.findOne({ userId: req.user._id })
//   returns null even after a successful finalize → dashboard shows 0 items.
//
// **Validates: Requirements 1.4**
// ═══════════════════════════════════════════════════════════════════════════
test('Test 4 — Assignment created via finalize should have userId set to req.user._id', async () => {
  const userId = new mongoose.Types.ObjectId();
  const firebaseUid = 'firebase-uid-test4';
  const batchId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userId,
    firebaseUid,
    email: 'test4@example.com',
    name: 'Test User 4',
    cgpa: 8.5,
    branch: 'CSE',
  });

  // Create a Post (needed by finalize route)
  const post = await Post.create({
    batchId: batchId.toString(),
    uploadedBy: userId,
    title: 'Test Post for Finalize',
    category: 'assignment',
    verificationStatus: 'unverified',
    originalText: 'Submit your OS assignment by next Friday.',
  });

  mockUser = {
    _id: userId,
    firebaseUid,
    uid: firebaseUid,
    email: 'test4@example.com',
    name: 'Test User 4',
    cgpa: 8.5,
    branch: 'CSE',
  };

  const deadlineDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const res = await request(app)
    .post('/api/upload/finalize')
    .set('Authorization', 'Bearer fake-token')
    .send({
      postId: post._id.toString(),
      extraction: {
        category: 'assignment',
        title: 'OS Assignment',
        subject: 'Operating Systems',
        deadline: deadlineDate,
        submissionMode: 'online',
        actionRequired: 'Submit via portal',
      },
    });

  console.log('Test 4 finalize response status:', res.status);
  console.log('Test 4 finalize response body:', JSON.stringify(res.body));

  expect(res.status).toBe(200);

  // Query assignment by userId (how the dashboard queries it)
  const assignment = await Assignment.findOne({ userId });

  console.log('Test 4 Assignment found by userId:', assignment);
  if (!assignment) {
    // Log what was actually created (shows the bug — no userId field)
    const allAssignments = await Assignment.find({});
    console.log('Test 4 All assignments in DB:', JSON.stringify(allAssignments.map(a => ({
      _id: a._id,
      userId: a.userId,
      title: a.title,
    }))));
  }

  // On BUGGY code: userId is never set on Assignment.create in finalize.js
  // Assignment.findOne({ userId }) returns null → confirms Bug 1.4.
  // This assertion SHOULD FAIL on unfixed code.
  expect(assignment).not.toBeNull();
});
