# Implementation Plan: Timetable Override Schema Unification

## Overview

This plan unifies the `TimetableOverride` model and all of its call sites onto **Convention B**
(the Canonical Schema). The work proceeds incrementally: first the schema is rewritten so every
write call site validates, then the two Convention A call sites (`timetableRoutes.js`,
`upload.js`) are migrated, then the one-time idempotent/lossless data-migration script is built,
then the single frontend consumer is updated, and finally property-based and example/smoke tests
verify the correctness properties. A closing checkpoint runs the full backend and frontend suites
and confirms the four previously failing `applyNoticeToTimetable` cases pass with no regressions.

Property-based tests use `fast-check` with a minimum of 100 iterations
(`fc.assert(..., { numRuns: 100 })`) backed by in-memory MongoDB (`mongodb-memory-server`,
already used by the suite). Each property test carries the tag comment
`// Feature: timetable-override-schema-unification, Property {n}: {property text}`.

## Tasks

- [ ] 1. Rewrite the `TimetableOverride` model to the Convention B Canonical Schema
  - Rewrite `backend/models/TimetableOverride.js` to declare only Convention B fields:
    `batchId`, `timetableId`, `slotIndex`, `effectiveDate` (Date), `overrideType` (enum),
    `newTime`, `newVenue`, `newFaculty`, `newDay`, `reason`, `createdBy`, `source`,
    `flaggedForReview`.
  - Apply the required-flag rationale from the design: `batchId`, `timetableId`, `slotIndex`,
    `effectiveDate`, `overrideType` are `required: true`; `createdBy` is NOT required (migrated
    Convention A docs only carried `adminName`); `newTime`/`newVenue`/`newFaculty`/`newDay`
    default `null`; `reason` defaults `''`; `source` defaults `'admin'`; `flaggedForReview`
    defaults `false`.
  - Retain the `overrideType` enum values `rescheduled`, `cancelled`, `room_changed`,
    `faculty_changed`.
  - Add the two migration-preservation fields `legacyOriginalSlotId` (ObjectId, default
    `undefined`) and `migrationUnresolved` (Boolean, default `undefined`).
  - Add `{ timestamps: true }` and the two indexes:
    `{ batchId: 1, effectiveDate: 1 }` and `{ batchId: 1, timetableId: 1, slotIndex: 1 }`.
  - Keep the exported model name `TimetableOverride` so no importer changes its import.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.4, 7.1_

  - [ ]* 1.1 Write schema smoke / example tests
    - Assert exactly one schema is defined and all Convention B paths are present.
    - Assert the `overrideType` enum accepts the four values and rejects an out-of-enum value.
    - Assert `schema.indexes()` contains `{ batchId: 1, effectiveDate: 1 }`.
    - _Requirements: 1.1, 1.4, 5.4, 7.1_

  - [ ]* 1.2 Write property test for write-payload schema validity
    - **Property 1: Every write call site's payload is schema-valid** — for any valid Convention B
      payload from the union of the four write call sites' field subsets (including omitted
      optional fields, `null` new* fields, and `slotIndex` of `0`), `validateSync()` returns no
      error.
    - Use `fast-check` with `{ numRuns: 100 }`; override-payload generator with required fields
      always present and optional fields randomly present/absent/`null`.
    - **Validates: Requirements 1.2, 1.3, 4.2, 7.2**

- [ ] 2. Migrate `routes/timetableRoutes.js` to Convention B (writes and reads)
  - [ ] 2.1 Convert `POST /override` to Convention B create
    - Read `{ batchId, timetableId, slotIndex, effectiveDate, overrideType, newTime, newVenue,
      newFaculty, newDay, reason }` from `req.body`.
    - Create the override with `createdBy: req.user._id`, `source: 'admin'`,
      `flaggedForReview: false`.
    - Preserve the existing `requireAdmin(batchId, req.user._id)` authorization check.
    - Preserve the `TimetableLog` audit write, adjusting its description to reference
      `timetableId` / `slotIndex` / `effectiveDate`.
    - Keep the `{ message, override }` response envelope.
    - _Requirements: 4.1, 4.3, 6.4, 7.2_

  - [ ] 2.2 Convert `GET /my-timetable` and `GET /batch/:batchId` reads to the canonical Date-range query
    - Replace the `{ date: reqDate (string), status: 'active' }` filter with the canonical
      pattern: compute `startOfDay`/`endOfDay` from the requested date and query
      `{ batchId (or $in), effectiveDate: { $gte: startOfDay, $lte: endOfDay } }`.
    - Continue returning `{ timetables, overrides }` with the `overrides` array now holding
      Convention B documents (slot↔override matching stays on the frontend).
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 2.3 Write property test for date-range read filtering
    - **Property 2: Reads return exactly the overrides for the queried date** — for any batch and
      any set of overrides with arbitrary `effectiveDate` and `source`, the Read Call Site filter
      returns every override whose `effectiveDate` falls within the target day and none outside it.
    - Use `fast-check` `{ numRuns: 100 }` with in-memory MongoDB; override-set generator spreads
      `effectiveDate` across a range of days with random `source`.
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ]* 2.4 Write example tests for the override route
    - Authorized admin creates a Convention B override and receives `{ message, override }`; a
      `TimetableLog` entry is written; non-admin receives 403 with zero documents created.
    - GET `/my-timetable` and `/batch/:batchId`: with overrides on and off the target date, the
      `overrides` array contains exactly the in-range Convention B docs.
    - Use in-memory MongoDB (`mongodb-memory-server`).
    - _Requirements: 4.1, 4.3, 5.1, 6.4_

- [ ] 3. Migrate `routes/upload.js` temporary-override branch to Convention B
  - In the `timetable_update` block, when locating `targetSlot`, also capture `targetTimetable`
    (the `tt` document) and `targetSlotIndex` (the matched slot's index within `tt.slots`).
  - For `change_type === 'temporary'`, replace the Convention A `TimetableOverride.create(...)`
    with Convention B: `{ batchId, timetableId: targetTimetable._id, slotIndex: targetSlotIndex,
    effectiveDate: new Date(update.date), overrideType: update.override_type,
    newTime: update.new_details?.time || null, newVenue: update.new_details?.venue || null,
    newFaculty: update.new_details?.faculty || null, newDay: null, reason: update.reason || '...',
    createdBy: req.user._id, source: 'notice_ai', flaggedForReview: true }`.
  - Preserve the permanent branch unchanged, the `Notification.insertMany` dispatch, and both
    `TimetableLog` writes.
  - _Requirements: 4.2, 6.4, 7.2_

  - [ ]* 3.1 Write example test for the upload temporary branch
    - With a seeded timetable, an extracted update creates a Convention B override
      (`source: 'notice_ai'`, `flaggedForReview: true`, resolved `timetableId`/`slotIndex`); the
      notification is dispatched; the `TimetableLog` entry is written.
    - Use in-memory MongoDB.
    - _Requirements: 4.2, 6.4, 7.2_

- [ ] 4. Create the one-time data-migration script `backend/scripts/migrateTimetableOverrides.js`
  - Standalone ESM Node script that connects to MongoDB (reusing `config/db.js` connection
    string), loads all `TimetableOverride` documents via `.lean()` over the raw collection so
    Convention A fields are still readable.
  - Detect convention: documents already having `effectiveDate` (Date) + `timetableId` are
    already Convention B and are skipped (idempotence); documents with `date` string and/or
    `originalSlotId` are converted.
  - Convert: `effectiveDate = new Date(\`${date}T00:00:00\`)`;
    `newTime/newVenue/newFaculty = newDetails?.time/venue/faculty || null`; `newDay = null`;
    preserve `reason` and prefix `adminName` text
    (`[migrated from adminName: ...]`); `source = 'admin'` unless `adminName` matches `/AI/i`
    (then `'notice_ai'`); `flaggedForReview = (status === 'pending_review')`.
  - Resolve `originalSlotId` → `timetableId` + `slotIndex` by scanning `Timetable` docs for the
    batch and matching the slot subdocument `_id`. Resolved: set both, unset Convention A fields.
    Unresolved: set `migrationUnresolved = true`, `legacyOriginalSlotId = originalSlotId`, leave
    `timetableId`/`slotIndex` unset, and retain (never delete) the document.
  - Persist each conversion with a raw `updateOne({ _id }, { $set, $unset })`; wrap each document
    in try/catch, count failures, continue; log `{ scanned, converted, alreadyB, unresolved }`;
    exit non-zero only on connection/fatal errors.
  - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 4.1 Write property test for lossless resolve-or-preserve migration
    - **Property 3: Migration is lossless and resolves or preserves every document** — for any
      corpus of Convention A docs (some with `originalSlotId` matching a real slot, some not),
      migration leaves total doc count unchanged, converts every doc to Convention B, sets
      `timetableId`+`slotIndex` for resolvable docs, and retains unresolvable docs with
      `legacyOriginalSlotId` set and `migrationUnresolved = true`.
    - Use `fast-check` `{ numRuns: 100 }` with in-memory MongoDB; Convention A corpus generator
      with real slot `_id`s (resolvable) and random unused ObjectIds (unresolvable).
    - **Validates: Requirements 7.3, 7.5, 7.6**

  - [ ]* 4.2 Write property test for migration field mapping and defaults
    - **Property 4: Migration field mapping and defaults are correct** — for any Convention A doc,
      the migrated doc has `effectiveDate` equal to the Date parsed from `date`;
      `newTime/newVenue/newFaculty` equal `newDetails.*` (or `null`);
      `flaggedForReview === (status === 'pending_review')`; the `adminName` text preserved on the
      document; and `source`/`newDay`/`flaggedForReview` defined rather than undefined.
    - Use `fast-check` `{ numRuns: 100 }` with in-memory MongoDB.
    - **Validates: Requirements 7.4, 7.7**

  - [ ]* 4.3 Write property test for migration idempotence
    - **Property 5: Migration is idempotent** — for any collection of `TimetableOverride`
      documents, running the migration twice yields the same collection state as running it once.
    - Use `fast-check` `{ numRuns: 100 }` with in-memory MongoDB.
    - **Validates: Requirements 7.3**

- [ ] 5. Update the frontend consumer `frontend/src/pages/Timetable.jsx`
  - Change slot↔override matching from `overrides.find(o => o.originalSlotId === slot._id)` to
    `overrides.find(o => o.timetableId === todayTimetable._id && o.slotIndex === originalIndex)`,
    using the original (pre-sort) slot index computed from the unsorted `todayTimetable.slots`
    (not the post-sort `idx`), with strict `===` index comparison so `slotIndex === 0` is not
    dropped.
  - Replace `override.newDetails?.time/venue/faculty` with the flat
    `override.newTime/newVenue/newFaculty` in `displayTime`/`displayVenue`/`displayFaculty`.
  - Leave `override.overrideType` and `override.reason` usage unchanged.
  - _Requirements: 5.1, 5.2_

- [ ] 6. Checkpoint - core implementation and read/write consistency
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Add property tests for the unchanged Convention B service behavior
  - [ ]* 7.1 Write property test for permanent-notice behavior
    - **Property 6: Permanent notices mutate the master timetable and create no override** — for
      any permanent notice (any `overrideType`, including `cancelled`) matching a generated
      timetable slot, processing creates zero `TimetableOverride` docs and mutates the master
      `Timetable` (slot removed for `cancelled`, otherwise changed fields updated and
      `lastPermanentUpdateAt`/`By` set).
    - Target `applyNoticeToTimetable` (permanent path); `fast-check` `{ numRuns: 100 }` with
      in-memory MongoDB; permanent-notice generator.
    - **Validates: Requirements 6.3**

  - [ ]* 7.2 Write property test for temporary-override non-mutation
    - **Property 7: Temporary override leaves the master timetable unchanged** — for any valid
      temporary override applied via `applyTempOverride` to a generated timetable slot, the
      referenced master `Timetable` document's `slots` remain unchanged after the override is
      created.
    - Target `timetableManager.applyTempOverride`; `fast-check` `{ numRuns: 100 }` with in-memory
      MongoDB; temp-override generator.
    - **Validates: Requirements 3.2**

- [ ] 8. Final checkpoint - full-suite verification and no-regression confirmation
  - Run the full backend test suite (`npm test` in `backend/`, single-run mode) and confirm the
    four previously failing `applyNoticeToTimetable.test.js` cases now pass.
  - Run the frontend test suite (single-run mode) and confirm `Timetable.jsx` consumes Convention
    B overrides correctly.
  - Confirm zero regressions across the previously passing suites (`noticeDetector`,
    `timetableManager`, `courseFilter`, `documentRouter`, preservation,
    `bugConditionExploration`).
  - Ensure all tests pass, ask the user if questions arise.
  - _Requirements: 6.1, 6.2_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; they are
  never implemented automatically when running a parent task.
- Each task references specific requirements (granular sub-requirement clauses) for traceability.
- Property tests use `fast-check` with `{ numRuns: 100 }` minimum, backed by in-memory MongoDB
  (`mongodb-memory-server`), and carry the
  `// Feature: timetable-override-schema-unification, Property {n}: {property text}` tag comment.
- Property → test mapping: P1→1.2, P2→2.3, P3→4.1, P4→4.2, P5→4.3, P6→7.1, P7→7.2.
- The Convention B services (`noticeDetector.js`, `timetableManager.js`) are intentionally not
  modified; the Override_Test flips from failing to passing purely via the schema fix.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["1.1", "1.2", "2.1", "3", "4", "5", "7.1", "7.2"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["2.3", "2.4"] }
  ]
}
```
