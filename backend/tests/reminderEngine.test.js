/**
 * ReminderEngine Service — Unit Tests
 *
 * Tests the detectAndCreateReminders function covering:
 * - Assignment deadline detection
 * - Exam date detection
 * - Notice-referenced date detection
 * - Edge cases: null dates, invalid dates, past dates, deadlineUnknown
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
import { Reminder } from '../models/Reminder.js';
import { detectAndCreateReminders, createRemindersForDeadline, updateRemindersForDeadline } from '../services/reminderEngine.js';

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

// Helper: create a future date (days from now)
function futureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

describe('detectAndCreateReminders', () => {
  const batchId = new mongoose.Types.ObjectId().toString();

  describe('assignment deadline detection', () => {
    test('creates reminders for assignment with valid deadline', async () => {
      const deadline = futureDate(3);
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), title: 'SQL Assignment', deadline, deadlineUnknown: false },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments });

      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].type).toBe('assignment');
      expect(result.details[0].title).toBe('SQL Assignment');

      // Verify reminders in DB
      const reminders = await Reminder.find({ referenceType: 'assignment' });
      expect(reminders.length).toBeGreaterThan(0);
      expect(reminders[0].title).toBe('SQL Assignment');
    });

    test('skips assignment when deadlineUnknown is true', async () => {
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), title: 'Unknown Deadline', deadline: futureDate(5), deadlineUnknown: true },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('skips assignment with null deadline', async () => {
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), title: 'No Deadline', deadline: null },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('skips assignment with invalid date string', async () => {
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), title: 'Bad Date', deadline: 'not-a-date' },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('uses subject as fallback title when title is missing', async () => {
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), subject: 'Mathematics', deadline: futureDate(5) },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments });

      expect(result.details[0].title).toBe('Mathematics');
    });
  });

  describe('exam date detection', () => {
    test('creates reminders for exam with valid examDate', async () => {
      const exams = [
        {
          _id: new mongoose.Types.ObjectId(),
          courseName: 'Database Management',
          courseCode: 'CSE301',
          examDate: futureDate(7),
          examType: 'Mid Semester',
        },
      ];

      const result = await detectAndCreateReminders({ batchId, exams });

      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].type).toBe('exam_schedule');
      expect(result.details[0].title).toContain('Database Management');
      expect(result.details[0].title).toContain('Mid Semester');
    });

    test('skips exam with null examDate', async () => {
      const exams = [
        { _id: new mongoose.Types.ObjectId(), courseName: 'Test', examDate: null },
      ];

      const result = await detectAndCreateReminders({ batchId, exams });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('skips exam with invalid examDate', async () => {
      const exams = [
        { _id: new mongoose.Types.ObjectId(), courseName: 'Test', examDate: 'invalid' },
      ];

      const result = await detectAndCreateReminders({ batchId, exams });

      expect(result.remindersCreated).toBe(0);
    });

    test('uses courseCode as fallback title when courseName is missing', async () => {
      const exams = [
        { _id: new mongoose.Types.ObjectId(), courseCode: 'CSE301', examDate: futureDate(5) },
      ];

      const result = await detectAndCreateReminders({ batchId, exams });

      expect(result.details[0].title).toBe('CSE301 Exam');
    });
  });

  describe('notice-referenced date detection', () => {
    test('creates reminders for notice with valid affectedDate', async () => {
      const notices = [
        {
          _id: new mongoose.Types.ObjectId(),
          courseName: 'CSE301',
          type: 'cancelled',
          affectedDate: futureDate(4),
          reason: 'Faculty on leave',
        },
      ];

      const result = await detectAndCreateReminders({ batchId, notices });

      expect(result.remindersCreated).toBeGreaterThan(0);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].type).toBe('custom');
    });

    test('sets referenceType to registration for registration-related notices', async () => {
      const notices = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'registration',
          affectedDate: futureDate(10),
          reason: 'Course registration deadline',
          courseName: 'Elective Registration',
        },
      ];

      const result = await detectAndCreateReminders({ batchId, notices });

      expect(result.details[0].type).toBe('registration');
    });

    test('skips notice with null affectedDate', async () => {
      const notices = [
        { _id: new mongoose.Types.ObjectId(), type: 'cancelled', affectedDate: null },
      ];

      const result = await detectAndCreateReminders({ batchId, notices });

      expect(result.remindersCreated).toBe(0);
    });
  });

  describe('combined input handling', () => {
    test('processes all categories together and returns aggregate count', async () => {
      const assignments = [
        { _id: new mongoose.Types.ObjectId(), title: 'Assignment 1', deadline: futureDate(3) },
      ];
      const exams = [
        { _id: new mongoose.Types.ObjectId(), courseName: 'DB', examDate: futureDate(7) },
      ];
      const notices = [
        { _id: new mongoose.Types.ObjectId(), type: 'registration', affectedDate: futureDate(5), courseName: 'Elective', reason: 'registration deadline' },
      ];

      const result = await detectAndCreateReminders({ batchId, assignments, exams, notices });

      // Each entry with a future date >1 day away should produce 2 reminders (1 day before + 1 hour before)
      expect(result.remindersCreated).toBe(6);
      expect(result.details).toHaveLength(3);
    });

    test('returns zero when all arrays are empty', async () => {
      const result = await detectAndCreateReminders({ batchId });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    test('skips past dates across all categories', async () => {
      const pastDate = new Date('2020-01-01');
      const assignments = [{ _id: new mongoose.Types.ObjectId(), title: 'Old', deadline: pastDate }];
      const exams = [{ _id: new mongoose.Types.ObjectId(), courseName: 'Old', examDate: pastDate }];
      const notices = [{ _id: new mongoose.Types.ObjectId(), type: 'custom', affectedDate: pastDate }];

      const result = await detectAndCreateReminders({ batchId, assignments, exams, notices });

      expect(result.remindersCreated).toBe(0);
      expect(result.details).toHaveLength(0);
    });
  });
});


describe('updateRemindersForDeadline', () => {
  const batchId = new mongoose.Types.ObjectId();
  const referenceId = new mongoose.Types.ObjectId();

  async function seedPendingReminders() {
    const deadline = futureDate(3);
    return Reminder.insertMany([
      {
        batchId,
        referenceType: 'assignment',
        referenceId,
        title: 'SQL Assignment',
        deadlineDate: deadline,
        remindAt: new Date(deadline.getTime() - 24 * 60 * 60 * 1000),
        intervalLabel: '1_day_before',
        status: 'pending',
      },
      {
        batchId,
        referenceType: 'assignment',
        referenceId,
        title: 'SQL Assignment',
        deadlineDate: deadline,
        remindAt: new Date(deadline.getTime() - 1 * 60 * 60 * 1000),
        intervalLabel: '1_hour_before',
        status: 'pending',
      },
    ]);
  }

  test('cancels existing pending reminders and creates new ones for a valid future date', async () => {
    await seedPendingReminders();

    const newDeadline = futureDate(7);
    const result = await updateRemindersForDeadline(referenceId, newDeadline);

    expect(result.cancelledCount).toBe(2);
    expect(result.newReminders.length).toBe(2);

    // Old reminders should be cancelled
    const cancelled = await Reminder.find({ referenceId, status: 'cancelled' });
    expect(cancelled.length).toBe(2);

    // New reminders should be pending with updated deadline
    const pending = await Reminder.find({ referenceId, status: 'pending' });
    expect(pending.length).toBe(2);
    expect(new Date(pending[0].deadlineDate).getTime()).toBe(new Date(newDeadline).getTime());
  });

  test('returns early with zero counts when no pending reminders exist', async () => {
    const result = await updateRemindersForDeadline(new mongoose.Types.ObjectId(), futureDate(5));

    expect(result.cancelledCount).toBe(0);
    expect(result.newReminders).toHaveLength(0);
  });

  test('cancels reminders but does not create new ones when newDate is in the past', async () => {
    await seedPendingReminders();

    const pastDate = new Date('2020-01-01');
    const result = await updateRemindersForDeadline(referenceId, pastDate);

    expect(result.cancelledCount).toBe(2);
    expect(result.newReminders).toHaveLength(0);

    // All reminders should be cancelled, none pending
    const pending = await Reminder.find({ referenceId, status: 'pending' });
    expect(pending.length).toBe(0);
  });

  test('cancels reminders but does not create new ones when newDate is invalid', async () => {
    await seedPendingReminders();

    const result = await updateRemindersForDeadline(referenceId, 'not-a-date');

    expect(result.cancelledCount).toBe(2);
    expect(result.newReminders).toHaveLength(0);
  });

  test('cancels reminders but does not create new ones when newDate is null', async () => {
    await seedPendingReminders();

    const result = await updateRemindersForDeadline(referenceId, null);

    expect(result.cancelledCount).toBe(2);
    expect(result.newReminders).toHaveLength(0);
  });

  test('preserves batchId, referenceType, and title from original reminders', async () => {
    await seedPendingReminders();

    const newDeadline = futureDate(10);
    const result = await updateRemindersForDeadline(referenceId, newDeadline);

    for (const reminder of result.newReminders) {
      expect(reminder.batchId.toString()).toBe(batchId.toString());
      expect(reminder.referenceType).toBe('assignment');
      expect(reminder.title).toBe('SQL Assignment');
    }
  });

  test('does not affect already-cancelled or sent reminders', async () => {
    const deadline = futureDate(3);
    // Insert a cancelled and a sent reminder alongside pending ones
    await Reminder.insertMany([
      {
        batchId,
        referenceType: 'assignment',
        referenceId,
        title: 'SQL Assignment',
        deadlineDate: deadline,
        remindAt: new Date(deadline.getTime() - 24 * 60 * 60 * 1000),
        intervalLabel: '1_day_before',
        status: 'cancelled',
      },
      {
        batchId,
        referenceType: 'assignment',
        referenceId,
        title: 'SQL Assignment',
        deadlineDate: deadline,
        remindAt: new Date(deadline.getTime() - 1 * 60 * 60 * 1000),
        intervalLabel: '1_hour_before',
        status: 'sent',
        sentAt: new Date(),
      },
      {
        batchId,
        referenceType: 'assignment',
        referenceId,
        title: 'SQL Assignment',
        deadlineDate: deadline,
        remindAt: new Date(deadline.getTime() - 24 * 60 * 60 * 1000),
        intervalLabel: '1_day_before',
        status: 'pending',
      },
    ]);

    const result = await updateRemindersForDeadline(referenceId, futureDate(7));

    // Only the one pending reminder should be cancelled
    expect(result.cancelledCount).toBe(1);

    // The previously cancelled and sent reminders should remain unchanged
    const sent = await Reminder.find({ referenceId, status: 'sent' });
    expect(sent.length).toBe(1);
    const prevCancelled = await Reminder.find({ referenceId, status: 'cancelled' });
    // 1 originally cancelled + 1 newly cancelled = 2
    expect(prevCancelled.length).toBe(2);
  });
});
