/**
 * applyNoticeToTimetable — Unit Tests
 *
 * Tests the applyNoticeToTimetable function covering:
 * - Temporary notices: TimetableOverride creation + audit log
 * - Permanent notices: Timetable slot updates + audit log
 * - Permanent cancellation: slot removal
 * - Skipping notices with invalid dates or missing timetable/slot
 * - Empty/null input handling
 * - Error accumulation in return value
 */

import { jest } from '@jest/globals';

// Mock external dependencies not needed for this test
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

// Mock gemini (not needed for applyNoticeToTimetable but imported at module level)
jest.mock('../config/gemini.js', () => ({
  invokeAI: jest.fn(),
}));

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { Timetable } from '../models/Timetable.js';
import { TimetableOverride } from '../models/TimetableOverride.js';
import { TimetableAuditLog } from '../models/TimetableAuditLog.js';
import { applyNoticeToTimetable } from '../services/noticeDetector.js';

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

// Helper to create a timetable for testing
async function seedTimetable(batchId, dayOfWeek, slots) {
  return Timetable.create({ batchId, dayOfWeek, slots });
}

describe('applyNoticeToTimetable', () => {
  const batchId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const userName = 'Test User';

  test('returns empty result for null/empty notices', async () => {
    const result1 = await applyNoticeToTimetable(null, batchId, userId, userName);
    expect(result1).toEqual({ applied: 0, skipped: 0, errors: [], notificationsSent: 0 });

    const result2 = await applyNoticeToTimetable([], batchId, userId, userName);
    expect(result2).toEqual({ applied: 0, skipped: 0, errors: [], notificationsSent: 0 });

    const result3 = await applyNoticeToTimetable(undefined, batchId, userId, userName);
    expect(result3).toEqual({ applied: 0, skipped: 0, errors: [], notificationsSent: 0 });
  });

  test('temporary notice creates TimetableOverride and audit log', async () => {
    // Seed a Monday timetable with a CSE301 slot
    // 2026-02-16 is a Monday
    const timetable = await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'Database Management', venue: 'Room 101', faculty: 'Dr. Sharma' },
      { time: '11:00 AM', courseCode: 'CSE305', courseName: 'Computer Networks', venue: 'Room 102', faculty: 'Prof. Gupta' },
    ]);

    const notices = [{
      type: 'room_changed',
      courseCode: 'CSE301',
      courseName: 'Database Management',
      affectedDate: '2026-02-16', // Monday
      originalTime: '09:00 AM',
      newTime: '',
      newVenue: 'Room 205',
      newFaculty: '',
      determination: 'temporary',
      isPermanent: false,
      reason: 'Room maintenance',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Check TimetableOverride was created
    const overrides = await TimetableOverride.find({ batchId });
    expect(overrides).toHaveLength(1);
    expect(overrides[0].timetableId.toString()).toBe(timetable._id.toString());
    expect(overrides[0].slotIndex).toBe(0);
    expect(overrides[0].overrideType).toBe('room_changed');
    expect(overrides[0].newVenue).toBe('Room 205');
    expect(overrides[0].newTime).toBeNull();
    expect(overrides[0].newFaculty).toBeNull();
    expect(overrides[0].source).toBe('notice_ai');
    expect(overrides[0].reason).toBe('Room maintenance');
    expect(overrides[0].createdBy.toString()).toBe(userId.toString());
    expect(overrides[0].flaggedForReview).toBe(false);

    // Check audit log was created
    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('notice_applied');
    expect(logs[0].targetDay).toBe('Monday');
    expect(logs[0].targetSlotIndex).toBe(0);
    expect(logs[0].performedBy.toString()).toBe(userId.toString());
    expect(logs[0].performedByName).toBe('Test User');
    expect(logs[0].changeDetails.type).toBe('room_changed');
    expect(logs[0].changeDetails.isPermanent).toBe(false);
  });

  test('permanent notice updates timetable slot directly', async () => {
    // 2026-02-18 is a Wednesday
    await seedTimetable(batchId, 'Wednesday', [
      { time: '10:00 AM', courseCode: 'CSE305', courseName: 'Computer Networks', venue: 'Room 102', faculty: 'Prof. Gupta' },
    ]);

    const notices = [{
      type: 'faculty_changed',
      courseCode: 'CSE305',
      courseName: 'Computer Networks',
      affectedDate: '2026-02-18', // Wednesday
      originalTime: '10:00 AM',
      newTime: '',
      newVenue: '',
      newFaculty: 'Dr. Kumar',
      determination: 'permanent',
      isPermanent: true,
      reason: 'Faculty reassignment',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);

    // Check timetable was updated directly
    const updatedTimetable = await Timetable.findOne({ batchId, dayOfWeek: 'Wednesday' });
    expect(updatedTimetable.slots[0].faculty).toBe('Dr. Kumar');
    expect(updatedTimetable.slots[0].venue).toBe('Room 102'); // unchanged
    expect(updatedTimetable.lastPermanentUpdateAt).not.toBeNull();
    expect(updatedTimetable.lastPermanentUpdateBy.toString()).toBe(userId.toString());

    // No TimetableOverride should be created for permanent changes
    const overrides = await TimetableOverride.find({ batchId });
    expect(overrides).toHaveLength(0);

    // Audit log with action 'override_perm'
    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('override_perm');
    expect(logs[0].changeDetails.isPermanent).toBe(true);
  });

  test('permanent cancellation removes the slot from timetable', async () => {
    // 2026-02-17 is a Tuesday
    await seedTimetable(batchId, 'Tuesday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'Database Management', venue: 'Room 101', faculty: 'Dr. Sharma' },
      { time: '11:00 AM', courseCode: 'CSE305', courseName: 'Computer Networks', venue: 'Room 102', faculty: 'Prof. Gupta' },
    ]);

    const notices = [{
      type: 'cancelled',
      courseCode: 'CSE301',
      courseName: 'Database Management',
      affectedDate: '2026-02-17', // Tuesday
      originalTime: '09:00 AM',
      newTime: '',
      newVenue: '',
      newFaculty: '',
      determination: 'permanent',
      isPermanent: true,
      reason: 'Course discontinued',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);

    // Slot should be removed
    const updatedTimetable = await Timetable.findOne({ batchId, dayOfWeek: 'Tuesday' });
    expect(updatedTimetable.slots).toHaveLength(1);
    expect(updatedTimetable.slots[0].courseCode).toBe('CSE305'); // remaining slot
    expect(updatedTimetable.lastPermanentUpdateAt).not.toBeNull();

    // Audit log shows slotRemoved
    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs[0].changeDetails.slotRemoved).toBe(true);
  });

  test('skips notice with invalid affectedDate', async () => {
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
    ]);

    const notices = [{
      type: 'cancelled',
      courseCode: 'CSE301',
      affectedDate: 'not-a-date',
      isPermanent: false,
      reason: 'Test',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.skipped).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Invalid affectedDate');
  });

  test('skips notice when no timetable found for the day', async () => {
    // Seed Monday timetable, but notice is for Wednesday (no timetable)
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
    ]);

    const notices = [{
      type: 'room_changed',
      courseCode: 'CSE301',
      affectedDate: '2026-02-18', // Wednesday
      newVenue: 'Room 300',
      isPermanent: false,
      reason: 'Test',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.skipped).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.errors[0]).toContain('No timetable found');
  });

  test('skips notice when course code not found in timetable slots', async () => {
    // 2026-02-16 is Monday
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
    ]);

    const notices = [{
      type: 'room_changed',
      courseCode: 'CSE999', // doesn't exist in timetable
      affectedDate: '2026-02-16', // Monday
      newVenue: 'Room 300',
      isPermanent: false,
      reason: 'Test',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.skipped).toBe(1);
    expect(result.applied).toBe(0);
    expect(result.errors[0]).toContain('No matching slot');
  });

  test('course code matching is case-insensitive', async () => {
    // 2026-02-16 is Monday
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
    ]);

    const notices = [{
      type: 'room_changed',
      courseCode: 'cse301', // lowercase
      affectedDate: '2026-02-16', // Monday
      newVenue: 'Room 205',
      isPermanent: false,
      reason: 'Room maintenance',
      flaggedForReview: false,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test('flaggedForReview is passed through to override', async () => {
    // 2026-02-16 is Monday
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
    ]);

    const notices = [{
      type: 'rescheduled',
      courseCode: 'CSE301',
      affectedDate: '2026-02-16',
      newTime: '11:00 AM',
      isPermanent: false,
      reason: 'Unknown determination',
      flaggedForReview: true,
    }];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);

    const override = await TimetableOverride.findOne({ batchId });
    expect(override.flaggedForReview).toBe(true);
  });

  test('handles multiple notices with mixed results', async () => {
    // 2026-02-16 is Monday
    await seedTimetable(batchId, 'Monday', [
      { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'F1' },
      { time: '11:00 AM', courseCode: 'CSE305', courseName: 'CN', venue: 'R2', faculty: 'F2' },
    ]);

    const notices = [
      {
        type: 'room_changed',
        courseCode: 'CSE301',
        affectedDate: '2026-02-16', // Monday - should succeed
        newVenue: 'Room 500',
        isPermanent: false,
        reason: 'OK notice',
        flaggedForReview: false,
      },
      {
        type: 'cancelled',
        courseCode: 'CSE999', // doesn't exist - should skip
        affectedDate: '2026-02-16',
        isPermanent: false,
        reason: 'Missing course',
        flaggedForReview: false,
      },
      {
        type: 'faculty_changed',
        courseCode: 'CSE305',
        affectedDate: 'invalid', // bad date - should skip
        newFaculty: 'Dr. New',
        isPermanent: false,
        reason: 'Bad date',
        flaggedForReview: false,
      },
    ];

    const result = await applyNoticeToTimetable(notices, batchId, userId, userName);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.errors).toHaveLength(2);
  });
});
