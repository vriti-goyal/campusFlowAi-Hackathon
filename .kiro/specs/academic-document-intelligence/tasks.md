# Tasks
# Task 1: Create new data models and modify existing models
- [x] 1.1 Create `backend/models/TimetableOverride.js` with schema (batchId, timetableId, slotIndex, effectiveDate, overrideType, newTime, newVenue, newFaculty, newDay, reason, createdBy, source, flaggedForReview) and indexes on (batchId + effectiveDate) and (timetableId + effectiveDate)
- [x] 1.2 Create `backend/models/TimetableAuditLog.js` with schema (batchId, action, targetDay, targetSlotIndex, changeDetails, reason, performedBy, performedByName) and index on (batchId + createdAt)
- [x] 1.3 Create `backend/models/Reminder.js` with schema (batchId, referenceType, referenceId, title, deadlineDate, remindAt, intervalLabel, status, sentAt) and indexes on (status + remindAt) and (referenceId + referenceType)
- [x] 1.4 Add new fields to `backend/models/Assignment.js`: questions, instructions, marksAllocation, faculty, fileUrl, extractedFrom, deadlineUnknown
- [x] 1.5 Add `examType` field (enum: Mid Semester, End Semester, Quiz, Practical, Viva, Other) to `backend/models/ExamSchedule.js`
- [x] 1.6 Add `lastPermanentUpdateAt` and `lastPermanentUpdateBy` fields to `backend/models/Timetable.js`
- [x] 1.7 Add `reminderId` and `batchId` fields to `backend/models/Notification.js`

# Task 2: Implement DocumentClassifier service
- [x] 2.1 Create `backend/services/documentClassifier.js` with `classifyDocument(text)` function
- [x] 2.2 Implement the Gemini AI classification prompt that evaluates text against all four categories (timetable, exam_schedule, assignment, notice) simultaneously
- [x] 2.3 Implement confidence threshold logic: include categories with confidence ≥ 0.6, fallback to "general" if no category meets threshold
- [x] 2.4 Implement multi-category response parsing from Gemini JSON output into `{ categories: string[], confidence: object }`
- [x] 2.5 Add error handling: retry once with 3-second delay on AI failure, then fallback to existing `detectDocumentType()` keyword heuristic

# Task 3: Implement CourseFilter service
- [x] 3.1 Create `backend/services/courseFilter.js` with `filterByCourses(userId, batchId, extractedData)` function
- [x] 3.2 Implement course enrollment lookup: query BatchMember → Batch → build Set of enrolled course codes (uppercased)
- [x] 3.3 Implement filtering logic: match extracted entries' courseCode against enrolled courses Set, count discarded entries
- [x] 3.4 Implement Batch Admin bypass: if user has role owner/moderator for target batch, skip filtering and pass all courses through
- [x] 3.5 Handle edge case: if extracted data has no course codes (general notice), skip filtering entirely

# Task 4: Implement ReminderEngine service
- [x] 4.1 Create `backend/services/reminderEngine.js` with `createRemindersForDeadline(params)` function
- [x] 4.2 Implement deadline detection logic for assignments (deadline field), exams (examDate), and notice-referenced dates
- [x] 4.3 Implement default reminder scheduling: create Reminder docs at 1 day before and 1 hour before deadline
- [x] 4.4 Implement `updateRemindersForDeadline(referenceId, newDate)` to update existing reminders when deadlines change
- [x] 4.5 Implement `processReminders()` function: query pending reminders where remindAt ≤ now, find batch members, create Notification per member, mark reminder as sent
- [x] 4.6 Add reminder cron job to `backend/cron.js`: schedule `processReminders()` every 5 minutes

# Task 5: Implement NoticeDetector service
- [x] 5.1 Create `backend/services/noticeDetector.js` with `detectNotices(text)` function
- [x] 5.2 Implement the Gemini AI notice detection prompt that extracts notice type, courseCode, affectedDate, determination (temporary/permanent/unknown), and new details
- [x] 5.3 Implement temporary vs permanent determination: parse AI response, default to temporary with `flaggedForReview: true` when determination is "unknown"
- [x] 5.4 Implement integration with TimetableManager: apply temporary overrides or permanent updates based on notice detection results
- [x] 5.5 Trigger batch notification via ReminderEngine when notice-driven timetable update is applied

#Task 6: Implement TimetableManager service
- [x] 6.1 Create `backend/services/timetableManager.js` with CRUD functions: createSlot, updateSlot, deleteSlot
- [x] 6.2 Implement `applyTempOverride(params, adminUser)`: create TimetableOverride document with effectiveDate
- [x] 6.3 Implement `applyPermanentUpdate(timetableId, slotIndex, updates, adminUser, reason)`: modify master Timetable slot, set lastPermanentUpdateAt/By
- [x] 6.4 Implement `getMergedTimetable(userId, date)`: fetch master timetable, fetch overrides for date, apply priority resolution algorithm (cancelled > rescheduled > room_changed > faculty_changed)
- [x] 6.5 Implement audit logging: write to TimetableAuditLog on every mutation with action type, admin info, timestamp, change diff, and reason
- [x] 6.6 Implement duplicate detection before creation: check batchId + dayOfWeek + courseCode + time for timetable, batchId + courseCode + examDate for exams, batchId + courseCode + normalized title for assignments

# Task 7: Implement DocumentIntelligenceRouter and enhance upload route
- [x] 7.1 Create `backend/services/documentRouter.js` with orchestration logic: classify → filter → route to modules
- [x] 7.2 Implement multi-module routing: for each detected category, call the appropriate extraction and creation logic (timetable, exam, assignment, notice)
- [x] 7.3 Implement assignment extraction using the Assignment Extraction AI Prompt (courseName, courseCode, title, faculty, dueDate, instructions, marksAllocation, questions)
- [x] 7.4 Modify `backend/routes/upload.js` POST `/api/upload/file`: replace `detectDocumentType()` with DocumentClassifier → CourseFilter → DocumentIntelligenceRouter pipeline
- [x] 7.5 Modify `backend/routes/upload.js` POST `/api/upload/text`: apply same multi-category pipeline for text input
- [x] 7.6 Return enhanced response shape with categories[], routing status per module, skipped[], remindersCreated, courseFilterApplied, filteredOutCount
- [x] 7.7 Implement error handling: AI failure fallback to heuristics, partial success reporting per category, general Post fallback if all extractions fail

# Task 8: Implement Timetable Admin API routes
- [ ] 8.1 Add POST `/api/timetable/slot` route: create new slot in master timetable (Batch Admin auth required)
- [ ] 8.2 Add PUT `/api/timetable/slot/:timetableId/:slotIndex` route: edit existing slot with audit logging
- [ ] 8.3 Add DELETE `/api/timetable/slot/:timetableId/:slotIndex` route: delete slot with audit logging
- [ ] 8.4 Add POST `/api/timetable/override` route: apply temporary override with date, type, and reason
- [ ] 8.5 Add PUT `/api/timetable/permanent-update/:timetableId/:slotIndex` route: apply permanent update to master timetable
- [ ] 8.6 Add GET `/api/timetable/overrides/:batchId` route: list all overrides for a batch
- [ ] 8.7 Add GET `/api/timetable/audit-log/:batchId` route: view audit log with pagination
- [ ] 8.8 Add Batch Admin authorization middleware: verify user has owner/moderator role in BatchMember for the target batch

# Task 9: Implement Student Timetable View API and Reminder routes
- [ ] 9.1 Modify GET `/api/timetable/my-timetable` to accept optional `date` query param for date-specific merged view
- [ ] 9.2 Implement merged timetable response: combine master slots with override status badges (cancelled, rescheduled, room_changed, faculty_changed) and overrideDetails
- [ ] 9.3 Maintain backward compatibility: when only `day` param is provided, return existing master timetable behavior
- [ ] 9.4 Add GET `/api/reminders/upcoming` route: list upcoming reminders for the authenticated user's batches
- [ ] 9.5 Add PUT `/api/reminders/:id/dismiss` route: mark reminder as cancelled/dismissed
- [ ] 9.6 Add GET `/api/reminders/batch/:batchId` route: admin view of all reminders for a batch

#Task 10: Frontend - Enhanced Upload Flow UI
- [ ] 10.1 Modify `frontend/src/pages/Upload.jsx` to display "Classification Results" panel after upload completes
- [ ] 10.2 Implement category icons display (📅 Timetable, 📝 Exam, 📚 Assignment, 📣 Notice) with per-category routing status (✓ Created, ⚠ Filtered, ✗ Failed)
- [ ] 10.3 Implement course filter summary display: "X entries matched your courses, Y filtered out"
- [ ] 10.4 Add module routing indicators as clickable links to navigate to relevant sections (timetable, exams, assignments)
- [ ] 10.5 Handle error states: display fallback messaging when classification fails or no relevant content found

# Task 11: Frontend - Timetable Admin Panel and Student View
- [ ] 11.1 Add admin mode toggle to `frontend/src/pages/Timetable.jsx` (rendered only for owner/moderator roles)
- [ ] 11.2 Implement day-by-day slot management grid with Add/Edit/Delete slot dialogs (form: course, time, venue, faculty)
- [ ] 11.3 Implement "Apply Override" dialog with date picker, override type selector (rescheduled, cancelled, room_changed, faculty_changed), and reason field
- [ ] 11.4 Implement override status badges: colored chips (Rescheduled=orange, Cancelled=red, Room Changed=blue, Faculty Changed=purple)
- [ ] 11.5 Implement audit log viewer as collapsible table showing recent changes
- [ ] 11.6 Implement student date picker for specific-day view (defaults to today) with merged master + override display
- [ ] 11.7 Implement slot status indicators: 🔴 Cancelled (strikethrough + red badge), 🟠 Rescheduled (orange + new time/venue), 🔵 Room Changed (blue + new room), 🟣 Faculty Changed (purple + new name)

# Task 12: Integration Testing and Error Handling
- [ ] 12.1 Write integration tests for multi-category classification: verify single document produces entries in multiple modules
- [ ] 12.2 Write tests for CourseFilter: verify enrolled-course filtering, admin bypass, and no-courseCode edge case
- [ ] 12.3 Write tests for TimetableManager: verify CRUD operations, override priority resolution, and audit log creation
- [ ] 12.4 Write tests for ReminderEngine: verify reminder creation at correct intervals, processReminders dispatches notifications, and deadline update cascades
- [ ] 12.5 Write tests for NoticeDetector: verify notice type extraction, temporary/permanent determination, and flaggedForReview on unknown
- [ ] 12.6 Write tests for duplicate detection: verify skipped entries for timetable, exam, and assignment duplicates
- [ ] 12.7 Write end-to-end upload test: upload a multi-category document and verify all modules receive correct data with course filtering applied
- [ ] 12.8 Write error handling tests: AI failure fallback to heuristics, invalid date skipping, network retry logic
