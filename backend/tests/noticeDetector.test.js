/**
 * NoticeDetector Service — Unit Tests
 *
 * Tests the detectNotices function covering:
 * - Determination validation (temporary, permanent, unknown)
 * - isPermanent boolean derivation
 * - flaggedForReview logic for unknown/invalid determinations
 * - Type validation for notice types
 * - Default to temporary when determination is unknown
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

// Mock the Gemini AI config
jest.mock('../config/gemini.js', () => ({
  invokeAI: jest.fn(),
}));

import { detectNotices } from '../services/noticeDetector.js';
import { invokeAI } from '../config/gemini.js';

describe('detectNotices — determination parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('temporary determination: isPermanent=false, flaggedForReview=false', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'cancelled',
        courseCode: 'CSE301',
        courseName: 'Database Management',
        affectedDate: '2026-02-15',
        originalTime: '09:00 AM',
        newTime: '',
        newVenue: '',
        newFaculty: '',
        determination: 'temporary',
        reason: 'Faculty on leave',
      }],
    }));

    const result = await detectNotices('Class cancelled for CSE301 on 15 Feb');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.determination).toBe('temporary');
    expect(notice.isPermanent).toBe(false);
    expect(notice.flaggedForReview).toBe(false);
  });

  test('permanent determination: isPermanent=true, flaggedForReview=false', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'room_changed',
        courseCode: 'CSE305',
        courseName: 'Computer Networks',
        affectedDate: '2026-02-20',
        originalTime: '10:00 AM',
        newTime: '',
        newVenue: 'Room 301',
        newFaculty: '',
        determination: 'permanent',
        reason: 'Permanent room reallocation',
      }],
    }));

    const result = await detectNotices('CSE305 permanently moved to Room 301');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.determination).toBe('permanent');
    expect(notice.isPermanent).toBe(true);
    expect(notice.flaggedForReview).toBe(false);
  });

  test('unknown determination: defaults to temporary, isPermanent=false, flaggedForReview=true', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'rescheduled',
        courseCode: 'CSE301',
        courseName: 'Database Management',
        affectedDate: '2026-02-18',
        originalTime: '09:00 AM',
        newTime: '11:00 AM',
        newVenue: '',
        newFaculty: '',
        determination: 'unknown',
        reason: 'Schedule change',
      }],
    }));

    const result = await detectNotices('CSE301 rescheduled to 11 AM');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.determination).toBe('temporary');
    expect(notice.isPermanent).toBe(false);
    expect(notice.flaggedForReview).toBe(true);
  });

  test('missing determination: treated as unknown → defaults to temporary, flaggedForReview=true', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'cancelled',
        courseCode: 'CSE301',
        courseName: 'Database Management',
        affectedDate: '2026-02-15',
        originalTime: '09:00 AM',
        newTime: '',
        newVenue: '',
        newFaculty: '',
        // determination is missing
        reason: 'No reason given',
      }],
    }));

    const result = await detectNotices('CSE301 class change notice');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.determination).toBe('temporary');
    expect(notice.isPermanent).toBe(false);
    expect(notice.flaggedForReview).toBe(true);
  });

  test('invalid determination value: normalized to unknown → defaults to temporary, flaggedForReview=true', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'faculty_changed',
        courseCode: 'CSE305',
        courseName: 'Computer Networks',
        affectedDate: '2026-03-01',
        originalTime: '10:00 AM',
        newTime: '',
        newVenue: '',
        newFaculty: 'Dr. Kumar',
        determination: 'maybe_permanent',  // invalid value
        reason: 'Faculty reassignment',
      }],
    }));

    const result = await detectNotices('CSE305 faculty changed');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.determination).toBe('temporary');
    expect(notice.isPermanent).toBe(false);
    expect(notice.flaggedForReview).toBe(true);
  });

  test('invalid type value: defaults to cancelled', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [{
        type: 'postponed',  // invalid type
        courseCode: 'CSE301',
        courseName: 'Database Management',
        affectedDate: '2026-02-15',
        originalTime: '09:00 AM',
        newTime: '',
        newVenue: '',
        newFaculty: '',
        determination: 'temporary',
        reason: 'Postponed',
      }],
    }));

    const result = await detectNotices('CSE301 class postponed');

    expect(result.notices).toHaveLength(1);
    const notice = result.notices[0];
    expect(notice.type).toBe('cancelled');
  });

  test('valid type values are preserved', async () => {
    invokeAI.mockResolvedValue(JSON.stringify({
      notices: [
        { type: 'cancelled', courseCode: 'A', determination: 'temporary', affectedDate: '2026-01-01' },
        { type: 'rescheduled', courseCode: 'B', determination: 'temporary', affectedDate: '2026-01-02' },
        { type: 'room_changed', courseCode: 'C', determination: 'permanent', affectedDate: '2026-01-03' },
        { type: 'faculty_changed', courseCode: 'D', determination: 'permanent', affectedDate: '2026-01-04' },
      ],
    }));

    const result = await detectNotices('Multiple notices');

    expect(result.notices).toHaveLength(4);
    expect(result.notices[0].type).toBe('cancelled');
    expect(result.notices[1].type).toBe('rescheduled');
    expect(result.notices[2].type).toBe('room_changed');
    expect(result.notices[3].type).toBe('faculty_changed');
  });

  test('empty text returns empty notices array', async () => {
    const result = await detectNotices('');
    expect(result.notices).toHaveLength(0);
    expect(invokeAI).not.toHaveBeenCalled();
  });

  test('whitespace-only text returns empty notices array', async () => {
    const result = await detectNotices('   \n  ');
    expect(result.notices).toHaveLength(0);
    expect(invokeAI).not.toHaveBeenCalled();
  });

  test('AI response with markdown code fences is parsed correctly', async () => {
    invokeAI.mockResolvedValue('```json\n' + JSON.stringify({
      notices: [{
        type: 'cancelled',
        courseCode: 'CSE301',
        courseName: 'Database Management',
        affectedDate: '2026-02-15',
        originalTime: '09:00 AM',
        determination: 'permanent',
        reason: 'Course discontinued',
      }],
    }) + '\n```');

    const result = await detectNotices('CSE301 discontinued permanently');

    expect(result.notices).toHaveLength(1);
    expect(result.notices[0].determination).toBe('permanent');
    expect(result.notices[0].isPermanent).toBe(true);
  });

  test('AI failure returns empty notices after retries', async () => {
    invokeAI.mockRejectedValue(new Error('API timeout'));

    const result = await detectNotices('Some notice text');

    expect(result.notices).toHaveLength(0);
    // Should have been called twice (initial + 1 retry)
    expect(invokeAI).toHaveBeenCalledTimes(2);
  });
});
