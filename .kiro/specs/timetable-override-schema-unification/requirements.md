# Requirements Document

## Introduction

The CampusFlow AI backend persists temporary timetable changes through a single Mongoose model, `TimetableOverride`. A full functionality verification surfaced a schema schism: the model and its call sites disagree on which set of fields a `TimetableOverride` document carries. The result is that two of the four code paths that write overrides throw validation errors at runtime, and the read paths are split so that overrides written by one half of the system are invisible to the other half.

There are two incompatible field conventions in use:

- **Convention A** (declared by the model and used by `routes/upload.js` and `routes/timetableRoutes.js`): identifies the affected slot with `originalSlotId` (a slot `_id` from `Timetable.slots`), stores the affected day as a `date` string in `YYYY-MM-DD` format, nests changed values under `newDetails: { time, venue, faculty }`, records the actor as `adminName` (string), and tracks lifecycle with `status` (`active` | `pending_review`).
- **Convention B** (used by `services/noticeDetector.js` and `services/timetableManager.js` and the test suite): identifies the affected slot with `timetableId` + `slotIndex`, stores the affected date as an `effectiveDate` `Date`, stores changed values as flat fields `newTime` / `newVenue` / `newFaculty` / `newDay`, records the actor as `createdBy` (ObjectId), records provenance as `source`, and tracks review state with `flaggedForReview` (boolean).

Because the model declares only Convention A with `originalSlotId` and `date` as required, every Convention B write fails with: `TimetableOverride validation failed: date: Path 'date' is required., originalSlotId: Path 'originalSlotId' is required.` This breaks notice-driven overrides and admin temporary overrides at runtime — not only in tests — and accounts for the 4 failing tests in `backend/tests/applyNoticeToTimetable.test.js`. Even setting aside the write failures, the reads are inconsistent: Convention A reads filter by `date` (string) + `status`, while Convention B reads filter by `effectiveDate` (Date range) + `timetableId` + `slotIndex`, so the two halves of the timetable feature cannot observe each other's overrides.

The goal of this feature is to unify `TimetableOverride` onto a single schema/convention that all four call sites and the test suite agree on, so that all writes succeed and all reads consistently observe every override, with no regressions to the currently passing behavior.

### Resolved Decision

The unification target is **Convention B as the Canonical Schema**. The project owner directed the team to "do whatever will work in the deployed version," and Convention B is selected for the following reasons:

- It is the richer model: slot-index addressing (`timetableId` + `slotIndex`), timezone-safe `effectiveDate` `Date` range queries, flat `newTime` / `newVenue` / `newFaculty` / `newDay` fields, plus provenance (`source`), a creating-user reference (`createdBy`), a `reason`, and a review flag (`flaggedForReview`).
- Two of the four Write Call Sites (`services/noticeDetector.js` and `services/timetableManager.js`) and the `Override_Test` already use Convention B, so the core runtime logic stays stable.
- The `overrideType` enumeration (`rescheduled`, `cancelled`, `room_changed`, `faculty_changed`) is retained.

Consequently, `routes/upload.js` and `routes/timetableRoutes.js` will be migrated to Convention B for both writes and reads.

Because this targets a **deployed database** that may already contain Convention A documents, the feature includes a one-time data migration that converts every existing Convention A document into Convention B fields without silently dropping any data. The migration mapping is:

- `date` (`YYYY-MM-DD` string) → `effectiveDate` (`Date`).
- `originalSlotId` (a `Timetable.slots._id`) → resolve to `timetableId` + `slotIndex` where the referenced slot can be located; where it cannot be resolved, preserve enough of the original identifying data on the migrated document to avoid silent omission.
- `newDetails.time` / `newDetails.venue` / `newDetails.faculty` → `newTime` / `newVenue` / `newFaculty`.
- `adminName` → retained or mapped onto the Canonical Schema's actor representation.
- `status` → mapped onto the Canonical Schema, with `pending_review` mapped to `flaggedForReview = true`.

IF a Convention A document cannot be losslessly mapped to Convention B, THEN it MUST NOT be silently dropped.

This resolution is captured in Requirement 7.

## Glossary

- **TimetableOverride**: The Mongoose model and MongoDB collection that stores a single, date-scoped change to one timetable slot without mutating the master `Timetable`.
- **Timetable**: The master weekly schedule model, keyed by `batchId` + `dayOfWeek`, containing an array of `slots`.
- **Slot**: An entry in `Timetable.slots` with `time`, `courseCode`, `courseName`, `venue`, `faculty`, and a Mongoose-assigned `_id`.
- **Convention A**: The field set `{ originalSlotId, date (YYYY-MM-DD string), overrideType, newDetails:{time,venue,faculty}, adminName, status }`.
- **Convention B**: The field set `{ timetableId, slotIndex, effectiveDate (Date), overrideType, newTime, newVenue, newFaculty, newDay, reason, createdBy, source, flaggedForReview }`.
- **Canonical Schema**: The single unified `TimetableOverride` schema selected by the Open Decision that all call sites will use after this feature is complete.
- **Write Call Sites**: The four code locations that create `TimetableOverride` documents: `routes/upload.js`, `routes/timetableRoutes.js`, `services/noticeDetector.js`, `services/timetableManager.js`.
- **Read Call Sites**: The code locations that query `TimetableOverride` documents: `routes/timetableRoutes.js` (GET my-timetable and GET batch/:batchId) and `services/timetableManager.js` (date-range override lookup).
- **Override_Test**: The test suite at `backend/tests/applyNoticeToTimetable.test.js`.
- **System**: The CampusFlow AI backend timetable override subsystem (model plus call sites) collectively.

## Requirements

### Requirement 1: Single Unified Override Schema

**User Story:** As a backend developer, I want one `TimetableOverride` schema that every call site agrees on, so that no override write is rejected by schema validation and the data shape is predictable.

#### Acceptance Criteria

1. THE System SHALL define exactly one `TimetableOverride` Mongoose schema in `backend/models/TimetableOverride.js`.
2. WHEN any Write Call Site creates a `TimetableOverride` using the Canonical Schema fields, THE System SHALL persist the document without raising a schema validation error.
3. THE TimetableOverride schema SHALL NOT declare a field as required if that field is unavailable at one or more Write Call Sites under the selected Canonical Schema.
4. THE TimetableOverride schema SHALL retain the `overrideType` enumeration values `rescheduled`, `cancelled`, `room_changed`, and `faculty_changed`.

### Requirement 2: Notice-Driven Temporary Overrides Persist Successfully

**User Story:** As an admin relying on AI notice detection, I want temporary overrides derived from notices to be saved, so that detected schedule changes actually take effect.

#### Acceptance Criteria

1. WHEN `applyNoticeToTimetable` processes a valid temporary notice that matches a timetable slot, THE System SHALL create a `TimetableOverride` document and increment the applied count by one.
2. WHEN a notice-driven temporary override is created, THE System SHALL record the originating timetable reference, the affected slot, the effective date, the override type, the changed values, the reason, the creating user, the provenance source, and the review flag on the persisted document.
3. IF a notice has an invalid affected date, THEN THE System SHALL skip the notice, increment the skipped count, record a descriptive error, and SHALL NOT create any `TimetableOverride` document for that notice.
4. IF a notice references a day with no timetable or a course code absent from the timetable slots, THEN THE System SHALL skip the notice, increment the skipped count, record a descriptive error, and SHALL NOT create any `TimetableOverride` document for that notice.

### Requirement 3: Admin Manager Temporary Overrides Persist Successfully

**User Story:** As an admin, I want `timetableManager.applyTempOverride` to save my single-date override, so that the master timetable stays intact while the specific date reflects my change.

#### Acceptance Criteria

1. WHEN `applyTempOverride` is invoked with a valid timetable, slot index, and effective date, THE System SHALL create a `TimetableOverride` document and return a success result containing the created override.
2. WHEN `applyTempOverride` creates an override, THE System SHALL leave the master `Timetable` document unchanged.
3. IF the override creation fails, THEN THE System SHALL return a result indicating failure together with the error reason.

### Requirement 4: Admin Route Override Creation Persists Successfully

**User Story:** As an admin using the timetable management API, I want `POST /api/timetable/override` and the upload-driven override creation to save overrides, so that manual and document-extracted overrides work end to end.

#### Acceptance Criteria

1. WHEN an authorized admin submits a valid request to `POST /api/timetable/override`, THE System SHALL create a `TimetableOverride` document and return a success response containing the override.
2. WHEN the upload pipeline in `routes/upload.js` creates a temporary override from an extracted notice, THE System SHALL persist the override without a schema validation error.
3. IF a request to create an override is made by a user who is not a batch owner or moderator, THEN THE System SHALL reject the request with an authorization failure and SHALL NOT create a `TimetableOverride`.

### Requirement 5: Consistent Override Reads Across Call Sites

**User Story:** As a student or admin viewing a timetable, I want every applicable override to appear regardless of which call site created it, so that the displayed schedule is accurate.

#### Acceptance Criteria

1. WHEN a Read Call Site queries overrides for a given batch and target date, THE System SHALL return every `TimetableOverride` whose batch and effective date match that query, irrespective of which Write Call Site created the override.
2. THE Read Call Sites and Write Call Sites SHALL identify an override's affected date using the same field and value representation defined by the Canonical Schema.
3. WHEN a Read Call Site queries overrides for a target date, THE System SHALL NOT return overrides whose effective date differs from the requested date.
4. THE System SHALL maintain a database index on the fields used by the Read Call Sites to filter overrides by batch and date.

### Requirement 6: No Regression in Verified Behavior

**User Story:** As a maintainer, I want the unification to fix the broken paths without breaking anything that currently works, so that overall verification status improves.

#### Acceptance Criteria

1. WHEN the backend test suite is executed after unification, THE Override_Test SHALL report all of its previously failing cases as passing.
2. WHEN the full backend test suite is executed after unification, THE System SHALL report no regression in the test cases that passed before the change.
3. WHEN `applyNoticeToTimetable` processes a permanent notice, THE System SHALL update or remove the master `Timetable` slot directly and SHALL NOT create a `TimetableOverride`.
4. WHEN any override or permanent change is applied, THE System SHALL continue to write the corresponding `TimetableAuditLog` entry as it did before the change.

### Requirement 7: Canonical Convention Decision and Migration

**User Story:** As the project owner, I want Convention B established as canonical and existing deployed data migrated into it, so that the unification is intentional and no override data is silently lost.

#### Acceptance Criteria

1. THE System SHALL adopt Convention B as the Canonical Schema, comprising `timetableId`, `slotIndex`, `effectiveDate` (`Date`), `overrideType`, `newTime`, `newVenue`, `newFaculty`, `newDay`, `reason`, `createdBy`, `source`, and `flaggedForReview`, and SHALL retain the `overrideType` enumeration values `rescheduled`, `cancelled`, `room_changed`, and `faculty_changed`.
2. THE System SHALL update `routes/upload.js` and `routes/timetableRoutes.js` so that both their write paths and read paths use only Canonical Schema (Convention B) fields.
3. WHERE existing Convention A `TimetableOverride` documents are present in the deployed database, THE System SHALL perform a one-time data migration that converts each such document to Convention B fields.
4. WHEN the migration converts a Convention A document, THE System SHALL map `date` (`YYYY-MM-DD` string) to `effectiveDate` (`Date`), map `newDetails.time` to `newTime`, map `newDetails.venue` to `newVenue`, map `newDetails.faculty` to `newFaculty`, map `adminName` to the Canonical Schema actor representation, and map `status` value `pending_review` to `flaggedForReview = true`.
5. WHEN the migration converts a Convention A document's `originalSlotId`, THE System SHALL resolve `originalSlotId` to `timetableId` plus `slotIndex` where the referenced slot can be located, and WHERE the slot cannot be resolved THE System SHALL preserve the original identifying data on the migrated document so that the document is not silently omitted.
6. IF an existing `TimetableOverride` document cannot be losslessly mapped to Convention B, THEN THE System SHALL NOT silently drop the document and SHALL retain it in a form that preserves its data.
7. WHERE a Canonical Schema field was not previously supplied by a migrated document or by a migrated call site, THE System SHALL define the value written for that field.
