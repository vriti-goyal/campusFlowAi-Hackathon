/**
 * documentExtractor.js
 *
 * Shared AI service that takes raw text (extracted from PDF via Textract)
 * and uses Bedrock to parse it into structured timetable or exam schedule data.
 */
import { invokeAI } from '../config/gemini.js';

// ── Helpers ─────────────────────────────────────────────────

function parseLLMJSON(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Try to find a JSON array or object in the response
    const arrMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (arrMatch) {
      try { return JSON.parse(arrMatch[0]); } catch {}
    }
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    console.error('[DocumentExtractor] JSON parse failed:', e.message, 'Raw (first 500):', raw.slice(0, 500));
    return null;
  }
}

// ── Timetable Extraction ────────────────────────────────────

const TIMETABLE_PROMPT = (text) => `You are an AI assistant for a college management system.

The following text was extracted from a TIMETABLE PDF document (class schedule).
Extract the weekly class schedule from it.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON. No explanation. Use this exact schema:
[
  {
    "day": "Monday",
    "time": "09:00 AM",
    "course_code": "CSE301",
    "course_name": "Database Management",
    "venue": "Room 101",
    "faculty": "Dr. Sharma",
    "class_type": "Theory"
  }
]

Rules:
- "day" must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- "time" should be in human-readable format like "09:00 AM" or "9:00-10:00"
- "course_code" is required — if not in text, create from subject abbreviation (e.g. "MATH" for Mathematics)
- "course_name" is the full subject/course name
- "venue" is the room/hall if mentioned, empty string if not
- "faculty" is the professor/teacher name if mentioned, empty string if not
- "class_type" must be one of: Theory, Lab, Tutorial, Other. Default to Theory if unsure.
- Include ALL slots you can find in the text
- Return an empty array [] if you cannot identify any timetable entries`;

/**
 * Extract timetable slots from raw text using AI.
 * @param {string} text - Raw text extracted from PDF
 * @returns {Promise<Array>} Array of { day, time, course_code, course_name, venue, faculty }
 */
export async function extractTimetableFromText(text) {
  console.log('[DocumentExtractor] Extracting timetable from text, length:', text.length);

  const response = await invokeAI(TIMETABLE_PROMPT(text), 2048);
  const parsed = parseLLMJSON(response);

  if (!parsed || !Array.isArray(parsed)) {
    console.error('[DocumentExtractor] Timetable extraction returned invalid data');
    return [];
  }

  // Normalize and validate
  const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return parsed
    .filter(r => r.day && r.time && r.course_code)
    .map(r => ({
      day: validDays.find(d => d.toLowerCase() === r.day.toLowerCase()) || r.day,
      time: r.time.trim(),
      course_code: r.course_code.trim().toUpperCase(),
      course_name: r.course_name?.trim() || '',
      venue: r.venue?.trim() || '',
      faculty: r.faculty?.trim() || '',
      classType: r.class_type?.trim() || 'Theory',
    }));
}

// ── Exam Schedule Extraction ────────────────────────────────

const EXAM_SCHEDULE_PROMPT = (text) => `You are an AI assistant for a college management system.

The following text was extracted from an EXAM SCHEDULE PDF document.
Extract the exam schedule from it.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON. No explanation. Use this exact schema:
[
  {
    "course_code": "CSE301",
    "course_name": "Database Management",
    "exam_date": "2026-07-15",
    "exam_time": "10:00 AM",
    "venue": "Hall A"
  }
]

Rules:
- "course_code" is required — if not in text, create from subject abbreviation
- "course_name" is the full subject name
- "exam_date" MUST be in YYYY-MM-DD format. If year is not mentioned, use 2026
- "exam_time" in human-readable format, empty string if not mentioned
- "venue" is the room/hall, empty string if not mentioned
- Include ALL exams you can find in the text
- Return an empty array [] if you cannot identify any exam entries`;

/**
 * Extract exam schedule entries from raw text using AI.
 * @param {string} text - Raw text extracted from PDF
 * @returns {Promise<Array>} Array of { course_code, course_name, exam_date, exam_time, venue }
 */
export async function extractExamScheduleFromText(text) {
  console.log('[DocumentExtractor] Extracting exam schedule from text, length:', text.length);

  const response = await invokeAI(EXAM_SCHEDULE_PROMPT(text), 2048);
  const parsed = parseLLMJSON(response);

  if (!parsed || !Array.isArray(parsed)) {
    console.error('[DocumentExtractor] Exam schedule extraction returned invalid data');
    return [];
  }

  // Validate and normalize
  return parsed
    .filter(r => r.course_code && r.exam_date)
    .map(r => ({
      course_code: r.course_code.trim().toUpperCase(),
      course_name: r.course_name?.trim() || '',
      exam_date: r.exam_date.trim(),
      exam_time: r.exam_time?.trim() || '',
      venue: r.venue?.trim() || '',
    }));
}

// ── Auto-detect document type ───────────────────────────────

/**
 * Detect if text is a timetable, exam schedule, or general notice.
 * Uses keyword heuristics (no AI call needed).
 * @param {string} text
 * @returns {'timetable' | 'exam_schedule' | 'general'}
 */
export function detectDocumentType(text) {
  const lower = text.toLowerCase();

  // Timetable Update indicators
  const updateKeywords = ['class cancelled', 'class reschedule', 'room change', 'faculty change', 'postponed', 'preponed', 'class suspended', 'timetable change'];
  if (updateKeywords.some(k => lower.includes(k))) return 'timetable_update';

  // Timetable indicators
  const ttKeywords = ['timetable', 'time table', 'class schedule', 'weekly schedule', 'period', 'lecture schedule'];
  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const hasTTKeyword = ttKeywords.some(k => lower.includes(k));
  const dayCount = dayNames.filter(d => lower.includes(d)).length;

  // Exam schedule indicators
  const examKeywords = ['exam schedule', 'examination schedule', 'date sheet', 'datesheet', 'exam timetable', 'end term', 'end-term', 'mid term', 'mid-term', 'semester exam'];
  const hasExamKeyword = examKeywords.some(k => lower.includes(k));

  if (hasExamKeyword) return 'exam_schedule';
  if (hasTTKeyword || dayCount >= 3) return 'timetable';

  return 'general';
}

// ── Timetable Update Extraction ─────────────────────────────

const TIMETABLE_UPDATE_PROMPT = (text) => `You are an AI assistant for a college management system.

The following text was extracted from a notice document regarding class schedule updates.
Extract the details of the timetable change.

TEXT:
"""
${text.slice(0, 6000)}
"""

Return ONLY valid JSON as an array. No explanation. Use this exact schema:
[
  {
    "course_code": "CSE301",
    "course_name": "Database Management",
    "date": "2026-06-15",
    "original_time": "09:00 AM",
    "change_type": "temporary", 
    "override_type": "cancelled",
    "new_details": {
      "time": "",
      "venue": "",
      "faculty": ""
    },
    "reason": "Faculty on leave"
  }
]

Rules:
- "course_code" is required.
- "date" MUST be in YYYY-MM-DD format (infer year/month if missing, assume current year is 2026).
- "change_type" must be either "temporary" (applies to a single date) or "permanent" (applies to all future dates). If unsure, default to "temporary".
- "override_type" must be one of: "rescheduled", "cancelled", "room_changed", "faculty_changed".
- "new_details" should contain updated info if applicable (e.g., new time for reschedule, new venue for room_changed). Leave empty string if not applicable.
- "reason" is the justification provided in the text.
- Include ALL updates you can find in the text. Return [] if none.`;

export async function extractTimetableUpdateFromText(text) {
  console.log('[DocumentExtractor] Extracting timetable update from text, length:', text.length);

  const response = await invokeAI(TIMETABLE_UPDATE_PROMPT(text), 2048);
  const parsed = parseLLMJSON(response);

  if (!parsed || !Array.isArray(parsed)) {
    console.error('[DocumentExtractor] Timetable update extraction returned invalid data');
    return [];
  }

  return parsed
    .filter(r => r.course_code && r.date && r.override_type)
    .map(r => ({
      course_code: r.course_code.trim().toUpperCase(),
      course_name: r.course_name?.trim() || '',
      date: r.date.trim(),
      original_time: r.original_time?.trim() || '',
      change_type: ['temporary', 'permanent'].includes(r.change_type) ? r.change_type : 'temporary',
      override_type: r.override_type,
      new_details: {
        time: r.new_details?.time?.trim() || '',
        venue: r.new_details?.venue?.trim() || '',
        faculty: r.new_details?.faculty?.trim() || '',
      },
      reason: r.reason?.trim() || ''
    }));
}
