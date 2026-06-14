# Schema Changes

All database schema additions for CampusFlow AI Phase 1, 2, and 3 features.

---

## `User` Collection
*(Added in Phase 1)*
- `phoneNumber` (String)
- `currentYear` (Number)
- `graduationYear` (Number)
- `tnpEmail` (String)
- `interests` ([String])
- `gmailRefreshToken` (String, encrypted)
- `gmailConnected` (Boolean)
- `profileComplete` (Boolean)

## `Batch` Collection
*(Added in Phase 1 & 2)*
- `status` (String enum: 'active'/'deleted')
- `deletedAt` (Date)
- `courses` (Array of `{ code, name, faculty }`) — *Feature 4*

## NEW: `PlacementNotice` Collection
*(Added in Phase 1 for Gmail Sync)*
Stores parsed emails, extracted eligibility criteria, and AI prep plans.

## NEW: `ExamSchedule` Collection
*(Added in Phase 2 for Exam Schedule)*
Stores batch-wise and course-wise exam dates/times uploaded via CSV.

```js
{
  batchId: ObjectId,
  courseCode: String,
  courseName: String,
  examDate: Date,
  examTime: String,
  venue: String,
}
```

## `Post` Collection
*(Added in Phase 2 for Upload Batch Selection)*
- `targetType` (String enum: 'batch'/'personal')
- `targetBatchId` (ObjectId)

## NEW: `Timetable` Collection
*(Added in Phase 3 for Timetable Management)*
Stores daily class slots for a specific batch.

```js
{
  batchId: ObjectId,
  dayOfWeek: String (enum: 'Monday' to 'Sunday'),
  slots: [{
    time: String,
    courseCode: String,
    courseName: String,
    venue: String,
    faculty: String,
  }],
}
// Unique index on { batchId: 1, dayOfWeek: 1 }
```
