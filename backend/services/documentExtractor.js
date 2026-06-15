import { invokeAI } from '../config/gemini.js';

// ── Document Type Detection ──────────────────────────────────────────

/**
 * detectDocumentType — keyword-based fast classification
 * Returns: 'timetable' | 'timetable_update' | 'exam_schedule' |
 *          'assignment' | 'placement' | 'general'
 */
export function detectDocumentType(text) {
  const lower = text.toLowerCase();

  // Timetable update keywords (check before timetable)
  const timetableUpdateKeywords = [
    'class cancelled', 'class suspended', 'rescheduled', 'extra class',
    'makeup class', 'postponed', 'class shifted', 'venue change',
    'time change', 'faculty change', 'holiday notice', 'no class'
  ];
  if (timetableUpdateKeywords.some(k => lower.includes(k))) {
    return 'timetable_update';
  }

  // Timetable keywords
  const timetableKeywords = [
    'timetable', 'time table', 'class schedule', 'lecture schedule',
    'weekly schedule', 'course schedule', 'monday', 'tuesday',
    'wednesday', 'thursday', 'friday', 'slot', 'period'
  ];
  const timetableScore = timetableKeywords.filter(k => lower.includes(k)).length;

  // Exam schedule keywords
  const examKeywords = [
    'exam', 'examination', 'end term', 'mid term', 'midterm', 'end-term',
    'internal assessment', 'test schedule', 'date sheet', 'hall ticket',
    'seating arrangement', 'exam schedule', 'exam date'
  ];
  const examScore = examKeywords.filter(k => lower.includes(k)).length;

  // Assignment keywords
  const assignmentKeywords = [
    'assignment', 'submit', 'submission', 'homework', 'lab record',
    'project submission', 'report submission', 'due date', 'upload on',
    'submit on', 'submit before', 'deadline'
  ];
  const assignmentScore = assignmentKeywords.filter(k => lower.includes(k)).length;

  // Placement keywords
  const placementKeywords = [
    'placement', 'hiring', 'recruitment', 'campus drive', 'job offer',
    'package', 'ctc', 'lpa', 'stipend', 'internship', 'company',
    'cgpa criteria', 'eligible branches', 'apply now', 'registration link'
  ];
  const placementScore = placementKeywords.filter(k => lower.includes(k)).length;

  // Return highest scoring category
  const scores = {
    timetable: timetableScore,
    exam_schedule: examScore,
    assignment: assignmentScore,
    placement: placementScore,
  };

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) return 'general';

  // Require minimum 2 keyword matches to confidently classify
  if (maxScore < 2) return 'general';

  return Object.keys(scores).find(k => scores[k] === maxScore);
}

// ── Timetable Extraction ─────────────────────────────────────────────

export async function extractTimetableFromText(text) {
  const prompt = `You are extracting a weekly class timetable from text.

TEXT:
"""
${text.slice(0, 3000)}
"""

Return ONLY a valid JSON array of class slots. No markdown, no explanation.
Each slot must have these exact fields:
[
  {
    "day": "Monday",
    "time": "9:00 AM - 10:00 AM",
    "course_code": "CS301",
    "course_name": "Data Structures",
    "venue": "Room 204",
    "faculty": "Dr. Smith",
    "class_type": "Theory"
  }
]

Rules:
- "day" must be full day name: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday
- "time" should be a time range string
- "course_code" and "course_name" are required — if course code is missing use a short abbreviation from the name
- "venue" and "faculty" can be empty string if not mentioned
- "class_type" must be one of: Theory, Lab, Tutorial, Other. Default to Theory if unsure.
- Include ALL class slots found — do not skip any
- If the same course appears multiple times in a week, include each occurrence as a separate slot
- Return [] if no valid timetable data found`;

  try {
    const response = await invokeAI(prompt, 2048);
    return parseJSONArray(response);
  } catch (err) {
    console.error('[Extractor] Timetable extraction failed:', err.message);
    return [];
  }
}

// ── Exam Schedule Extraction ─────────────────────────────────────────

export async function extractExamScheduleFromText(text) {
  const prompt = `You are extracting an exam schedule from text.

TEXT:
"""
${text.slice(0, 3000)}
"""

Return ONLY a valid JSON array of exam entries. No markdown, no explanation.
Each entry must have these exact fields:
[
  {
    "course_code": "CS301",
    "course_name": "Data Structures",
    "exam_date": "2024-06-20",
    "exam_time": "10:00 AM",
    "venue": "Hall A"
  }
]

Rules:
- "exam_date" must be in YYYY-MM-DD format — convert any date format to this
- "course_code" is required — derive from course name if not explicitly shown
- "exam_time" and "venue" can be empty string if not mentioned
- Include ALL exams found in the schedule
- Return [] if no valid exam schedule data found`;

  try {
    const response = await invokeAI(prompt, 2048);
    return parseJSONArray(response);
  } catch (err) {
    console.error('[Extractor] Exam schedule extraction failed:', err.message);
    return [];
  }
}

// ── Timetable Update Extraction ──────────────────────────────────────

export async function extractTimetableUpdateFromText(text) {
  const prompt = `You are extracting timetable change notices from text.

TEXT:
"""
${text.slice(0, 2000)}
"""

Return ONLY a valid JSON array of timetable changes. No markdown, no explanation.
[
  {
    "course_code": "CS301",
    "change_type": "temporary",
    "override_type": "cancelled",
    "date": "2024-06-15",
    "reason": "Faculty on leave",
    "new_details": {
      "time": "",
      "venue": "",
      "faculty": ""
    }
  }
]

Rules:
- "change_type": "temporary" for one-time changes, "permanent" for permanent changes
- "override_type": one of "cancelled", "rescheduled", "venue_change", "faculty_change", "extra_class"
- "date": YYYY-MM-DD format
- "new_details": fill only the fields that are changing, leave others as empty string
- Return [] if no timetable change information found`;

  try {
    const response = await invokeAI(prompt, 1024);
    return parseJSONArray(response);
  } catch (err) {
    console.error('[Extractor] Timetable update extraction failed:', err.message);
    return [];
  }
}

// ── Assignment Extraction ────────────────────────────────────────────

export async function extractAssignmentFromText(text) {
  const prompt = `You are extracting assignment details from a college notice.

TEXT:
"""
${text.slice(0, 2000)}
"""

Return ONLY valid JSON. No markdown, no explanation.
{
  "title": "Assignment title",
  "subject": "Subject/Course name",
  "course_code": "CS301",
  "deadline": "2024-06-20T17:00:00.000Z",
  "submission_mode": "online | offline | both",
  "description": "Brief description of what needs to be submitted",
  "action_required": "What the student must do"
}

Rules:
- "deadline" must be ISO 8601 format. If only date given, assume 11:59 PM.
- If deadline is not mentioned, set to null
- "submission_mode" must be exactly one of: online, offline, both. Default to online if unclear.
- Be specific and actionable in "action_required"`;

  try {
    const response = await invokeAI(prompt, 512);
    const parsed = parseJSONObject(response);
    if (parsed && parsed.title) return parsed;
    return assignmentFallbackFromText(text);
  } catch (err) {
    console.error('[Extractor] Assignment extraction failed:', err.message);
    return assignmentFallbackFromText(text);
  }
}

// ── Placement Extraction ─────────────────────────────────────────────

export async function extractPlacementFromText(text) {
  const prompt = `You are extracting placement/job opportunity details from a college notice.

TEXT:
"""
${text.slice(0, 2000)}
"""

Return ONLY valid JSON. No markdown, no explanation.
{
  "company": "Company name",
  "role": "Job role/position",
  "package": "7 LPA",
  "eligible_branches": ["CSE", "IT", "ECE"],
  "minimum_cgpa": 7.0,
  "allowed_backlogs": 0,
  "deadline": "2024-06-20T23:59:00.000Z",
  "test_date": "2024-06-25T10:00:00.000Z",
  "application_link": "https://...",
  "action_required": "Register before the deadline"
}

Rules:
- "eligible_branches": array of branch abbreviations, empty array if all branches eligible
- "minimum_cgpa": number, 0 if not mentioned
- "allowed_backlogs": integer, 0 if not mentioned
- "deadline" and "test_date": ISO 8601 or null if not mentioned
- "application_link": URL string or empty string`;

  try {
    const response = await invokeAI(prompt, 512);
    return parseJSONObject(response);
  } catch (err) {
    console.error('[Extractor] Placement extraction failed:', err.message);
    return null;
  }
}

// ── JSON Helpers ─────────────────────────────────────────────────────

function stripFences(raw) {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

function extractFirstJsonObject(raw) {
  if (!raw) return null;
  const start = raw.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function extractFirstJsonArray(raw) {
  if (!raw) return null;
  const start = raw.indexOf('[');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '[') depth++;
    if (ch === ']') {
      depth--;
      if (depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

function parseDateFromText(text) {
  if (!text) return null;

  const numeric = text.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/);
  if (numeric) {
    const d = new Date(numeric[1]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  const longMonth = text.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/);
  if (longMonth) {
    const d = new Date(longMonth[1]);
    if (!isNaN(d.getTime())) return d.toISOString();
  }

  return null;
}

function assignmentFallbackFromText(text) {
  const firstLine = text.split('\n').find(l => l.trim())?.trim() || 'Assignment Notice';
  const subjectMatch = text.match(/subject\s*[:\-]\s*(.+)/i);
  const modeMatch = text.match(/(submission mode|submit via|upload on)\s*[:\-]\s*(.+)/i);
  const deadlineLine =
    text.match(/deadline\s*[:\-]\s*(.+)/i)?.[1] ||
    text.match(/due date\s*[:\-]\s*(.+)/i)?.[1] ||
    '';

  return {
    title: firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine,
    subject: (subjectMatch?.[1] || '').trim(),
    course_code: '',
    deadline: parseDateFromText(deadlineLine || text),
    submission_mode: (modeMatch?.[2] || '').trim(),
    description: text.slice(0, 280).trim(),
    action_required: 'Complete and submit before the deadline.',
  };
}

function parseJSONArray(raw) {
  try {
    const cleaned = stripFences(raw);
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Try to extract array from mixed text
    const candidate = extractFirstJsonArray(raw);
    if (candidate) {
      try { return JSON.parse(candidate); } catch { return []; }
    }
    return [];
  }
}

function parseJSONObject(raw) {
  try {
    const cleaned = stripFences(raw);
    const parsed = JSON.parse(cleaned);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    const candidate = extractFirstJsonObject(raw);
    if (candidate) {
      try { return JSON.parse(candidate); } catch { return null; }
    }
    return null;
  }
}
