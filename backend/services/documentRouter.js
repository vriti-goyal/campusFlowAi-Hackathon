/**
 * documentRouter.js
 *
 * DocumentIntelligenceRouter — the central orchestrator for the
 * Academic Document Intelligence Engine.
 *
 * Flow: classify → filter → route to modules → create reminders → return enhanced response
 */
import { classifyDocument } from './documentClassifier.js';
import { filterByCourses } from './courseFilter.js';
import { extractTimetableFromText, extractExamScheduleFromText, detectDocumentType } from './documentExtractor.js';
import { createSlot, checkTimetableDuplicate, checkExamDuplicate, checkAssignmentDuplicate } from './timetableManager.js';
import { detectNotices, applyNoticeToTimetable } from './noticeDetector.js';
import { detectAndCreateReminders } from './reminderEngine.js';
import { invokeAI } from '../config/gemini.js';
import { Timetable } from '../models/Timetable.js';
import { ExamSchedule } from '../models/ExamSchedule.js';
import { Assignment } from '../models/Assignment.js';
import { Post } from '../models/Post.js';

// ── Helpers ─────────────────────────────────────────────────

function parseLLMJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    console.error('[DocumentRouter] JSON parse failed:', e.message, 'Raw (first 500):', raw.slice(0, 500));
    return null;
  }
}

// ── Assignment Extraction Prompt ────────────────────────────

const ASSIGNMENT_EXTRACTION_PROMPT = (text) => `You are an AI assistant for a college campus management system.

The following text was extracted from an ASSIGNMENT document.
Extract all assignment details and questions from it.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON. No explanation. Use this exact schema:
{
  "courseName": "Database Management",
  "courseCode": "CSE301",
  "title": "Assignment 3 - SQL Queries",
  "faculty": "Dr. Sharma",
  "dueDate": "2026-02-20T23:59:00.000Z",
  "instructions": "Complete all questions. Submit in PDF format.",
  "marksAllocation": "Total: 20 marks",
  "questions": [
    "Q1: Write a SQL query to find all students with CGPA > 8.0",
    "Q2: Design an ER diagram for a library management system"
  ]
}

Rules:
- "courseCode": Create from abbreviation if not explicitly stated
- "dueDate": ISO 8601 format. null if not mentioned
- "questions": Extract ALL questions/tasks as individual strings
- "instructions": Any submission guidelines, format requirements
- "marksAllocation": Marks breakdown if mentioned, empty string if not
- "faculty": Professor name if mentioned, empty string if not`;

// ── Assignment Extraction ───────────────────────────────────

/**
 * Extract assignment data from text using AI.
 * @param {string} text - Extracted text
 * @returns {Promise<object|null>} Assignment data or null on failure
 */
async function extractAssignmentFromText(text) {
  console.log('[DocumentRouter] Extracting assignment from text, length:', text.length);

  try {
    const response = await invokeAI(ASSIGNMENT_EXTRACTION_PROMPT(text), 2048);
    const parsed = parseLLMJSON(response);

    if (!parsed) {
      console.error('[DocumentRouter] Assignment extraction returned invalid data');
      return null;
    }

    return {
      courseCode: (parsed.courseCode || '').trim().toUpperCase(),
      courseName: (parsed.courseName || '').trim(),
      title: (parsed.title || '').trim(),
      faculty: (parsed.faculty || '').trim(),
      dueDate: parsed.dueDate || null,
      instructions: (parsed.instructions || '').trim(),
      marksAllocation: (parsed.marksAllocation || '').trim(),
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
    };
  } catch (err) {
    console.error('[DocumentRouter] Assignment extraction failed:', err.message);
    return null;
  }
}

// ── Main Router Function ────────────────────────────────────

/**
 * Route a document through the intelligence pipeline.
 *
 * @param {object} params
 * @param {string} params.text - OCR-extracted text
 * @param {string} params.userId - Uploading user's ObjectId
 * @param {string} params.batchId - Target batch ObjectId
 * @param {string} [params.fileUrl] - S3 file URL (if file upload)
 * @param {object} [params.user] - User object { _id, displayName, name }
 * @returns {Promise<object>} Enhanced response shape
 */
export async function routeDocument({ text, userId, batchId, fileUrl = '', user = {} }) {
  console.log('[DocumentRouter] Starting document routing for batch:', batchId);

  const result = {
    success: true,
    data: {
      categories: [],
      routing: {},
      skipped: [],
      remindersCreated: 0,
      fileUrl,
      courseFilterApplied: false,
      filteredOutCount: 0,
      partialSuccess: false,
      errors: null,
    },
  };

  // ── Step 1: Classify the document ──
  let classification;
  try {
    classification = await classifyDocument(text);
  } catch (err) {
    console.error('[DocumentRouter] Classification failed, falling back to heuristic:', err.message);
    // Fallback to keyword heuristic
    const heuristicType = detectDocumentType(text);
    classification = {
      categories: heuristicType === 'general' ? ['general'] : [heuristicType],
      confidence: {},
    };
  }

  const { categories } = classification;
  result.data.categories = categories;

  console.log('[DocumentRouter] Classified categories:', categories);

  // If the only category is "general", create a Post and return early
  if (categories.length === 1 && categories[0] === 'general') {
    result.data.routing.general = { status: 'fallback', message: 'No specific document type detected' };
    return result;
  }

  // ── Step 2: Extract data per category ──
  const extractedData = {};
  const extractionErrors = {};

  for (const category of categories) {
    try {
      switch (category) {
        case 'timetable': {
          const timetableData = await extractTimetableFromText(text);
          if (timetableData && timetableData.length > 0) {
            // Normalize to include courseCode field for filtering
            extractedData.timetable = timetableData.map((entry) => ({
              ...entry,
              courseCode: entry.course_code || entry.courseCode || '',
            }));
          } else {
            extractionErrors.timetable = 'No timetable entries extracted';
          }
          break;
        }
        case 'exam_schedule': {
          const examData = await extractExamScheduleFromText(text);
          if (examData && examData.length > 0) {
            extractedData.exam_schedule = examData.map((entry) => ({
              ...entry,
              courseCode: entry.course_code || entry.courseCode || '',
            }));
          } else {
            extractionErrors.exam_schedule = 'No exam schedule entries extracted';
          }
          break;
        }
        case 'assignment': {
          const assignmentData = await extractAssignmentFromText(text);
          if (assignmentData && assignmentData.title) {
            // Wrap in array for consistent filtering
            extractedData.assignment = [assignmentData];
          } else {
            extractionErrors.assignment = 'No assignment data extracted';
          }
          break;
        }
        case 'notice': {
          const noticeResult = await detectNotices(text);
          if (noticeResult && noticeResult.notices && noticeResult.notices.length > 0) {
            extractedData.notice = noticeResult.notices;
          } else {
            extractionErrors.notice = 'No notices detected';
          }
          break;
        }
        default:
          console.warn('[DocumentRouter] Unknown category:', category);
      }
    } catch (err) {
      console.error(`[DocumentRouter] Extraction failed for category "${category}":`, err.message);
      extractionErrors[category] = err.message;
    }
  }

  // If all extractions failed → fallback to general
  if (Object.keys(extractedData).length === 0) {
    console.warn('[DocumentRouter] All extractions failed, falling back to general');
    result.data.categories = ['general'];
    result.data.partialSuccess = false;
    result.data.errors = { ...extractionErrors };
    result.data.routing.general = {
      status: 'fallback',
      message: 'All category extractions failed',
      errors: extractionErrors,
    };
    return result;
  }

  // ── Step 3: Apply course filter ──
  let filteredData = extractedData;
  try {
    const filterResult = await filterByCourses(userId, batchId, extractedData);
    filteredData = filterResult.filtered;
    result.data.courseFilterApplied = true;
    result.data.filteredOutCount = filterResult.discardedCount;
  } catch (err) {
    console.error('[DocumentRouter] Course filter failed, proceeding unfiltered:', err.message);
    // Continue with unfiltered data
  }

  // ── Step 4: Route to modules ──
  const userName = user.displayName || user.name || 'Unknown';
  const adminUser = { _id: userId, displayName: userName, name: userName };

  // Track items for reminder creation
  const createdAssignments = [];
  const createdExams = [];
  const appliedNotices = [];

  // --- Timetable Module ---
  if (filteredData.timetable && filteredData.timetable.length > 0) {
    try {
      const timetableResult = await handleTimetableRouting(filteredData.timetable, batchId, adminUser);
      result.data.routing.timetable = timetableResult;
      if (timetableResult.skipped && timetableResult.skipped.length > 0) {
        result.data.skipped.push(...timetableResult.skipped.map((s) => ({ category: 'timetable', ...s })));
      }
    } catch (err) {
      console.error('[DocumentRouter] Timetable routing failed:', err.message);
      result.data.routing.timetable = { status: 'failed', error: err.message };
    }
  } else if (categories.includes('timetable')) {
    result.data.routing.timetable = {
      status: 'failed',
      error: extractionErrors.timetable || 'No data after filtering',
    };
  }

  // --- Exam Schedule Module ---
  if (filteredData.exam_schedule && filteredData.exam_schedule.length > 0) {
    try {
      const examResult = await handleExamRouting(filteredData.exam_schedule, batchId, userId);
      result.data.routing.exam_schedule = examResult;
      if (examResult.created && examResult.created.length > 0) {
        createdExams.push(...examResult.created);
      }
      if (examResult.skipped && examResult.skipped.length > 0) {
        result.data.skipped.push(...examResult.skipped.map((s) => ({ category: 'exam_schedule', ...s })));
      }
    } catch (err) {
      console.error('[DocumentRouter] Exam routing failed:', err.message);
      result.data.routing.exam_schedule = { status: 'failed', error: err.message };
    }
  } else if (categories.includes('exam_schedule')) {
    result.data.routing.exam_schedule = {
      status: 'failed',
      error: extractionErrors.exam_schedule || 'No data after filtering',
    };
  }

  // --- Assignment Module ---
  if (filteredData.assignment && filteredData.assignment.length > 0) {
    try {
      const assignmentResult = await handleAssignmentRouting(filteredData.assignment, batchId, userId, fileUrl);
      result.data.routing.assignment = assignmentResult;
      if (assignmentResult.created && assignmentResult.created.length > 0) {
        createdAssignments.push(...assignmentResult.created);
      }
      if (assignmentResult.skipped && assignmentResult.skipped.length > 0) {
        result.data.skipped.push(...assignmentResult.skipped.map((s) => ({ category: 'assignment', ...s })));
      }
    } catch (err) {
      console.error('[DocumentRouter] Assignment routing failed:', err.message);
      result.data.routing.assignment = { status: 'failed', error: err.message };
    }
  } else if (categories.includes('assignment')) {
    result.data.routing.assignment = {
      status: 'failed',
      error: extractionErrors.assignment || 'No data after filtering',
    };
  }

  // --- Notice Module ---
  if (filteredData.notice && filteredData.notice.length > 0) {
    try {
      const noticeResult = await handleNoticeRouting(filteredData.notice, batchId, userId, userName);
      result.data.routing.notice = noticeResult;
      if (noticeResult.notices) {
        appliedNotices.push(...noticeResult.notices);
      }
    } catch (err) {
      console.error('[DocumentRouter] Notice routing failed:', err.message);
      result.data.routing.notice = { status: 'failed', error: err.message };
    }
  } else if (categories.includes('notice')) {
    result.data.routing.notice = {
      status: 'failed',
      error: extractionErrors.notice || 'No data after filtering',
    };
  }

  // ── Step 5: Create reminders for deadlines ──
  try {
    const reminderResult = await detectAndCreateReminders({
      batchId,
      assignments: createdAssignments,
      exams: createdExams,
      notices: appliedNotices,
    });
    result.data.remindersCreated = reminderResult.remindersCreated;
  } catch (err) {
    console.error('[DocumentRouter] Reminder creation failed:', err.message);
    // Non-fatal — continue
  }

  // ── Step 6: Compute partial success and per-category error summary ──
  const routingEntries = Object.entries(result.data.routing);
  const failedCategories = routingEntries.filter(([, r]) => r.status === 'failed');
  const succeededCategories = routingEntries.filter(([, r]) => r.status !== 'failed');
  const allFailed = routingEntries.length > 0 && succeededCategories.length === 0;

  // Add partialSuccess indicator: true when some categories succeeded and others failed
  result.data.partialSuccess = failedCategories.length > 0 && succeededCategories.length > 0;

  // Add per-category error summary
  if (failedCategories.length > 0) {
    result.data.errors = {};
    for (const [cat, info] of failedCategories) {
      result.data.errors[cat] = info.error || extractionErrors[cat] || 'Unknown error';
    }
  }

  // If ALL routing failed → fallback to general Post creation
  if (allFailed) {
    console.warn('[DocumentRouter] All module routing failed, falling back to general post');
    result.data.categories = ['general'];
    result.data.partialSuccess = false;
    result.data.routing.general = {
      status: 'fallback',
      message: 'All module routing failed, document stored as general post',
      errors: extractionErrors,
    };
  }

  console.log('[DocumentRouter] Routing complete. Categories:', result.data.categories, 'Reminders:', result.data.remindersCreated);
  return result;
}

// ── Module Handlers ─────────────────────────────────────────

/**
 * Handle timetable creation from extracted entries.
 * Groups by day, checks duplicates, and creates/updates timetable documents.
 */
async function handleTimetableRouting(entries, batchId, adminUser) {
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const skipped = [];
  let totalSlotsCreated = 0;
  const updatedDaysSet = new Set();

  for (const entry of entries) {
    const rawDay = entry.day?.trim() || '';
    const dayOfWeek = validDays.find((d) => d.toLowerCase() === rawDay.toLowerCase());

    if (!dayOfWeek) {
      skipped.push({ reason: 'Invalid day', entry: { courseCode: entry.courseCode, day: entry.day } });
      continue;
    }

    const courseCode = (entry.course_code || entry.courseCode || '').trim().toUpperCase();
    const time = (entry.time || '').trim();

    if (!courseCode || !time) {
      skipped.push({ reason: 'Missing courseCode or time', entry: { courseCode, time } });
      continue;
    }

    // Check duplicate
    const dupCheck = await checkTimetableDuplicate(batchId, dayOfWeek, courseCode, time);
    if (dupCheck.isDuplicate) {
      skipped.push({ reason: 'Duplicate', courseCode, time, dayOfWeek });
      continue;
    }

    // Create the slot
    const slot = {
      time,
      courseCode,
      courseName: (entry.course_name || entry.courseName || '').trim(),
      venue: (entry.venue || '').trim(),
      faculty: (entry.faculty || '').trim(),
    };

    const createResult = await createSlot(batchId, dayOfWeek, slot, adminUser);

    if (createResult.success) {
      totalSlotsCreated++;
      updatedDaysSet.add(dayOfWeek);
    } else if (createResult.skipped) {
      skipped.push({ reason: createResult.reason || 'Duplicate', courseCode, time, dayOfWeek });
    }
  }

  return {
    status: totalSlotsCreated > 0 ? 'created' : 'no_new_entries',
    updatedDays: updatedDaysSet.size,
    totalSlots: totalSlotsCreated,
    skipped,
  };
}

/**
 * Handle exam schedule creation from extracted entries.
 * Checks duplicates and inserts new ExamSchedule documents.
 */
async function handleExamRouting(entries, batchId, userId) {
  const skipped = [];
  const created = [];

  for (const entry of entries) {
    const courseCode = (entry.course_code || entry.courseCode || '').trim().toUpperCase();
    const rawDate = (entry.exam_date || entry.examDate || '').trim();

    if (!courseCode || !rawDate) {
      skipped.push({ reason: 'Missing courseCode or examDate', entry: { courseCode, rawDate } });
      continue;
    }

    const examDate = new Date(rawDate);
    if (isNaN(examDate.getTime())) {
      skipped.push({ reason: 'Invalid date', courseCode, rawDate });
      continue;
    }

    // Check duplicate
    const dupCheck = await checkExamDuplicate(batchId, courseCode, examDate);
    if (dupCheck.isDuplicate) {
      skipped.push({ reason: 'Duplicate', courseCode, examDate: rawDate });
      continue;
    }

    // Create ExamSchedule document
    const examDoc = await ExamSchedule.create({
      batchId,
      courseCode,
      courseName: (entry.course_name || entry.courseName || '').trim(),
      examDate,
      examTime: (entry.exam_time || entry.examTime || '').trim(),
      venue: (entry.venue || '').trim(),
      examType: 'Other',
      uploadedBy: userId,
      uploadedAt: new Date(),
    });

    created.push({
      _id: examDoc._id,
      courseCode: examDoc.courseCode,
      courseName: examDoc.courseName,
      examDate: examDoc.examDate,
      examTime: examDoc.examTime,
    });
  }

  return {
    status: created.length > 0 ? 'created' : 'no_new_entries',
    inserted: created.length,
    created,
    skipped,
  };
}

/**
 * Handle assignment creation from extracted data.
 * Checks duplicate by batchId + courseCode + title, then creates Assignment document.
 */
async function handleAssignmentRouting(entries, batchId, userId, fileUrl) {
  const skipped = [];
  const created = [];

  for (const entry of entries) {
    const courseCode = (entry.courseCode || '').trim().toUpperCase();
    const title = (entry.title || '').trim();

    if (!title) {
      skipped.push({ reason: 'Missing title', entry: { courseCode } });
      continue;
    }

    // Check duplicate
    if (courseCode && title) {
      const dupCheck = await checkAssignmentDuplicate(batchId, courseCode, title);
      if (dupCheck.isDuplicate) {
        skipped.push({ reason: 'Duplicate', courseCode, title });
        continue;
      }
    }

    // Determine deadline
    let deadline = null;
    let deadlineUnknown = true;
    if (entry.dueDate) {
      const parsedDate = new Date(entry.dueDate);
      if (!isNaN(parsedDate.getTime())) {
        deadline = parsedDate;
        deadlineUnknown = false;
      }
    }

    // Create Assignment document
    const assignmentDoc = await Assignment.create({
      userId,
      batchId,
      title,
      subject: courseCode,
      deadline,
      deadlineUnknown,
      questions: entry.questions || [],
      instructions: entry.instructions || '',
      marksAllocation: entry.marksAllocation || '',
      faculty: entry.faculty || '',
      fileUrl: fileUrl || '',
      extractedFrom: fileUrl || '',
      status: 'Not Started',
      priorityLevel: deadline ? 'medium' : 'low',
    });

    created.push({
      _id: assignmentDoc._id,
      referenceId: assignmentDoc._id,
      title: assignmentDoc.title,
      subject: assignmentDoc.subject,
      deadline: assignmentDoc.deadline,
      deadlineUnknown: assignmentDoc.deadlineUnknown,
    });
  }

  return {
    status: created.length > 0 ? 'created' : 'no_new_entries',
    assignmentId: created.length > 0 ? created[0]._id : null,
    assignmentCount: created.length,
    created,
    skipped,
  };
}

/**
 * Handle notice detection and timetable application.
 * Applies detected notices to the timetable via NoticeDetector's applyNoticeToTimetable.
 */
async function handleNoticeRouting(notices, batchId, userId, userName) {
  const applyResult = await applyNoticeToTimetable(notices, batchId, userId, userName);

  return {
    status: applyResult.applied > 0 ? 'applied' : 'no_changes',
    applied: applyResult.applied,
    skipped: applyResult.skipped,
    notificationsSent: applyResult.notificationsSent,
    errors: applyResult.errors,
    notices, // Pass through for reminder creation
  };
}
