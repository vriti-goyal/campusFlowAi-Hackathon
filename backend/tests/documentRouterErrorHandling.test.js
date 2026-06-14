/**
 * documentRouterErrorHandling.test.js
 *
 * Tests error handling in DocumentIntelligenceRouter:
 * - AI failure fallback to heuristics
 * - Partial success reporting per category
 * - General Post fallback if all extractions fail
 */
import { jest } from '@jest/globals';

// Mock external infrastructure dependencies
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

// Mock service dependencies
jest.mock('../services/documentClassifier.js');
jest.mock('../services/courseFilter.js');
jest.mock('../services/documentExtractor.js');
jest.mock('../services/timetableManager.js');
jest.mock('../services/noticeDetector.js');
jest.mock('../services/reminderEngine.js');
jest.mock('../config/gemini.js');
jest.mock('../models/Timetable.js', () => ({ Timetable: {} }));
jest.mock('../models/ExamSchedule.js', () => ({ ExamSchedule: { create: jest.fn() } }));
jest.mock('../models/Assignment.js', () => ({ Assignment: { create: jest.fn() } }));
jest.mock('../models/Post.js', () => ({ Post: { create: jest.fn() } }));

import { classifyDocument } from '../services/documentClassifier.js';
import { filterByCourses } from '../services/courseFilter.js';
import { extractTimetableFromText, extractExamScheduleFromText, detectDocumentType } from '../services/documentExtractor.js';
import { checkTimetableDuplicate, createSlot, checkExamDuplicate } from '../services/timetableManager.js';
import { detectNotices } from '../services/noticeDetector.js';
import { detectAndCreateReminders } from '../services/reminderEngine.js';
import { invokeAI } from '../config/gemini.js';
import { routeDocument } from '../services/documentRouter.js';

describe('DocumentRouter Error Handling', () => {
  const baseParams = {
    text: 'Some document text for testing',
    userId: 'user123',
    batchId: 'batch123',
    fileUrl: 'https://example.com/file.pdf',
    user: { _id: 'user123', displayName: 'Test User' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    detectAndCreateReminders.mockResolvedValue({ remindersCreated: 0 });
  });

  describe('AI failure fallback to heuristics', () => {
    it('should fallback to detectDocumentType heuristic when classifyDocument throws', async () => {
      classifyDocument.mockRejectedValue(new Error('AI service unavailable'));
      detectDocumentType.mockReturnValue('general');

      const result = await routeDocument(baseParams);

      expect(result.success).toBe(true);
      expect(result.data.categories).toEqual(['general']);
      expect(result.data.routing.general).toBeDefined();
      expect(result.data.routing.general.status).toBe('fallback');
    });

    it('should route to specific category when heuristic detects a type after AI failure', async () => {
      classifyDocument.mockRejectedValue(new Error('AI service unavailable'));
      detectDocumentType.mockReturnValue('timetable');
      extractTimetableFromText.mockResolvedValue([
        { day: 'Monday', course_code: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' },
      ]);
      filterByCourses.mockResolvedValue({
        filtered: { timetable: [{ day: 'Monday', courseCode: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' }] },
        discardedCount: 0,
      });
      checkTimetableDuplicate.mockResolvedValue({ isDuplicate: false });
      createSlot.mockResolvedValue({ success: true });

      const result = await routeDocument(baseParams);

      expect(result.success).toBe(true);
      expect(result.data.categories).toEqual(['timetable']);
      expect(result.data.routing.timetable).toBeDefined();
      expect(result.data.routing.timetable.status).toBe('created');
    });
  });

  describe('Partial success reporting per category', () => {
    it('should set partialSuccess=true when some categories succeed and others fail', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable', 'exam_schedule'],
        confidence: { timetable: 0.9, exam_schedule: 0.8 },
      });

      // Timetable extraction succeeds
      extractTimetableFromText.mockResolvedValue([
        { day: 'Monday', course_code: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' },
      ]);
      // Exam extraction fails (returns null)
      extractExamScheduleFromText.mockResolvedValue(null);

      filterByCourses.mockResolvedValue({
        filtered: { timetable: [{ day: 'Monday', courseCode: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' }] },
        discardedCount: 0,
      });

      checkTimetableDuplicate.mockResolvedValue({ isDuplicate: false });
      createSlot.mockResolvedValue({ success: true });

      const result = await routeDocument(baseParams);

      expect(result.data.partialSuccess).toBe(true);
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors.exam_schedule).toBeDefined();
      expect(result.data.routing.timetable.status).not.toBe('failed');
      expect(result.data.routing.exam_schedule.status).toBe('failed');
    });

    it('should set partialSuccess=false when all categories succeed', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable'],
        confidence: { timetable: 0.9 },
      });

      extractTimetableFromText.mockResolvedValue([
        { day: 'Monday', course_code: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' },
      ]);

      filterByCourses.mockResolvedValue({
        filtered: { timetable: [{ day: 'Monday', courseCode: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' }] },
        discardedCount: 0,
      });

      checkTimetableDuplicate.mockResolvedValue({ isDuplicate: false });
      createSlot.mockResolvedValue({ success: true });

      const result = await routeDocument(baseParams);

      expect(result.data.partialSuccess).toBe(false);
      expect(result.data.errors).toBeNull();
    });

    it('should include per-category error messages in the errors object', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable', 'assignment'],
        confidence: { timetable: 0.9, assignment: 0.8 },
      });

      // Timetable succeeds
      extractTimetableFromText.mockResolvedValue([
        { day: 'Monday', course_code: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' },
      ]);
      // Assignment extraction returns empty (no title)
      invokeAI.mockResolvedValue('{}');

      filterByCourses.mockResolvedValue({
        filtered: { timetable: [{ day: 'Monday', courseCode: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' }] },
        discardedCount: 0,
      });

      checkTimetableDuplicate.mockResolvedValue({ isDuplicate: false });
      createSlot.mockResolvedValue({ success: true });

      const result = await routeDocument(baseParams);

      expect(result.data.partialSuccess).toBe(true);
      expect(result.data.errors).toHaveProperty('assignment');
    });
  });

  describe('General Post fallback if all extractions fail', () => {
    it('should set categories to ["general"] when all extractions fail', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable', 'assignment'],
        confidence: { timetable: 0.8, assignment: 0.7 },
      });

      // All extractions return nothing
      extractTimetableFromText.mockResolvedValue(null);
      invokeAI.mockResolvedValue('{}'); // Assignment extraction returns empty (no title)

      const result = await routeDocument(baseParams);

      expect(result.data.categories).toEqual(['general']);
      expect(result.data.routing.general).toBeDefined();
      expect(result.data.routing.general.status).toBe('fallback');
      expect(result.data.routing.general.message).toContain('All category extractions failed');
      expect(result.data.partialSuccess).toBe(false);
      expect(result.data.errors).toBeDefined();
    });

    it('should include extraction errors in errors object when all extractions fail', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['exam_schedule'],
        confidence: { exam_schedule: 0.9 },
      });

      extractExamScheduleFromText.mockRejectedValue(new Error('Network timeout'));

      const result = await routeDocument(baseParams);

      expect(result.data.categories).toEqual(['general']);
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors.exam_schedule).toBe('Network timeout');
    });

    it('should set categories to ["general"] when all module routing fails', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable', 'exam_schedule'],
        confidence: { timetable: 0.9, exam_schedule: 0.8 },
      });

      // Extractions succeed
      extractTimetableFromText.mockResolvedValue([
        { day: 'Monday', course_code: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' },
      ]);
      extractExamScheduleFromText.mockResolvedValue([
        { course_code: 'CSE101', exam_date: '2026-01-15', exam_time: '10:00', venue: 'Hall A' },
      ]);

      filterByCourses.mockResolvedValue({
        filtered: {
          timetable: [{ day: 'Monday', courseCode: 'CSE101', time: '09:00', courseName: 'Intro CS', venue: 'Room 101', faculty: 'Dr. A' }],
          exam_schedule: [{ courseCode: 'CSE101', exam_date: '2026-01-15', exam_time: '10:00', venue: 'Hall A' }],
        },
        discardedCount: 0,
      });

      // All routing throws errors
      checkTimetableDuplicate.mockRejectedValue(new Error('DB connection lost'));
      checkExamDuplicate.mockRejectedValue(new Error('DB connection lost'));

      const result = await routeDocument(baseParams);

      expect(result.data.categories).toEqual(['general']);
      expect(result.data.routing.general).toBeDefined();
      expect(result.data.routing.general.status).toBe('fallback');
      expect(result.data.routing.general.message).toContain('All module routing failed');
      expect(result.data.partialSuccess).toBe(false);
    });

    it('should report errors from both extraction and routing in errors object', async () => {
      classifyDocument.mockResolvedValue({
        categories: ['timetable', 'notice'],
        confidence: { timetable: 0.9, notice: 0.8 },
      });

      // Timetable extraction fails
      extractTimetableFromText.mockResolvedValue(null);
      // Notice extraction also fails
      detectNotices.mockResolvedValue(null);

      const result = await routeDocument(baseParams);

      expect(result.data.categories).toEqual(['general']);
      expect(result.data.errors).toBeDefined();
      expect(result.data.errors).toHaveProperty('timetable');
      expect(result.data.errors).toHaveProperty('notice');
    });
  });
});
