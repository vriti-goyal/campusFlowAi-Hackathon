/**
 * CourseFilter Service — Unit Tests
 *
 * Tests the filterByCourses function covering:
 * - Course enrollment lookup and filtering
 * - Batch Admin bypass
 * - Edge case: no course codes in extracted data
 */

import { jest } from '@jest/globals';

// Mock external dependencies
jest.mock('firebase-admin', () => ({
  apps: ['mock-app'],
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'test-uid' }),
  })),
}));

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
import { BatchMember } from '../models/BatchMember.js';
import { Batch } from '../models/Batch.js';
import { filterByCourses } from '../services/courseFilter.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

describe('filterByCourses', () => {
  test('filters out entries whose courseCode is not in user enrolled courses', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    // Create batch with specific courses
    const batch = await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6A',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [
        { code: 'CSE301', name: 'Database Management' },
        { code: 'CSE305', name: 'Computer Networks' },
      ],
    });

    // Make user a member of this batch
    await BatchMember.create({ batchId, userId, role: 'member' });

    const extractedData = {
      timetable: [
        { courseCode: 'CSE301', courseName: 'Database Management', time: '09:00 AM' },
        { courseCode: 'CSE305', courseName: 'Computer Networks', time: '10:00 AM' },
        { courseCode: 'ECE201', courseName: 'Signals', time: '11:00 AM' }, // not enrolled
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    expect(result.discardedCount).toBe(1);
    expect(result.filtered.timetable).toHaveLength(2);
    expect(result.filtered.timetable.map(e => e.courseCode)).toEqual(['CSE301', 'CSE305']);
  });

  test('uppercases course codes for comparison', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6B',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'cse301', name: 'Database Management' }],
    });

    await BatchMember.create({ batchId, userId, role: 'member' });

    const extractedData = {
      exam_schedule: [
        { courseCode: 'CSE301', courseName: 'Database Management', date: '2026-02-15' },
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    expect(result.discardedCount).toBe(0);
    expect(result.filtered.exam_schedule).toHaveLength(1);
  });

  test('batch admin (owner) bypasses filtering', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6C',
      ownerId: userId,
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    // User is owner of the batch
    await BatchMember.create({ batchId, userId, role: 'owner' });

    const extractedData = {
      timetable: [
        { courseCode: 'CSE301', courseName: 'Database Management', time: '09:00 AM' },
        { courseCode: 'ECE201', courseName: 'Signals', time: '11:00 AM' },
        { courseCode: 'ME101', courseName: 'Mechanics', time: '12:00 PM' },
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    // Admin bypass: all entries pass through
    expect(result.discardedCount).toBe(0);
    expect(result.filtered.timetable).toHaveLength(3);
  });

  test('batch admin (moderator) bypasses filtering', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6D',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    await BatchMember.create({ batchId, userId, role: 'moderator' });

    const extractedData = {
      timetable: [
        { courseCode: 'UNKNOWN100', courseName: 'Unknown Course', time: '09:00 AM' },
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    expect(result.discardedCount).toBe(0);
    expect(result.filtered.timetable).toHaveLength(1);
  });

  test('skips filtering when no entries have courseCode (general notice edge case)', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6E',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    await BatchMember.create({ batchId, userId, role: 'member' });

    // Notice without course codes
    const extractedData = {
      notice: [
        { title: 'College closed tomorrow', type: 'cancellation' },
        { title: 'Holiday on Friday', type: 'announcement' },
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    // No filtering applied — all entries pass through
    expect(result.discardedCount).toBe(0);
    expect(result.filtered.notice).toHaveLength(2);
  });

  test('entries without courseCode pass through even when other entries are filtered', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6F',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    await BatchMember.create({ batchId, userId, role: 'member' });

    const extractedData = {
      timetable: [
        { courseCode: 'CSE301', courseName: 'Database Management', time: '09:00 AM' },
        { courseCode: 'ECE201', courseName: 'Signals', time: '11:00 AM' },
      ],
      notice: [
        { title: 'General announcement' }, // no courseCode
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    // ECE201 is discarded, CSE301 kept, notice without courseCode passes through
    expect(result.discardedCount).toBe(1);
    expect(result.filtered.timetable).toHaveLength(1);
    expect(result.filtered.timetable[0].courseCode).toBe('CSE301');
    expect(result.filtered.notice).toHaveLength(1);
  });

  test('user with multiple batch memberships aggregates all course codes', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId1 = new mongoose.Types.ObjectId();
    const batchId2 = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId1,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6G',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    await Batch.create({
      _id: batchId2,
      batchName: 'Minor Elective',
      batchCode: 'MINOR1',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'ECE201', name: 'Signals' }],
    });

    await BatchMember.create({ batchId: batchId1, userId, role: 'member' });
    await BatchMember.create({ batchId: batchId2, userId, role: 'member' });

    const extractedData = {
      timetable: [
        { courseCode: 'CSE301', courseName: 'Database Management', time: '09:00 AM' },
        { courseCode: 'ECE201', courseName: 'Signals', time: '10:00 AM' },
        { courseCode: 'ME101', courseName: 'Mechanics', time: '11:00 AM' },
      ],
    };

    // Using batchId1 as target — user is a member (not admin), so filtering applies
    const result = await filterByCourses(userId.toString(), batchId1.toString(), extractedData);

    // CSE301 from batch1, ECE201 from batch2 — both should pass. ME101 discarded.
    expect(result.discardedCount).toBe(1);
    expect(result.filtered.timetable).toHaveLength(2);
    const codes = result.filtered.timetable.map(e => e.courseCode);
    expect(codes).toContain('CSE301');
    expect(codes).toContain('ECE201');
  });

  test('returns all discarded when user has no matching courses', async () => {
    const userId = new mongoose.Types.ObjectId();
    const batchId = new mongoose.Types.ObjectId();

    await Batch.create({
      _id: batchId,
      batchName: 'CSE 6th Sem',
      batchCode: 'CSE6H',
      ownerId: new mongoose.Types.ObjectId(),
      courses: [{ code: 'CSE301', name: 'Database Management' }],
    });

    await BatchMember.create({ batchId, userId, role: 'member' });

    const extractedData = {
      timetable: [
        { courseCode: 'ECE201', courseName: 'Signals', time: '10:00 AM' },
        { courseCode: 'ME101', courseName: 'Mechanics', time: '11:00 AM' },
      ],
    };

    const result = await filterByCourses(userId.toString(), batchId.toString(), extractedData);

    expect(result.discardedCount).toBe(2);
    expect(result.filtered.timetable).toHaveLength(0);
  });
});
