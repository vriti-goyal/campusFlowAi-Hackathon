# Technical Design: Academic Document Intelligence Engine

## Overview

The Academic Document Intelligence Engine upgrades the existing CampusFlow AI upload pipeline from a single-category classifier into a multi-category document router. Today, the upload flow (in `routes/upload.js`) detects one type per document (timetable, exam_schedule, or general) using keyword heuristics in `documentExtractor.js`, then routes to a single module. The new system replaces this with AI-powered multi-category classification, course-aware filtering, cross-module routing, deadline-based reminders, notice-driven timetable updates, and a full timetable admin panel.

The feature integrates directly into the existing Express.js + MongoDB stack, reusing the Gemini AI layer (`config/gemini.js`) for classification and extraction, S3 for storage, and Firebase Auth for access control.

## Architecture

### System Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          UPLOAD ENTRY POINTS                                  │
│  Upload Section │ Timetable Section │ Exam Section │ Assignment Section       │
└────────┬─────────────────┬──────────────────┬──────────────────┬─────────────┘
         │                 │                  │                  │
         ▼                 ▼                  ▼                  ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED UPLOAD HANDLER                                    │
│  S3 Upload → Gemini Vision OCR → Extract Raw Text                            │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT CLASSIFIER (AI)                                  │
│  Input: raw text                                                              │
│  Output: categories[] ∈ {timetable, exam_schedule, assignment, notice}        │
│  Confidence threshold: 0.6 → below = "general" fallback                      │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     COURSE FILTER                                              │
│  Retrieves user's batches → batch.courses[] → filters extracted data          │
│  Admin override: batch admins bypass filter for their batch                   │
└────────────────────────────────┬─────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┬────────────┐
                    ▼            ▼            ▼            ▼
┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐
│  TIMETABLE  │ │   EXAM   │ │ASSIGNMENT│ │  NOTICE DETECTOR │
│   MODULE    │ │  MODULE  │ │  MODULE  │ │  (Temp/Perm)     │
└──────┬──────┘ └─────┬────┘ └─────┬────┘ └────────┬─────────┘
       │               │            │               │
       │               ▼            ▼               │
       │        ┌────────────────────────┐          │
       │        │    REMINDER ENGINE     │          │
       │        │  Deadline detection    │          │
       │        │  Notification dispatch │          │
       │        └────────────────────────┘          │
       │                                            │
       ▼                                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    TIMETABLE MANAGER                               │
│  Master Timetable ←→ Override Records ←→ Audit Log               │
│  Priority: Temp Override > Reschedule > Cancel > Perm > Master   │
└──────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Location | Responsibility |
|-----------|----------|----------------|
| DocumentClassifier | `services/documentClassifier.js` | AI-powered multi-category classification |
| CourseFilter | `services/courseFilter.js` | Filters extracted data by user's enrolled courses |
| TimetableManager | `services/timetableManager.js` | CRUD, overrides, priority resolution, audit logging |
| ReminderEngine | `services/reminderEngine.js` | Deadline detection, reminder scheduling, notifications |
| NoticeDetector | `services/noticeDetector.js` | Identifies notice types, determines temp vs permanent |
| DocumentIntelligenceRouter | `services/documentRouter.js` | Orchestrates classification → filtering → multi-module routing |
| Enhanced Upload Route | `routes/upload.js` (modified) | Unified entry point calling DocumentIntelligenceRouter |
| Timetable Admin Routes | `routes/timetableRoutes.js` (extended) | Admin CRUD, override endpoints |

## Data Models

### New Models

#### TimetableOverride (`models/TimetableOverride.js`)

```javascript
const timetableOverrideSchema = new mongoose.Schema({
  batchId: { type: ObjectId, ref: 'Batch', required: true },
  // Reference to the master timetable slot being overridden
  timetableId: { type: ObjectId, ref: 'Timetable', required: true },
  slotIndex: { type: Number, required: true }, // Index within the slots array

  // What date this override applies to
  effectiveDate: { type: Date, required: true },

  // Override type
  overrideType: {
    type: String,
    enum: ['rescheduled', 'cancelled', 'room_changed', 'faculty_changed'],
    required: true,
  },

  // New values (null means no change for that field)
  newTime: { type: String, default: null },
  newVenue: { type: String, default: null },
  newFaculty: { type: String, default: null },
  newDay: { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], default: null },

  // Metadata
  reason: { type: String, default: '' },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  source: { type: String, enum: ['admin', 'notice_ai'], default: 'admin' },
  flaggedForReview: { type: Boolean, default: false },
}, { timestamps: true });

timetableOverrideSchema.index({ batchId: 1, effectiveDate: 1 });
timetableOverrideSchema.index({ timetableId: 1, effectiveDate: 1 });
```

#### TimetableAuditLog (`models/TimetableAuditLog.js`)

```javascript
const timetableAuditLogSchema = new mongoose.Schema({
  batchId: { type: ObjectId, ref: 'Batch', required: true },
  action: {
    type: String,
    enum: ['create', 'update', 'delete', 'override_temp', 'override_perm', 'notice_applied'],
    required: true,
  },
  targetDay: { type: String },
  targetSlotIndex: { type: Number },
  changeDetails: { type: mongoose.Schema.Types.Mixed }, // JSON diff of old/new values
  reason: { type: String, default: '' },
  performedBy: { type: ObjectId, ref: 'User', required: true },
  performedByName: { type: String }, // Denormalized for display
}, { timestamps: true });

timetableAuditLogSchema.index({ batchId: 1, createdAt: -1 });
```

#### Reminder (`models/Reminder.js`)

```javascript
const reminderSchema = new mongoose.Schema({
  batchId: { type: ObjectId, ref: 'Batch', required: true },
  // What this reminder is for
  referenceType: {
    type: String,
    enum: ['assignment', 'exam', 'exam_schedule', 'registration', 'custom'],
    required: true,
  },
  referenceId: { type: ObjectId }, // Points to Assignment, Exam, or ExamSchedule doc

  title: { type: String, required: true },
  deadlineDate: { type: Date, required: true },

  // Reminder schedule
  remindAt: { type: Date, required: true }, // When to fire the notification
  intervalLabel: { type: String }, // "1_day_before", "1_hour_before"

  // State
  status: { type: String, enum: ['pending', 'sent', 'cancelled'], default: 'pending' },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

reminderSchema.index({ status: 1, remindAt: 1 });
reminderSchema.index({ referenceId: 1, referenceType: 1 });
```

### Model Changes

#### Assignment Model — Add Fields

```javascript
// New fields to add to existing Assignment schema:
questions: [{ type: String }],             // Extracted question texts
instructions: { type: String, default: '' }, // Full instructions text
marksAllocation: { type: String, default: '' },
faculty: { type: String, default: '' },
fileUrl: { type: String, default: '' },     // Original uploaded PDF/image URL
extractedFrom: { type: String, default: '' }, // Source document URL
deadlineUnknown: { type: Boolean, default: false },
```

#### ExamSchedule Model — Add Fields

```javascript
// New fields:
examType: {
  type: String,
  enum: ['Mid Semester', 'End Semester', 'Quiz', 'Practical', 'Viva', 'Other'],
  default: 'Other',
},
```

#### Timetable Model — Add Field

```javascript
// Add to existing timetable schema for permanent updates:
lastPermanentUpdateAt: { type: Date, default: null },
lastPermanentUpdateBy: { type: ObjectId, ref: 'User', default: null },
```

#### Notification Model — Add Fields

```javascript
// New fields for reminder-driven notifications:
reminderId: { type: ObjectId, ref: 'Reminder', default: null },
batchId: { type: ObjectId, ref: 'Batch', default: null },
```

## API Design

### New Endpoints

#### Document Intelligence (enhanced upload)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload/file` | Enhanced: returns multi-category result with module routing |
| POST | `/api/upload/text` | Enhanced: same multi-category pipeline for text input |

**Enhanced Upload Response Shape:**
```json
{
  "success": true,
  "data": {
    "categories": ["timetable", "assignment"],
    "routing": {
      "timetable": { "status": "created", "updatedDays": 5, "totalSlots": 22 },
      "assignment": { "status": "created", "assignmentId": "..." }
    },
    "skipped": [],
    "remindersCreated": 1,
    "fileUrl": "https://s3.../file.pdf",
    "courseFilterApplied": true,
    "filteredOutCount": 2
  }
}
```

#### Timetable Admin CRUD

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/timetable/slot` | Create a new slot in master timetable |
| PUT | `/api/timetable/slot/:timetableId/:slotIndex` | Edit existing slot |
| DELETE | `/api/timetable/slot/:timetableId/:slotIndex` | Delete a slot |
| POST | `/api/timetable/override` | Apply a temporary override |
| PUT | `/api/timetable/permanent-update/:timetableId/:slotIndex` | Apply permanent update |
| GET | `/api/timetable/overrides/:batchId` | List overrides for a batch |
| GET | `/api/timetable/audit-log/:batchId` | View audit log |

**POST `/api/timetable/slot` Request:**
```json
{
  "batchId": "ObjectId",
  "dayOfWeek": "Monday",
  "slot": {
    "time": "09:00 AM - 10:00 AM",
    "courseCode": "CSE301",
    "courseName": "Database Management",
    "venue": "Room 101",
    "faculty": "Dr. Sharma"
  }
}
```

**POST `/api/timetable/override` Request:**
```json
{
  "batchId": "ObjectId",
  "timetableId": "ObjectId",
  "slotIndex": 0,
  "effectiveDate": "2026-02-15",
  "overrideType": "rescheduled",
  "newTime": "11:00 AM - 12:00 PM",
  "newVenue": "Room 205",
  "reason": "Faculty unavailable in morning slot"
}
```

#### Student Timetable View

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/timetable/my-timetable?date=2026-02-15` | Merged view with overrides for specific date |
| GET | `/api/timetable/my-timetable?day=Monday` | Existing: master timetable by day (backward compat) |

**Enhanced my-timetable Response (date mode):**
```json
{
  "success": true,
  "data": [
    {
      "batchId": "...",
      "batchName": "CSE-A 6th Sem",
      "dayOfWeek": "Monday",
      "slots": [
        {
          "time": "09:00 AM",
          "courseCode": "CSE301",
          "courseName": "Database Management",
          "venue": "Room 205",
          "faculty": "Dr. Sharma",
          "status": "rescheduled",
          "overrideDetails": {
            "originalVenue": "Room 101",
            "reason": "Room maintenance",
            "overrideType": "room_changed"
          }
        },
        {
          "time": "11:00 AM",
          "courseCode": "CSE305",
          "courseName": "Computer Networks",
          "venue": "Room 101",
          "faculty": "Prof. Gupta",
          "status": "cancelled",
          "overrideDetails": {
            "reason": "Faculty on leave",
            "overrideType": "cancelled"
          }
        }
      ]
    }
  ]
}
```

#### Reminders

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reminders/upcoming` | List upcoming reminders for user |
| PUT | `/api/reminders/:id/dismiss` | Mark reminder as dismissed |
| GET | `/api/reminders/batch/:batchId` | Admin: all reminders for a batch |

### Modified Endpoints

#### `POST /api/upload/file` (modified)

Current behavior: detects single type via `detectDocumentType()` heuristics, routes to one module.

New behavior:
1. Replace `detectDocumentType()` call with `DocumentClassifier.classify(text)`
2. Call `CourseFilter.filter(categories, extractedData, userId, batchId)`
3. Call `DocumentIntelligenceRouter.route(filteredData, categories, batchId, userId)`
4. Return multi-category response with per-module results

#### `POST /api/upload/text` (modified)

Same enhancement as file upload — runs through DocumentClassifier → CourseFilter → Router.

#### `GET /api/timetable/my-timetable` (modified)

Add `date` query param support. When `date` is provided, merge master timetable with applicable overrides for that date and return status badges.

## Service Layer

### DocumentClassifier Service (`services/documentClassifier.js`)

**Responsibility:** Analyze extracted text and return one or more category labels with confidence scores.

**Interface:**
```javascript
/**
 * @param {string} text - OCR-extracted text
 * @returns {Promise<{ categories: string[], confidence: object }>}
 */
export async function classifyDocument(text) { ... }
```

**AI Prompt Design:**

The classifier uses a single Gemini call with structured JSON output. It evaluates the text against all four categories simultaneously, returning confidence scores for each. Categories with confidence ≥ 0.6 are included.

**Multi-category logic:**
1. Call Gemini with classification prompt
2. Parse response into `{ timetable: 0.9, exam_schedule: 0.1, assignment: 0.85, notice: 0.2 }`
3. Filter to categories where confidence ≥ 0.6
4. If no category meets threshold → return `["general"]`

### CourseFilter Service (`services/courseFilter.js`)

**Responsibility:** Ensure only course-relevant data passes through to module creation.

**Interface:**
```javascript
/**
 * @param {string} userId
 * @param {string} batchId - Target batch for the upload
 * @param {object} extractedData - Data extracted per category
 * @returns {Promise<{ filtered: object, discardedCount: number }>}
 */
export async function filterByCourses(userId, batchId, extractedData) { ... }
```

**How it retrieves user's enrolled courses:**
1. Query `BatchMember.find({ userId })` → get all batchIds
2. Query `Batch.find({ _id: { $in: batchIds } })` → get each batch's `courses[]` array
3. Build a Set of enrolled course codes (uppercased)

**How it filters extracted data:**
1. For each extracted entry, check if `courseCode` exists in the enrolled courses Set
2. If match → keep. If no match → discard and increment counter
3. If the uploading user is a Batch Admin for the target batch (role: owner/moderator), bypass filtering — all courses for that batch pass through

**Edge case:** If extracted data has no course codes (e.g., a general notice), skip filtering entirely.

### TimetableManager Service (`services/timetableManager.js`)

**Responsibility:** All timetable mutations, override resolution, and audit trail.

**Interface:**
```javascript
export async function createSlot(batchId, dayOfWeek, slot, adminUser) { ... }
export async function updateSlot(timetableId, slotIndex, updates, adminUser, reason) { ... }
export async function deleteSlot(timetableId, slotIndex, adminUser, reason) { ... }
export async function applyTempOverride(params, adminUser) { ... }
export async function applyPermanentUpdate(timetableId, slotIndex, updates, adminUser, reason) { ... }
export async function getMergedTimetable(userId, date) { ... }
```

**Override logic (temporary vs permanent):**
- **Temporary:** Creates a `TimetableOverride` document with `effectiveDate`. Affects only that single date. Master timetable unchanged.
- **Permanent:** Directly modifies the slot in the `Timetable.slots` array via `findOneAndUpdate`. Logs the change in `TimetableAuditLog`. Sets `lastPermanentUpdateAt`.

**Priority Resolution Algorithm:** See Implementation Notes section.

**Audit logging:** Every mutation (create/update/delete/override) writes to `TimetableAuditLog` with: action type, admin userId + name, timestamp, the change diff, and reason.

### ReminderEngine Service (`services/reminderEngine.js`)

**Responsibility:** Detect deadlines from extracted data, create reminder records, dispatch notifications via cron.

**Interface:**
```javascript
export async function createRemindersForDeadline(params) { ... }
export async function updateRemindersForDeadline(referenceId, newDate) { ... }
export async function processReminders() { ... } // Called by cron
```

**Deadline detection:**
- Assignment: `deadline` field from extraction
- Exam: `examDate` from ExamSchedule
- Notice: any date references in notice text that represent deadlines

**Reminder scheduling (default intervals):**
- 1 day before deadline → create Reminder with `remindAt = deadline - 24h`
- 1 hour before deadline → create Reminder with `remindAt = deadline - 1h`

**Notification dispatch (added to `cron.js`):**
- Every 5 minutes, query `Reminder.find({ status: 'pending', remindAt: { $lte: now } })`
- For each due reminder: find all batch members → create `Notification` per member → mark reminder as `sent`

### NoticeDetector Service (`services/noticeDetector.js`)

**Responsibility:** Identify notice type (cancellation, reschedule, room change, faculty change) and classify as temporary or permanent.

**Interface:**
```javascript
/**
 * @param {string} text - Extracted text from notice
 * @returns {Promise<{ notices: NoticeAction[] }>}
 *
 * NoticeAction: { type, courseCode, affectedDate, isPermanent, newDetails, flaggedForReview }
 */
export async function detectNotices(text) { ... }
```

**How it identifies notice types:**
1. Send text to Gemini with the Notice Detection Prompt (see AI Prompts section)
2. Parse response into structured notice actions
3. Each action has: type (cancelled/rescheduled/room_changed/faculty_changed), affected course, date, new details

**Temporary vs permanent determination:**
- AI prompt asks explicitly: "Is this a one-time change for a specific date, or a permanent schedule modification?"
- If AI returns `"determination": "unknown"` → default to temporary, set `flaggedForReview: true`

## Frontend Components

### Timetable Admin Panel

**Location:** New component within `pages/Timetable.jsx` (admin mode toggle)

**Features:**
- Day-by-day slot management grid
- Add/Edit/Delete slot dialogs (form with course, time, venue, faculty fields)
- "Apply Override" dialog with date picker and override type selector
- Override status badges: colored chips (Rescheduled = orange, Cancelled = red, Room Changed = blue, Faculty Changed = purple)
- Audit log viewer (collapsible table showing recent changes)

**Access control:** Rendered only when `BatchMember.role` is `owner` or `moderator`. Check via existing batch membership API.

**Libraries:** Uses existing Tailwind classes + Lucide icons (`Edit2`, `Trash2`, `Calendar`, `AlertCircle`).

### Enhanced Upload Flow

**Location:** Modified `pages/Upload.jsx`

**Changes:**
- After upload completes, display a "Classification Results" panel showing:
  - List of detected categories with icons (📅 Timetable, 📝 Exam, 📚 Assignment, 📣 Notice)
  - Per-category routing status (✓ Created, ⚠ Filtered, ✗ Failed)
  - Course filter summary: "3 entries matched your courses, 2 filtered out"
- Module routing indicators as clickable links to navigate to the relevant section

### Student Timetable View

**Location:** Enhanced `pages/Timetable.jsx`

**Features:**
- Date picker to view specific day's schedule (defaults to today)
- Merged view combining master + overrides
- Status badges per slot:
  - 🔴 Cancelled (strikethrough text + red badge)
  - 🟠 Rescheduled (orange badge + shows new time/venue)
  - 🔵 Room Changed (blue badge + new room)
  - 🟣 Faculty Changed (purple badge + new faculty name)
- Aggregated across all enrolled batches (existing behavior, enhanced with override info)

## AI Prompts

### Document Classification Prompt

```
You are an AI classifier for a college campus management system.

Analyze the following document text and determine which categories it belongs to.
A document can belong to MULTIPLE categories simultaneously.

TEXT:
"""
{extractedText (max 6000 chars)}
"""

Return ONLY valid JSON with this schema:
{
  "categories": {
    "timetable": <confidence 0.0 to 1.0>,
    "exam_schedule": <confidence 0.0 to 1.0>,
    "assignment": <confidence 0.0 to 1.0>,
    "notice": <confidence 0.0 to 1.0>
  },
  "reasoning": "brief explanation of classification"
}

Classification rules:
- "timetable": Weekly class schedules with days, times, courses, rooms
- "exam_schedule": Exam dates, times, venues for Mid/End Sem, Quiz, Practical, Viva
- "assignment": Homework, projects, submissions with questions or tasks to complete
- "notice": Administrative announcements about cancellations, reschedules, room/faculty changes, deadlines
- A document can be BOTH an exam_schedule AND a notice (e.g., revised exam dates)
- A document can be BOTH a timetable AND a notice (e.g., updated class schedule)
- Set confidence to 0.0 if no evidence for that category
```

### Timetable Extraction Prompt

Uses the existing `TIMETABLE_PROMPT` from `services/documentExtractor.js` — no changes needed. The current prompt already extracts day, time, course_code, course_name, venue, faculty.

### Assignment Extraction Prompt

```
You are an AI assistant for a college campus management system.

The following text was extracted from an ASSIGNMENT document.
Extract all assignment details and questions from it.

TEXT:
"""
{extractedText (max 6000 chars)}
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
- "faculty": Professor name if mentioned, empty string if not
```

### Notice Detection Prompt

```
You are an AI assistant for a college campus management system.

The following text is an administrative NOTICE. Extract all schedule changes mentioned.

TEXT:
"""
{extractedText (max 6000 chars)}
"""

Return ONLY valid JSON. No explanation. Use this exact schema:
{
  "notices": [
    {
      "type": "cancelled" | "rescheduled" | "room_changed" | "faculty_changed",
      "courseCode": "CSE301",
      "courseName": "Database Management",
      "affectedDate": "2026-02-15",
      "originalTime": "09:00 AM",
      "newTime": "11:00 AM",
      "newVenue": "Room 205",
      "newFaculty": "",
      "determination": "temporary" | "permanent" | "unknown",
      "reason": "Faculty on medical leave"
    }
  ]
}

Rules:
- "type": What kind of change is being announced
- "determination": "temporary" if it's a one-time change for a specific date,
  "permanent" if the schedule is changed for all future occurrences,
  "unknown" if you cannot determine
- "affectedDate": The specific date affected (ISO format YYYY-MM-DD). For permanent changes, this is the effective-from date.
- New fields (newTime, newVenue, newFaculty): Fill only what changed, empty string otherwise
- Include ALL changes mentioned in the notice
- Return empty "notices": [] if no schedule changes found
```

## Implementation Notes

### Priority Display Algorithm

When displaying a timetable slot for a specific date, apply this resolution:

```javascript
function resolveSlotForDate(masterSlot, overrides, date) {
  // 1. Find all overrides for this slot on this date
  const dateOverrides = overrides.filter(o =>
    o.timetableId === masterSlot.timetableId &&
    o.slotIndex === masterSlot.slotIndex &&
    isSameDay(o.effectiveDate, date)
  );

  if (dateOverrides.length === 0) {
    // No override → show master slot as-is
    return { ...masterSlot, status: 'active', overrideDetails: null };
  }

  // 2. Priority order: cancelled > rescheduled > room_changed > faculty_changed
  const priorityOrder = ['cancelled', 'rescheduled', 'room_changed', 'faculty_changed'];

  // Sort by priority (lowest index = highest priority)
  dateOverrides.sort((a, b) =>
    priorityOrder.indexOf(a.overrideType) - priorityOrder.indexOf(b.overrideType)
  );

  const topOverride = dateOverrides[0];

  // 3. Build display slot
  const displaySlot = { ...masterSlot };
  displaySlot.status = topOverride.overrideType;
  displaySlot.overrideDetails = {
    reason: topOverride.reason,
    overrideType: topOverride.overrideType,
    originalVenue: masterSlot.venue,
    originalTime: masterSlot.time,
    originalFaculty: masterSlot.faculty,
  };

  // Apply changes
  if (topOverride.newTime) displaySlot.time = topOverride.newTime;
  if (topOverride.newVenue) displaySlot.venue = topOverride.newVenue;
  if (topOverride.newFaculty) displaySlot.faculty = topOverride.newFaculty;

  return displaySlot;
}
```

### Duplicate Detection

Duplicates are checked per module before creation:

| Module | Duplicate Key |
|--------|--------------|
| Timetable | `batchId + dayOfWeek + courseCode + time` |
| ExamSchedule | `batchId + courseCode + examDate` |
| Assignment | `batchId + courseCode + title (normalized lowercase)` |

**Algorithm:**
```javascript
async function isDuplicate(module, key) {
  const existing = await Model.findOne(key).lean();
  return !!existing;
}
```

If duplicate detected → skip creation for that entry, include in response's `skipped[]` array with reason.

### Error Handling

**AI extraction failure:**
1. If `classifyDocument()` throws → fall back to `detectDocumentType()` keyword heuristic (existing function)
2. If category-specific extraction fails (e.g., `extractTimetableFromText` returns empty) → report that category as failed in response, continue processing other categories
3. If all extractions fail → create a Post with category "general" as fallback (preserves existing behavior)

**Course filter with no matches:**
- Return response with `courseFilterApplied: true`, `filteredOutCount: N`, and a user-friendly message: "No relevant information found for your enrolled courses."

**Invalid dates in extraction:**
- Skip entries with unparseable dates
- Report count of skipped entries in response
- Assignment with no deadline: create with `deadline: null`, `deadlineUnknown: true`

**Override conflict resolution:**
- If multiple overrides exist for the same slot on the same date (shouldn't normally happen), use priority order from the algorithm above
- Log a warning to console for manual review

**Network/S3 failures:**
- Existing retry logic in S3 upload remains unchanged
- AI calls: single retry with 3-second delay before falling back to heuristics

### Cron Job Addition

Add to existing `cron.js`:

```javascript
import { processReminders } from './services/reminderEngine.js';

// Process due reminders every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await processReminders();
  } catch (err) {
    console.error('[Cron] Reminder processing failed:', err.message);
  }
});
```

### Migration Notes

- Existing timetable data continues to work — no schema-breaking changes to `Timetable` model
- New fields on Assignment and ExamSchedule have defaults, so existing records are unaffected
- The `detectDocumentType()` function in `documentExtractor.js` is kept as fallback but no longer primary classifier
- Existing upload routes remain backward-compatible — new response fields are additive
