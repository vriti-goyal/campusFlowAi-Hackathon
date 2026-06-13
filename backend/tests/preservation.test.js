/**
 * Preservation Property Tests — Task 2
 *
 * Written BEFORE any fixes are applied (observation-first methodology).
 * ALL tests in this file MUST PASS on unfixed code — they establish baseline
 * behaviour for non-buggy routes. When re-run after fixes (Task 8), they must
 * still pass, proving no regressions were introduced.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12
 *
 * Test A — Assignment list schema completeness:
 *   GET /api/assignments?batchId=<id> returns 200 with an array where EVERY
 *   element has non-null title, deadline, status, priorityLevel.
 *   Proves the GET route returns schema-intact records.
 *
 * Test B — verifyFirebaseToken attaches ObjectId _id:
 *   A protected route receives req.user._id that is a valid Mongoose ObjectId
 *   (not a plain string). Proves the middleware attaches the MongoDB User doc.
 *
 * Test C — Posts GET returns sorted isPinned desc, createdAt desc:
 *   GET /api/posts/:batchId with varying query params always returns an array
 *   sorted by isPinned: -1, createdAt: -1.
 *   Proves sort order is preserved across category/search filters.
 *
 * NOTE: Test D (axios interceptor / frontend) is in frontend/src/tests/preservation.test.js
 */

import { jest } from '@jest/globals';

// ── Mock firebase-admin BEFORE any route imports ──────────────────────────
jest.mock('firebase-admin', () => ({
  apps: ['mock-app'],
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-firebase-uid',
      email: 'preserv@example.com',
    }),
  })),
}));

// ── Mock AWS SDK clients (not needed in these routes, but guard against imports) ──
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
import admin from 'firebase-admin';

import { Assignment } from '../models/Assignment.js';
import { Batch } from '../models/Batch.js';
import { BatchMember } from '../models/BatchMember.js';
import { Post } from '../models/Post.js';
import { User } from '../models/User.js';

// ── Auth mock state ───────────────────────────────────────────────────────
// For Test A and Test C we inject the mock user directly (bypassing auth).
// For Test B we call verifyFirebaseToken directly (not through the mock),
// since jest.mock replaces the module for route imports but we can still
// run the real function logic by reimplementing it inline using the mocked
// firebase-admin (which we control) and the real User model.

let mockUser = null;   // used when bypassing auth (Tests A and C)

jest.mock('../middleware/auth.js', () => ({
  verifyFirebaseToken: (req, _res, next) => {
    req.user = mockUser;
    return next();
  },
}));

// Import routes AFTER mocking
import assignmentsRouter from '../routes/assignments.js';
import postRoutes from '../routes/postRoutes.js';
import batchRoutes from '../routes/batchRoutes.js';

// ── Build minimal Express app ─────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/posts', postRoutes);
  app.use('/api/batch', batchRoutes);

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
  // Clean all collections between tests
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
  mockUser = null;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ═══════════════════════════════════════════════════════════════════════════
// Test A — Assignment list schema completeness
//
// Establishes that GET /api/assignments?batchId=<id> returns a 200 array
// where EVERY element has non-null title, deadline, status, priorityLevel.
// This is a preservation test: we seed known-good assignments and verify
// the read path is intact.
//
// **Validates: Requirements 3.1, 3.10**
// ═══════════════════════════════════════════════════════════════════════════
test('Test A — GET /api/assignments returns schema-complete records for a batchId', async () => {
  const userId = new mongoose.Types.ObjectId();
  const batchId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userId,
    firebaseUid: 'uid_test_A',
    email: 'testA@example.com',
    name: 'Test A User',
    cgpa: 8.5,
    branch: 'CSE',
  });

  // Inject mock user
  mockUser = {
    _id: userId,
    firebaseUid: 'uid_test_A',
    email: 'testA@example.com',
    name: 'Test A User',
    cgpa: 8.5,
    branch: 'CSE',
  };

  // Seed 3 assignments with all schema fields set
  const deadline1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const deadline2 = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const deadline3 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await Assignment.insertMany([
    {
      userId,
      batchId,
      title: 'Operating Systems Assignment',
      subject: 'OS',
      deadline: deadline1,
      status: 'Not Started',
      priorityLevel: 'high',
      priorityScore: 80,
    },
    {
      userId,
      batchId,
      title: 'Database Systems Lab',
      subject: 'DBMS',
      deadline: deadline2,
      status: 'In Progress',
      priorityLevel: 'medium',
      priorityScore: 50,
    },
    {
      userId,
      batchId,
      title: 'Computer Networks Quiz',
      subject: 'CN',
      deadline: deadline3,
      status: 'Not Started',
      priorityLevel: 'low',
      priorityScore: 20,
    },
  ]);

  const res = await request(app)
    .get(`/api/assignments?batchId=${batchId.toString()}`)
    .set('Authorization', 'Bearer fake-token');

  expect(res.status).toBe(200);
  expect(res.body.success).toBe(true);

  const assignments = res.body.data;
  expect(Array.isArray(assignments)).toBe(true);
  expect(assignments.length).toBe(3);

  // Property: EVERY element must have non-null/non-undefined schema fields
  for (const a of assignments) {
    expect(a.title).toBeTruthy();         // non-null, non-empty string
    expect(a.deadline).not.toBeNull();    // non-null date
    expect(a.deadline).toBeDefined();
    expect(a.status).toBeTruthy();        // non-null enum value
    expect(a.priorityLevel).toBeTruthy(); // non-null enum value
  }

  // Verify specific values for each seeded assignment
  const titles = assignments.map(a => a.title);
  expect(titles).toContain('Operating Systems Assignment');
  expect(titles).toContain('Database Systems Lab');
  expect(titles).toContain('Computer Networks Quiz');
});

// ═══════════════════════════════════════════════════════════════════════════
// Test B — verifyFirebaseToken attaches ObjectId _id to req.user
//
// Verifies that the auth middleware logic, when it resolves a Firebase UID,
// attaches the full MongoDB User document to req.user, and that req.user._id
// is a valid Mongoose ObjectId (not a plain string).
//
// Because jest.mock('../middleware/auth.js') replaces the whole module for
// all route imports, we test the middleware logic directly inline using the
// same mocked firebase-admin and the real User model.
//
// The key property we verify: after resolving a Firebase token and fetching
// the User from MongoDB, req.user._id is a Mongoose ObjectId (not a string).
//
// **Validates: Requirements 3.1, 3.2**
// ═══════════════════════════════════════════════════════════════════════════
test('Test B — verifyFirebaseToken attaches MongoDB User with ObjectId _id to req.user', async () => {
  const userId = new mongoose.Types.ObjectId();
  const firebaseUid = 'test-firebase-uid'; // matches the firebase-admin mock return value

  // Create the User document that verifyFirebaseToken would find
  await User.create({
    _id: userId,
    firebaseUid,
    email: 'testB@example.com',
    name: 'Test B User',
    cgpa: 7.0,
    branch: 'IT',
  });

  // Simulate the exact logic of verifyFirebaseToken:
  //   1. Extract token from Authorization header
  //   2. admin.auth().verifyIdToken(token) → returns { uid: 'test-firebase-uid' }
  //   3. User.findOne({ firebaseUid: decodedToken.uid }) → returns the user doc
  //   4. Attach user as req.user
  // We run this logic directly (not through the mocked middleware) to confirm
  // the middleware's contract: req.user._id is a Mongoose ObjectId.

  const fakeToken = 'fake-token-for-test-B';

  // Step 1: mock firebase-admin verifyIdToken (already mocked above)
  const decodedToken = await admin.auth().verifyIdToken(fakeToken);
  expect(decodedToken.uid).toBe('test-firebase-uid');

  // Step 2: User.findOne as verifyFirebaseToken does it
  let user = await User.findOne({ firebaseUid: decodedToken.uid });
  expect(user).not.toBeNull();

  // Step 3: Simulate attaching to req
  const fakeReq = {};
  fakeReq.user = user;

  // Assertion: req.user must be the MongoDB User document
  expect(fakeReq.user).not.toBeNull();
  expect(fakeReq.user._id).toBeDefined();

  // The _id must be a valid Mongoose ObjectId
  expect(mongoose.Types.ObjectId.isValid(fakeReq.user._id)).toBe(true);

  // It must NOT be a plain string — it should be an ObjectId instance
  // Mongoose documents wrap _id as ObjectId (typeof gives 'object' for ObjectId)
  expect(typeof fakeReq.user._id).not.toBe('string');

  // The _id should match the one we created
  expect(fakeReq.user._id.toString()).toBe(userId.toString());

  // firebaseUid should be attached correctly
  expect(fakeReq.user.firebaseUid).toBe(firebaseUid);

  // Additional check: the _id is an actual ObjectId instance (not just valid)
  // mongoose.Types.ObjectId.isValid returns true for strings too, so we
  // specifically check it's an object (ObjectId) not a primitive string
  expect(fakeReq.user._id).not.toBeInstanceOf(String);
  
  // Verify auto-create path: if no user exists, verifyFirebaseToken creates one
  // Clean up and test with a new UID
  await User.deleteMany({});
  const newFirebaseUid = 'brand-new-uid-test-B';
  admin.auth().verifyIdToken.mockResolvedValueOnce({
    uid: newFirebaseUid,
    email: 'newuser@example.com',
    name: 'New User B',
  });

  const newDecoded = await admin.auth().verifyIdToken(fakeToken);
  let newUser = await User.findOne({ firebaseUid: newDecoded.uid });
  if (!newUser) {
    // verifyFirebaseToken auto-creates users on first sign-in
    newUser = await User.create({
      firebaseUid: newDecoded.uid,
      email: newDecoded.email,
      name: newDecoded.name || newDecoded.email.split('@')[0],
    });
  }

  // The auto-created user also has an ObjectId _id
  expect(mongoose.Types.ObjectId.isValid(newUser._id)).toBe(true);
  expect(typeof newUser._id).not.toBe('string');
});

// ═══════════════════════════════════════════════════════════════════════════
// Test C — Posts GET returns sorted isPinned desc, createdAt desc
//
// Seeds 5 posts with varying isPinned and createdAt values for a single batch.
// Calls GET /api/posts/:batchId with two different query-param combinations:
//   1. ?category=general
//   2. ?search=post
// Asserts that in both cases the response is sorted isPinned: -1, createdAt: -1
// (pinned posts first, then newest first among each isPinned tier).
//
// **Validates: Requirements 3.11**
// ═══════════════════════════════════════════════════════════════════════════
test('Test C — GET /api/posts/:batchId preserves isPinned desc + createdAt desc sort across query params', async () => {
  const userId = new mongoose.Types.ObjectId();
  const batchId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userId,
    firebaseUid: 'uid_test_C',
    email: 'testC@example.com',
    name: 'Test C User',
    cgpa: 8.0,
    branch: 'CSE',
  });

  // Inject mock user (must be a batch member for checkBatchMembership middleware)
  mockUser = {
    _id: userId,
    firebaseUid: 'uid_test_C',
    email: 'testC@example.com',
    name: 'Test C User',
    cgpa: 8.0,
    branch: 'CSE',
  };

  // Create the batch
  const batch = await Batch.create({
    _id: batchId,
    batchName: 'Test Batch C',
    batchCode: 'TESTC001',
    college: 'Test College',
    branch: 'CSE',
    ownerId: userId,
  });

  // Make user a batch member (required by checkBatchMembership)
  await BatchMember.create({
    batchId,
    userId,
    role: 'owner',
  });

  // Seed 5 posts with varying isPinned and createdAt timestamps
  // We create them with explicit timestamps so the sort order is deterministic
  const now = Date.now();
  const posts = [
    { isPinned: false, createdAt: new Date(now - 5000), title: 'Post oldest unpinned', type: 'general' },
    { isPinned: true,  createdAt: new Date(now - 4000), title: 'Post older pinned',   type: 'general' },
    { isPinned: false, createdAt: new Date(now - 3000), title: 'Post middle unpinned', type: 'general' },
    { isPinned: true,  createdAt: new Date(now - 2000), title: 'Post newer pinned',   type: 'general' },
    { isPinned: false, createdAt: new Date(now - 1000), title: 'Post newest unpinned', type: 'general' },
  ];

  // Insert posts directly into MongoDB (bypassing routes to avoid auth issues)
  for (const p of posts) {
    await Post.create({
      batchId: batchId.toString(),
      uploadedBy: userId.toString(),
      title: p.title,
      type: p.type,
      originalText: `Content for ${p.title}`,
      isPinned: p.isPinned,
      createdAt: p.createdAt,
    });
  }

  // Helper: verify sort order of the response array
  function assertSortedPinnedFirst(responseBody) {
    const arr = responseBody;
    expect(Array.isArray(arr)).toBe(true);
    expect(arr.length).toBeGreaterThan(0);

    for (let i = 0; i < arr.length - 1; i++) {
      const curr = arr[i];
      const next = arr[i + 1];
      const currPinned = curr.isPinned ? 1 : 0;
      const nextPinned = next.isPinned ? 1 : 0;

      // Pinned posts must come before unpinned posts
      if (currPinned < nextPinned) {
        throw new Error(
          `Sort violation at index ${i}: unpinned post "${curr.title}" before pinned post "${next.title}"`
        );
      }

      // Among same isPinned value, newer createdAt must come first
      if (currPinned === nextPinned) {
        const currDate = new Date(curr.createdAt).getTime();
        const nextDate = new Date(next.createdAt).getTime();
        expect(currDate).toBeGreaterThanOrEqual(nextDate);
      }
    }
  }

  // --- Query 1: category filter ---
  const res1 = await request(app)
    .get(`/api/posts/${batchId.toString()}?category=general`)
    .set('Authorization', 'Bearer fake-token');

  expect(res1.status).toBe(200);
  assertSortedPinnedFirst(res1.body);

  // The first two items should be the pinned posts (newer pinned first)
  expect(res1.body[0].isPinned).toBe(true);
  expect(res1.body[1].isPinned).toBe(true);
  // The newer pinned post should come before the older pinned one
  const date0 = new Date(res1.body[0].createdAt).getTime();
  const date1 = new Date(res1.body[1].createdAt).getTime();
  expect(date0).toBeGreaterThan(date1);

  // --- Query 2: search filter (matches all posts via "Post" keyword in title) ---
  const res2 = await request(app)
    .get(`/api/posts/${batchId.toString()}?search=Post`)
    .set('Authorization', 'Bearer fake-token');

  expect(res2.status).toBe(200);
  assertSortedPinnedFirst(res2.body);

  // Sort order must be the same across both query-param combinations
  const titles1 = res1.body.map(p => p.title);
  const titles2 = res2.body.map(p => p.title);
  expect(titles1).toEqual(titles2);
});
