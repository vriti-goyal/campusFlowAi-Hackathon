# Requirements Document

## Introduction

The Academic Document Intelligence Engine enhances the CampusFlow AI upload pipeline with multi-category document classification, intelligent extraction, course-aware filtering, and automatic cross-module updates. Documents uploaded from any section (Upload, Timetable, Exam, Assignment) are analyzed by the AI pipeline, classified into one or more categories (timetable, exam schedule, assignment, notice), and routed to the appropriate modules without requiring duplicate uploads. The feature also introduces timetable administration (CRUD with temporary/permanent overrides) and automatic notice-driven timetable updates.

## Glossary

- **Document_Intelligence_Engine**: The backend service that receives uploaded documents (PDF, image, screenshot), performs OCR and AI extraction, classifies documents into categories, and routes extracted data to the appropriate modules.
- **Upload_Pipeline**: The existing Express.js route and service chain (S3 upload → Textract/Gemini Vision OCR → AI extraction → module creation) that processes incoming files.
- **Course_Filter**: The component that retrieves the uploading user's enrolled batches and their mapped courses, then retains only information matching enrolled courses.
- **Document_Classifier**: The AI-powered component that determines which categories (timetable, exam_schedule, assignment, notice) a single document belongs to, supporting multi-category classification.
- **Timetable_Module**: The module responsible for storing and displaying weekly class schedules per batch, including master timetable entries and override records.
- **Exam_Module**: The module responsible for storing and displaying exam schedule entries (Mid Semester, End Semester, Quiz, Practical, Viva) per batch.
- **Assignment_Module**: The module responsible for storing and displaying assignment entries with attached original documents.
- **Reminder_Engine**: The component that automatically generates reminder notifications for upcoming deadlines and exam dates.
- **Timetable_Admin_Panel**: The interface and API that allows Batch Admins (owner/moderator roles) to create, edit, delete, reschedule, cancel, and override timetable entries.
- **Override_Record**: A database entry representing a temporary or permanent modification to a timetable slot, containing admin name, timestamp, reason, and change type.
- **Notice_Detector**: The AI sub-component that identifies administrative notices (cancellations, reschedules, room changes, faculty changes) and determines whether updates are temporary or permanent.
- **Batch_Admin**: A user with role "owner" or "moderator" in a BatchMember record, authorized to manage timetable entries for that batch.
- **Master_Timetable**: The permanent weekly timetable for a batch, representing the default schedule for all future occurrences.
- **Temporary_Override**: A modification affecting a single date occurrence of a timetable slot (e.g., one cancelled class on a specific date).
- **Permanent_Update**: A modification that changes the Master_Timetable for all future occurrences from the effective date onward.

## Requirements

### Requirement 1: Multi-Category Document Classification

**User Story:** As a student, I want the system to detect all categories present in a single uploaded document, so that one upload updates all relevant modules without manual re-uploads.

#### Acceptance Criteria

1. WHEN a document is uploaded, THE Document_Classifier SHALL analyze the extracted text and return one or more category labels from the set: timetable, exam_schedule, assignment, notice.
2. WHEN the Document_Classifier returns multiple categories for a single document, THE Document_Intelligence_Engine SHALL route extracted data to each corresponding module independently.
3. WHEN a document contains both exam schedule information and assignment information, THE Document_Intelligence_Engine SHALL create entries in the Exam_Module and the Assignment_Module from the same upload.
4. IF the Document_Classifier cannot determine any category with sufficient confidence, THEN THE Document_Intelligence_Engine SHALL classify the document as "general" and create a Post entry.

### Requirement 2: Course-Aware Filtering

**User Story:** As a student, I want the system to only process information related to my enrolled courses, so that my modules are not cluttered with irrelevant data.

#### Acceptance Criteria

1. WHEN a document is uploaded by a student, THE Course_Filter SHALL retrieve the user's enrolled batches and the courses mapped to those batches.
2. WHEN extracted data contains course references, THE Course_Filter SHALL retain only entries matching the user's enrolled courses and discard unrelated entries.
3. IF the extracted data contains zero entries matching the user's enrolled courses, THEN THE Document_Intelligence_Engine SHALL return a response indicating no relevant information was found for the user's courses.
4. WHEN a Batch_Admin uploads a document for a specific batch, THE Course_Filter SHALL process all courses mapped to that batch regardless of the admin's personal enrollment.

### Requirement 3: Timetable Extraction and Creation

**User Story:** As a student, I want the system to automatically detect and extract class timetable information from uploaded documents, so that my weekly schedule is populated without manual entry.

#### Acceptance Criteria

1. WHEN the Document_Classifier identifies a document as containing timetable data, THE Document_Intelligence_Engine SHALL extract course name, faculty name, day of week, time slot, room/venue, and batch for each class entry.
2. WHEN timetable entries are extracted, THE Timetable_Module SHALL create or update timetable slot records grouped by day of week for the target batch.
3. THE Timetable_Module SHALL display each timetable entry with: course name, faculty, day, time, and room.
4. IF the extraction produces zero valid timetable entries, THEN THE Document_Intelligence_Engine SHALL return an error message indicating extraction failure and suggest uploading a clearer document.

### Requirement 4: Exam Schedule Extraction and Creation

**User Story:** As a student, I want the system to automatically detect exam schedules from uploaded documents, so that my exam dates and venues are tracked without manual entry.

#### Acceptance Criteria

1. WHEN the Document_Classifier identifies a document as containing exam schedule data, THE Document_Intelligence_Engine SHALL extract course name, exam type (Mid Semester, End Semester, Quiz, Practical, Viva), date, time, and venue for each exam entry.
2. WHEN exam schedule entries are extracted, THE Exam_Module SHALL create exam schedule records for the target batch.
3. THE Exam_Module SHALL display exam entries without embedding the original PDF or image inside exam entry views.
4. WHEN exam schedule entries are created, THE Reminder_Engine SHALL generate reminder notifications for each exam date.
5. IF the extraction produces entries with invalid or unparseable dates, THEN THE Document_Intelligence_Engine SHALL skip those entries and report the count of skipped entries to the user.

### Requirement 5: Assignment Extraction and Creation

**User Story:** As a student, I want the system to automatically detect assignments from uploaded documents and extract all questions and instructions, so that I can view assignment details directly in the app.

#### Acceptance Criteria

1. WHEN the Document_Classifier identifies a document as containing assignment data, THE Document_Intelligence_Engine SHALL extract course name, assignment title, due date, faculty name, instructions, and marks allocation.
2. WHEN the uploaded document is a PDF, THE Document_Intelligence_Engine SHALL extract all questions and task descriptions from the PDF content.
3. WHEN the uploaded document is an image, THE Document_Intelligence_Engine SHALL perform OCR and extract all visible questions and task descriptions.
4. WHEN assignment entries are created in the Assignment_Module, THE Assignment_Module SHALL store and display the original PDF or image file within the assignment entry.
5. WHEN an assignment due date is extracted, THE Reminder_Engine SHALL generate a reminder notification for the submission deadline.
6. IF the extraction cannot determine a due date, THEN THE Document_Intelligence_Engine SHALL create the assignment entry with a null deadline and flag the entry as "deadline unknown."

### Requirement 6: Single Source of Truth Upload Behavior

**User Story:** As a student, I want to upload a document from any section of the app and have all relevant modules updated automatically, so that I never need to upload the same document twice.

#### Acceptance Criteria

1. WHEN a document is uploaded from the Upload Section, THE Document_Intelligence_Engine SHALL classify and route extracted data to all matching modules (Timetable_Module, Exam_Module, Assignment_Module).
2. WHEN a document is uploaded from the Timetable Section, THE Document_Intelligence_Engine SHALL still classify the document and route data to the Exam_Module and Assignment_Module if relevant content is detected.
3. WHEN a document is uploaded from the Exam Section, THE Document_Intelligence_Engine SHALL still classify the document and route data to the Timetable_Module and Assignment_Module if relevant content is detected.
4. WHEN a document is uploaded from the Assignment Section, THE Document_Intelligence_Engine SHALL still classify the document and route data to the Timetable_Module and Exam_Module if relevant content is detected.
5. THE Document_Intelligence_Engine SHALL perform duplicate detection before creating entries, and skip creation for entries that already exist in a module for the same batch.

### Requirement 7: Deadline Detection and Automatic Reminders

**User Story:** As a student, I want the system to automatically detect all deadlines (assignment submissions, exam dates, registration deadlines) and create reminders, so that I never miss an important date.

#### Acceptance Criteria

1. WHEN the Document_Intelligence_Engine extracts a date that represents an assignment deadline, exam date, submission deadline, or registration deadline, THE Reminder_Engine SHALL create a reminder entry associated with the user's batch.
2. THE Reminder_Engine SHALL generate reminders at configurable intervals before the deadline (default: 1 day before and 1 hour before).
3. WHEN a reminder is triggered, THE Reminder_Engine SHALL send a notification to all enrolled members of the relevant batch.
4. IF a deadline is updated or rescheduled, THEN THE Reminder_Engine SHALL update the associated reminders to reflect the new date.

### Requirement 8: Timetable Admin Management (CRUD)

**User Story:** As a Batch Admin, I want to create, edit, delete, and reschedule timetable entries, so that I can keep the class schedule accurate for all batch members.

#### Acceptance Criteria

1. WHEN a Batch_Admin creates a new timetable slot, THE Timetable_Admin_Panel SHALL add the slot to the Master_Timetable for the specified day and time.
2. WHEN a Batch_Admin edits an existing timetable slot, THE Timetable_Admin_Panel SHALL update the Master_Timetable and log the modification with admin name, timestamp, and reason.
3. WHEN a Batch_Admin deletes a timetable slot, THE Timetable_Admin_Panel SHALL remove the slot from the Master_Timetable and log the deletion with admin name, timestamp, and reason.
4. WHEN a Batch_Admin reschedules a class, THE Timetable_Admin_Panel SHALL create an Override_Record specifying the original slot, new day/time/venue, and reason.
5. THE Timetable_Admin_Panel SHALL restrict all timetable management operations to users with "owner" or "moderator" role in the BatchMember record for that batch.

### Requirement 9: Timetable Temporary Overrides and Permanent Updates

**User Story:** As a Batch Admin, I want to apply temporary overrides (single occurrence) or permanent updates (all future occurrences) to timetable entries, so that students always see the correct schedule.

#### Acceptance Criteria

1. WHEN a Batch_Admin applies a temporary override, THE Timetable_Module SHALL create an Override_Record that affects only the specified date and store the override type as one of: "rescheduled", "cancelled", "room_changed", "faculty_changed".
2. WHEN a Batch_Admin applies a permanent update, THE Timetable_Module SHALL modify the Master_Timetable slot for all future occurrences from the effective date onward.
3. THE Timetable_Module SHALL log every modification with: admin name, timestamp, reason, and change type (temporary or permanent).
4. WHEN displaying a timetable slot for a specific date, THE Timetable_Module SHALL apply display priority in order: Temporary Override, then Rescheduled, then Cancelled, then Permanent Update, then Original Master_Timetable entry.
5. WHEN a temporary override exists for a specific date, THE Timetable_Module SHALL display a status badge indicating the override type (Rescheduled, Cancelled, Room Changed, Faculty Changed).

### Requirement 10: AI-Driven Notice Detection for Timetable Updates

**User Story:** As a student, I want the system to automatically detect notices about class cancellations, reschedules, room changes, and faculty changes, so that my timetable is always up to date.

#### Acceptance Criteria

1. WHEN the Document_Classifier identifies a document as a notice containing class cancellation, reschedule, room change, or faculty change information, THE Notice_Detector SHALL extract the affected course, date, original slot, and new details.
2. WHEN the Notice_Detector classifies a change as temporary (single occurrence), THE Timetable_Module SHALL create a Temporary_Override record for the affected slot and date.
3. WHEN the Notice_Detector classifies a change as permanent (updated timetable), THE Timetable_Module SHALL update the Master_Timetable for all future occurrences.
4. WHEN a notice-driven timetable update is applied, THE Reminder_Engine SHALL send a notification to all enrolled members of the affected batch with details of the change.
5. IF the Notice_Detector cannot determine whether a change is temporary or permanent, THEN THE Document_Intelligence_Engine SHALL default to creating a Temporary_Override and flag the entry for admin review.

### Requirement 11: Student Timetable View

**User Story:** As a student, I want to always see the latest active timetable reflecting all overrides and updates, so that I know my actual class schedule for any given day.

#### Acceptance Criteria

1. WHEN a student requests the timetable for a specific date, THE Timetable_Module SHALL merge the Master_Timetable with applicable Temporary_Overrides and Permanent_Updates for that date.
2. WHEN a class is cancelled for a specific date, THE Timetable_Module SHALL display the slot with a "Cancelled" status and visual indicator.
3. WHEN a class is rescheduled for a specific date, THE Timetable_Module SHALL display the updated time, venue, or faculty with a "Rescheduled" status indicator.
4. WHEN a faculty or room change applies to a specific date, THE Timetable_Module SHALL display the updated faculty or room with the corresponding change indicator.
5. THE Timetable_Module SHALL display the student's timetable aggregated across all batches the student is enrolled in.
