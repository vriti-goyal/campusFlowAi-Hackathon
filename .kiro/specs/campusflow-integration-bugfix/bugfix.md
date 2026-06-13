# Bugfix Requirements Document

## Introduction

CampusFlow AI is a full-stack campus management application (Express + React/Vite, MongoDB Atlas, Firebase Auth, AWS S3/Textract/Bedrock). After Phase 1 and Phase 2 development, several integration-layer defects prevent the end-to-end flow from working correctly. These bugs span: field-name mismatches between the backend and frontend, broken identity references inside backend routes, missing UI resilience components (error boundary, loading spinner, global toast), a broken protected-route auth token interceptor, and the need to document any remaining known issues. All models already exist in canonical locations under `backend/models/`; no duplicate schema files were found, but several routes reference incorrect field names on those schemas.

The bugs collectively cause: silent 401/500 errors on API calls, placements always showing as "not eligible" regardless of user profile, the dashboard summary silently omitting results, calendar events not appearing for the logged-in user, the AI assistant failing to retrieve placement context correctly, and the UI crashing or silently failing on API errors with no visible feedback to the user.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug Group A — Broken identity references in backend routes**

1.1 WHEN `GET /api/placements` is called THEN the system looks up the user with `User.findOne({ uid: req.user.uid })` which returns `null` because the User model uses `firebaseUid` not `uid`, causing eligibility to always default to CGPA 0 / empty branch, making every user appear ineligible

1.2 WHEN `POST /api/assignments` or `POST /api/exams` creates a CalendarEvent THEN the system passes `userId: req.user.uid` (a Firebase UID string) but the `CalendarEvent.userId` field is typed as `ObjectId ref 'User'`, so the calendar event is stored with an invalid/null userId and never returned when `GET /api/calendar/events` queries by `userId: req.user._id`

1.3 WHEN `POST /api/placements` creates a CalendarEvent THEN the system passes `userId: req.user.uid` (Firebase UID string) for the same `ObjectId` field, producing the same broken calendar-event ownership bug described in 1.2

1.4 WHEN `POST /api/upload/finalize` creates CalendarEvents for assignments, exams, and placements THEN the system passes `userId: req.user.uid` (Firebase UID string) instead of `req.user._id` (MongoDB ObjectId), so those calendar events are also never returned to the correct user

1.5 WHEN `GET /api/placements/:id/apply` upserts a `StudentPlacementStatus` record THEN the system uses `studentId: req.user.uid` (Firebase UID string) but the `StudentPlacementStatus` model defines `userId` (not `studentId`) typed as `ObjectId`, so the record is created with wrong field names and the eligibility/apply flow is entirely broken

1.6 WHEN `GET /api/ai/ask` gathers placement context via `StudentPlacementStatus.find({ studentId: firebaseUid })` THEN the system uses `studentId` which does not exist on that model (the field is `userId`), so applied placements are never filtered out and the AI context is incorrect

1.7 WHEN `GET /api/dashboard/summary` queries assignments and exams THEN the system filters by `userId` but `Assignment.userId` and `Exam.userId` are set to `req.user._id` only when created via the direct POST routes — assignments and exams created through `finalize.js` do not set `userId` at all, so the dashboard silently returns fewer items than expected

**Bug Group B — Mismatched API field names / response shapes**

1.8 WHEN `GET /api/batch/my-batches` returns a batch list THEN the system spreads `m.batchId.toObject()` but the spread can lose the `_id` field or produce `null` if `batchId` is not populated, causing downstream `selectedBatch._id` calls in Community and Dashboard pages to fail

1.9 WHEN `GET /api/dashboard/summary` runs THEN the system reads `data.counts?.urgent` in the `urgentAlerts` section heading, but the response key is `counts.urgent` only if `urgentAlerts.length > 0`; however `Dashboard.jsx` also references `ClipboardList`, `BookOpen`, and `Briefcase` icons that are imported in inline JSX but never imported at the top of the file, causing a React render crash

1.10 WHEN `GET /api/ai/daily-digest` returns THEN the backend returns `{ digestText }` but `Dashboard.jsx` destructures `{ greeting, summaryLines, recommendedAction }` from `res.data`, so the Daily Digest section on the Dashboard always renders empty/undefined

1.11 WHEN `POST /api/upload/text` or `/file` returns THEN the upload result uses the `ok()` helper which wraps data as `{ success: true, data: { post, extraction } }`, but `Upload.jsx` reads `res.data.data` which is correct — however `finalize.js` returns `ok(res, { post, entry, category })` and `Upload.jsx` reads `result.extraction` from the stored state (which came from the upload step), not from finalize; the finalize response is never used to update the stored extraction, so an edited extraction is never persisted

1.12 WHEN `GET /api/posts/:batchId` is called THEN the route tries to populate `uploadedBy` as an ObjectId ref, but `Post.uploadedBy` is typed as `String` (Firebase UID), so `.populate('uploadedBy', 'name email role')` does nothing and `post.uploadedBy?.name` is always undefined in the Community feed

**Bug Group C — Missing frontend resilience components**

1.13 WHEN any API call in any React page throws an unhandled error or returns a non-2xx response THEN the system has no global React error boundary, so component-level exceptions propagate to a blank white screen with no user feedback

1.14 WHEN any API call fails THEN the system has no global toast/snackbar notification mechanism; pages either call `alert()` (browser native), silently swallow the error in a catch block, or log to console — giving no consistent in-app user feedback

1.15 WHEN data is being fetched on any page THEN multiple pages (Assignments, Exams, Placements) have inconsistent or missing loading indicators; some use a local `<Loader2>` spinner and others show nothing, so the UI appears broken during slow network calls

**Bug Group D — Broken protected routes / auth token not always attached**

1.16 WHEN the Firebase auth token expires and `onAuthStateChanged` fires with a refreshed token THEN the system calls `setAuthToken(token)` in `AuthContext` which updates `api.defaults.headers.common['Authorization']`, but this does NOT automatically refresh the token before it expires (Firebase tokens expire after 1 hour); pages that were opened before token refresh never re-attach the new token via an axios request interceptor, causing 401 errors mid-session

1.17 WHEN a user navigates directly to any protected route (e.g. `/dashboard`) before the Firebase `onAuthStateChanged` has resolved THEN `loading` is `true` and `PrivateRoute` renders a plain text "Loading…" div with no spinner and no branded loading state, which is inconsistent with the rest of the UI

---

### Expected Behavior (Correct)

**Bug Group A — Broken identity references**

2.1 WHEN `GET /api/placements` is called THEN the system SHALL look up the user with `User.findOne({ firebaseUid: req.user.firebaseUid })` (or use `req.user` directly, since `verifyFirebaseToken` already attaches the full MongoDB User document as `req.user`) so that `userCgpa` and `userBranch` are populated correctly and eligibility is computed accurately

2.2 WHEN any route creates a `CalendarEvent` THEN the system SHALL pass `userId: req.user._id` (the MongoDB ObjectId from the already-attached `req.user` document) so the event is stored with the correct owner and returned on `GET /api/calendar/events`

2.3 WHEN `POST /api/placements/:id/apply` upserts a `StudentPlacementStatus` record THEN the system SHALL use the correct field name `userId: req.user._id` matching the model schema, and the dashboard and AI routes that query this model SHALL also use `userId` not `studentId`

2.4 WHEN `POST /api/upload/finalize` creates domain entries (Assignment, Exam, Placement) THEN the system SHALL set `userId: req.user._id` on each created record so the dashboard can correctly query them by `userId`

2.5 WHEN `GET /api/ai/ask` filters applied placements THEN the system SHALL query `StudentPlacementStatus.find({ userId: req.user._id })` using the correct field name and MongoDB ObjectId

**Bug Group B — Mismatched API field names / response shapes**

2.6 WHEN `GET /api/batch/my-batches` populates batch documents THEN the system SHALL return an array where each element contains a valid `_id` and all batch fields, so that `selectedBatch._id` is always defined in the frontend

2.7 WHEN `Dashboard.jsx` renders THEN it SHALL import all icons it uses (`ClipboardList`, `BookOpen`, `Briefcase` from `lucide-react`) so it does not crash with a ReferenceError

2.8 WHEN `GET /api/ai/daily-digest` returns THEN the backend SHALL return `{ greeting, summaryLines, recommendedAction }` parsed from the Bedrock response, OR `Dashboard.jsx` SHALL be updated to display `digestText` as a plain string, so the Digest card renders actual content

2.9 WHEN `GET /api/posts/:batchId` is called THEN the `Post.uploadedBy` field SHALL be typed as `ObjectId ref 'User'` (consistent with all other models), and the upload routes SHALL store `uploadedBy: req.user._id` instead of `req.user.uid`, so `.populate()` works and author names appear in the Community feed

**Bug Group C — Frontend resilience**

2.10 WHEN a React component throws an unhandled exception THEN the system SHALL render a global `ErrorBoundary` component that catches the error and shows a user-friendly fallback UI with a "Reload" button, preventing a completely blank screen

2.11 WHEN any API call fails with a non-2xx response or network error THEN the system SHALL display a dismissible toast notification with the error message via a global `ToastProvider` and axios response interceptor, so users always receive visible feedback

2.12 WHEN data is being fetched on any page THEN the system SHALL render a consistent `<Spinner>` component (centered `Loader2` icon) during loading states, used uniformly across all pages

**Bug Group D — Auth token / protected routes**

2.13 WHEN a Firebase ID token is about to expire or has expired THEN the system SHALL use an axios request interceptor that calls `firebaseUser.getIdToken(true)` (force-refresh) before each request and attaches the fresh token, so 401 errors mid-session do not occur

2.14 WHEN a user navigates to a protected route while `loading` is `true` THEN the system SHALL render a branded full-screen `<Spinner>` component (consistent with 2.12) rather than a plain text string

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a valid Firebase ID token is present in `Authorization: Bearer <token>` THEN the system SHALL CONTINUE TO verify it via Firebase Admin SDK and attach the MongoDB User document as `req.user`

3.2 WHEN a user with no existing MongoDB record signs in with Google for the first time THEN the system SHALL CONTINUE TO auto-create the User document in `verifyFirebaseToken` middleware

3.3 WHEN a batch owner creates a batch THEN the system SHALL CONTINUE TO generate a unique `batchCode`, create the Batch document, and auto-add the owner as a `BatchMember` with role `owner`

3.4 WHEN a user submits valid text or a file through the Upload page THEN the system SHALL CONTINUE TO run the AI pipeline (Bedrock extraction), create a `Post`, and return `{ post, extraction }` for the review card

3.5 WHEN the user clicks Confirm on the review card THEN the system SHALL CONTINUE TO call `POST /api/upload/finalize`, mark the Post as verified, and create the appropriate domain entry (Assignment / Exam / Placement)

3.6 WHEN a placement record is created with a deadline THEN the system SHALL CONTINUE TO create a linked CalendarEvent (with the corrected `userId` fix from 2.2)

3.7 WHEN a unauthenticated user visits any protected route THEN the system SHALL CONTINUE TO redirect them to `/login` via the `PrivateRoute` component

3.8 WHEN `POST /api/batch/join` is called with a valid batch code THEN the system SHALL CONTINUE TO add the user as a `BatchMember` with role `member`

3.9 WHEN `GET /api/ai/ask` is called THEN the system SHALL CONTINUE TO call AWS Bedrock with the built prompt and return `{ answer, sources }`, storing the exchange in `AIChatHistory`

3.10 WHEN `GET /api/dashboard/summary` runs THEN the system SHALL CONTINUE TO aggregate assignments, exams, active placements, and calendar events into `focusItems` and `urgentAlerts`, sorted by deadline

3.11 WHEN posts are fetched for the Community feed THEN the system SHALL CONTINUE TO sort by `isPinned: -1, createdAt: -1` and support filtering by `category` query param

3.12 WHEN `PATCH /api/users/me` is called THEN the system SHALL CONTINUE TO update only the fields in the `allowedUpdates` whitelist

---

## Bug Condition Summary (Pseudocode)

```pascal
// Bug Condition A: Wrong user field references in backend routes
FUNCTION isBugConditionA(route, fieldRef)
  RETURN fieldRef IN { "req.user.uid", "studentId: req.user.uid", "userId: req.user.uid (on String-typed field)" }
END FUNCTION

FOR ALL route WHERE isBugConditionA(route, fieldRef) DO
  result ← route'(request)
  ASSERT result.statusCode != 401
  ASSERT result.data.eligibilityStatus is derived from actual user profile
  ASSERT CalendarEvent.userId = req.user._id (ObjectId)
  ASSERT StudentPlacementStatus.userId = req.user._id (ObjectId)
END FOR

// Preservation Checking
FOR ALL route WHERE NOT isBugConditionA(route, fieldRef) DO
  ASSERT F(route) = F'(route)  // Behavior unchanged for already-correct routes
END FOR

// Bug Condition B: Missing icon imports / mismatched response shapes
FUNCTION isBugConditionB(component)
  RETURN component uses undeclared identifiers OR reads wrong response keys
END FUNCTION

FOR ALL component WHERE isBugConditionB(component) DO
  result ← render'(component)
  ASSERT no ReferenceError is thrown
  ASSERT UI sections render with actual data
END FOR

// Bug Condition C: No error boundary / no toast / inconsistent spinner
FUNCTION isBugConditionC(apiError)
  RETURN apiError is unhandled AND no global boundary exists
END FUNCTION

FOR ALL apiError WHERE isBugConditionC(apiError) DO
  ASSERT ErrorBoundary catches React render errors and shows fallback UI
  ASSERT toast notification is displayed for API errors
  ASSERT Spinner is shown during loading
END FOR
```
