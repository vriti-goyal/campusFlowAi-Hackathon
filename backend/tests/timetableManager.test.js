/**
 * TimetableManager Service — Unit Tests (Task 6.1)
 *
 * Tests the CRUD functions: createSlot, updateSlot, deleteSlot
 * covering:
 * - Slot creation with duplicate detection
 * - Slot update with audit logging
 * - Slot deletion with audit logging
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
import { Timetable } from '../models/Timetable.js';
import { TimetableAuditLog } from '../models/TimetableAuditLog.js';
import { createSlot, updateSlot, deleteSlot, applyPermanentUpdate } from '../services/timetableManager.js';

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

describe('createSlot', () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    displayName: 'Admin User',
  };

  test('creates a new slot in an existing timetable', async () => {
    const batchId = new mongoose.Types.ObjectId();

    // Pre-create a timetable
    await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '08:00 AM', courseCode: 'CSE100', courseName: 'Intro CS', venue: 'R100', faculty: 'Dr. A' }],
      uploadedBy: adminUser._id,
    });

    const slot = { time: '09:00 AM', courseCode: 'CSE301', courseName: 'Database Management', venue: 'Room 101', faculty: 'Dr. Sharma' };
    const result = await createSlot(batchId, 'Monday', slot, adminUser);

    expect(result.success).toBe(true);
    expect(result.slotIndex).toBe(1);
    expect(result.slot.courseCode).toBe('CSE301');

    // Verify in DB
    const timetable = await Timetable.findOne({ batchId, dayOfWeek: 'Monday' });
    expect(timetable.slots).toHaveLength(2);
    expect(timetable.slots[1].courseCode).toBe('CSE301');
  });

  test('creates a new timetable document if none exists', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const slot = { time: '10:00 AM', courseCode: 'CSE305', courseName: 'Networks', venue: 'Room 201', faculty: 'Prof. Gupta' };

    const result = await createSlot(batchId, 'Tuesday', slot, adminUser);

    expect(result.success).toBe(true);
    expect(result.slotIndex).toBe(0);

    const timetable = await Timetable.findOne({ batchId, dayOfWeek: 'Tuesday' });
    expect(timetable).not.toBeNull();
    expect(timetable.slots).toHaveLength(1);
    expect(timetable.slots[0].courseCode).toBe('CSE305');
  });

  test('detects duplicate slot and skips creation', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const slot = { time: '09:00 AM', courseCode: 'CSE301', courseName: 'Database Management', venue: 'Room 101', faculty: 'Dr. Sharma' };

    // First creation
    await createSlot(batchId, 'Monday', slot, adminUser);

    // Duplicate creation attempt
    const result = await createSlot(batchId, 'Monday', slot, adminUser);

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('Duplicate slot exists');
    expect(result.existing.courseCode).toBe('CSE301');
  });

  test('allows same courseCode at different times (not a duplicate)', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const slot1 = { time: '09:00 AM', courseCode: 'CSE301', courseName: 'Database Management', venue: 'Room 101', faculty: 'Dr. Sharma' };
    const slot2 = { time: '11:00 AM', courseCode: 'CSE301', courseName: 'Database Management Lab', venue: 'Lab 1', faculty: 'Dr. Sharma' };

    await createSlot(batchId, 'Monday', slot1, adminUser);
    const result = await createSlot(batchId, 'Monday', slot2, adminUser);

    expect(result.success).toBe(true);
    expect(result.slotIndex).toBe(1);
  });

  test('writes an audit log entry on creation', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const slot = { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' };

    await createSlot(batchId, 'Wednesday', slot, adminUser);

    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('create');
    expect(logs[0].targetDay).toBe('Wednesday');
    expect(logs[0].performedByName).toBe('Admin User');
    expect(logs[0].changeDetails.added.courseCode).toBe('CSE301');
  });

  test('uses name field if displayName is not available', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const admin = { _id: new mongoose.Types.ObjectId(), name: 'Fallback Name' };
    const slot = { time: '09:00 AM', courseCode: 'CSE400', courseName: 'AI', venue: 'R2', faculty: 'Prof. X' };

    await createSlot(batchId, 'Thursday', slot, admin);

    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs[0].performedByName).toBe('Fallback Name');
  });
});

describe('updateSlot', () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    displayName: 'Admin Updater',
  };

  test('updates a slot with new venue and faculty', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'Room 101', faculty: 'Dr. Sharma' }],
      uploadedBy: adminUser._id,
    });

    const result = await updateSlot(timetable._id, 0, { venue: 'Room 205', faculty: 'Dr. Gupta' }, adminUser, 'Faculty reassigned');

    expect(result.success).toBe(true);
    expect(result.slot.venue).toBe('Room 205');
    expect(result.slot.faculty).toBe('Dr. Gupta');
    expect(result.changes.venue).toEqual({ from: 'Room 101', to: 'Room 205' });
    expect(result.changes.faculty).toEqual({ from: 'Dr. Sharma', to: 'Dr. Gupta' });
  });

  test('returns error for non-existent timetable', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await updateSlot(fakeId, 0, { venue: 'X' }, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Timetable not found');
  });

  test('returns error for invalid slot index', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await updateSlot(timetable._id, 5, { venue: 'X' }, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid slot index');
  });

  test('writes an audit log entry with change diff', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Tuesday',
      slots: [{ time: '10:00 AM', courseCode: 'CSE305', courseName: 'Networks', venue: 'Room 201', faculty: 'Prof. G' }],
      uploadedBy: adminUser._id,
    });

    await updateSlot(timetable._id, 0, { time: '11:00 AM' }, adminUser, 'Time conflict resolution');

    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('update');
    expect(logs[0].targetSlotIndex).toBe(0);
    expect(logs[0].reason).toBe('Time conflict resolution');
    expect(logs[0].changeDetails.time).toEqual({ from: '10:00 AM', to: '11:00 AM' });
  });

  test('only updates allowed fields', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await updateSlot(timetable._id, 0, { venue: 'Room 303', hackerField: 'malicious' }, adminUser, 'test');

    expect(result.success).toBe(true);
    expect(result.slot.venue).toBe('Room 303');
    expect(result.slot.hackerField).toBeUndefined();
  });
});

describe('deleteSlot', () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    displayName: 'Admin Deleter',
  };

  test('deletes a slot at the given index', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [
        { time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' },
        { time: '10:00 AM', courseCode: 'CSE305', courseName: 'Networks', venue: 'R2', faculty: 'Prof. G' },
      ],
      uploadedBy: adminUser._id,
    });

    const result = await deleteSlot(timetable._id, 0, adminUser, 'Course cancelled');

    expect(result.success).toBe(true);
    expect(result.deletedSlot.courseCode).toBe('CSE301');

    // Verify only one slot remains
    const updated = await Timetable.findById(timetable._id);
    expect(updated.slots).toHaveLength(1);
    expect(updated.slots[0].courseCode).toBe('CSE305');
  });

  test('returns error for non-existent timetable', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await deleteSlot(fakeId, 0, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Timetable not found');
  });

  test('returns error for invalid slot index', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Friday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await deleteSlot(timetable._id, 3, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid slot index');
  });

  test('writes an audit log entry on deletion', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Thursday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    await deleteSlot(timetable._id, 0, adminUser, 'Slot no longer needed');

    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('delete');
    expect(logs[0].targetDay).toBe('Thursday');
    expect(logs[0].targetSlotIndex).toBe(0);
    expect(logs[0].reason).toBe('Slot no longer needed');
    expect(logs[0].changeDetails.deleted.courseCode).toBe('CSE301');
    expect(logs[0].performedByName).toBe('Admin Deleter');
  });

  test('handles negative slot index', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await deleteSlot(timetable._id, -1, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid slot index');
  });
});

describe('applyPermanentUpdate', () => {
  const adminUser = {
    _id: new mongoose.Types.ObjectId(),
    displayName: 'Admin Perm',
  };

  test('permanently updates a slot and sets lastPermanentUpdateAt/By', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Monday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'Room 101', faculty: 'Dr. Sharma' }],
      uploadedBy: adminUser._id,
    });

    const result = await applyPermanentUpdate(timetable._id, 0, { venue: 'Room 505', faculty: 'Prof. Mehta' }, adminUser, 'Permanent room change');

    expect(result.success).toBe(true);
    expect(result.slot.venue).toBe('Room 505');
    expect(result.slot.faculty).toBe('Prof. Mehta');
    expect(result.changes.venue).toEqual({ from: 'Room 101', to: 'Room 505' });
    expect(result.changes.faculty).toEqual({ from: 'Dr. Sharma', to: 'Prof. Mehta' });

    // Verify lastPermanentUpdateAt and lastPermanentUpdateBy are set
    const updated = await Timetable.findById(timetable._id);
    expect(updated.lastPermanentUpdateAt).toBeInstanceOf(Date);
    expect(updated.lastPermanentUpdateBy.toString()).toBe(adminUser._id.toString());
  });

  test('writes audit log with action override_perm', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Wednesday',
      slots: [{ time: '10:00 AM', courseCode: 'CSE305', courseName: 'Networks', venue: 'Room 201', faculty: 'Prof. G' }],
      uploadedBy: adminUser._id,
    });

    await applyPermanentUpdate(timetable._id, 0, { time: '11:00 AM' }, adminUser, 'Schedule restructure');

    const logs = await TimetableAuditLog.find({ batchId });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('override_perm');
    expect(logs[0].targetDay).toBe('Wednesday');
    expect(logs[0].targetSlotIndex).toBe(0);
    expect(logs[0].reason).toBe('Schedule restructure');
    expect(logs[0].changeDetails.time).toEqual({ from: '10:00 AM', to: '11:00 AM' });
    expect(logs[0].performedByName).toBe('Admin Perm');
  });

  test('returns error for non-existent timetable', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const result = await applyPermanentUpdate(fakeId, 0, { venue: 'X' }, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Timetable not found');
  });

  test('returns error for invalid slot index', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Friday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await applyPermanentUpdate(timetable._id, 5, { venue: 'X' }, adminUser, 'test');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid slot index');
  });

  test('only updates allowed fields', async () => {
    const batchId = new mongoose.Types.ObjectId();
    const timetable = await Timetable.create({
      batchId,
      dayOfWeek: 'Tuesday',
      slots: [{ time: '09:00 AM', courseCode: 'CSE301', courseName: 'DB', venue: 'R1', faculty: 'Dr. S' }],
      uploadedBy: adminUser._id,
    });

    const result = await applyPermanentUpdate(timetable._id, 0, { venue: 'Room 404', maliciousField: 'hack' }, adminUser, 'test');

    expect(result.success).toBe(true);
    expect(result.slot.venue).toBe('Room 404');
    expect(result.slot.maliciousField).toBeUndefined();
  });
});
