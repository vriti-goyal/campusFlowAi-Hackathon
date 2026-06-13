# CampusFlow Integration Bugfix Design

## Overview

This document formalises the fix strategy for four groups of integration-layer defects in CampusFlow AI.
The defects share a common root pattern: code was written assuming `req.user` would carry a Firebase UID string (`.uid`), but the `verifyFirebaseToken` middleware already resolves and attaches the full MongoDB User document — so `req.user._id` is always available and is the correct ObjectId to pass to every schema field typed as `ObjectId ref 'User'`.

A secondary pattern is API contract drift: the frontend was written against a slightly different response shape than the backend produces, and several frontend components reference symbols that were never imported.

The fix strategy is intentionally surgical: change the smallest number of lines in each file to align field names, swap `req.user.uid` → `req.user._id` everywhere an ObjectId is expected, update the AI digest response shape, correct the Post schema, add the three missing UI resilience components (ErrorBoundary, Toast, Spinner), and wire up an axios request interceptor for token refresh.

---

## Glossary

- **Bug_Condition (C)**: The logical predicate that is true for an input that triggers one of the four bug groups.
- **Property (P)**: The desired runtime behaviour when the bug condition holds — what the fixed system must produce.
- **Preservation**: Correct existing behaviours that must be completely unchanged after all fixes are applied.
- **req.user**: The MongoDB `User` document attached by `verifyFirebaseToken`; `req.user._id` is a Mongoose ObjectId, `req.user.firebaseUid` is the Firebase UID string.
- **verifyFirebaseToken**: `backend/middleware/auth.js` — verifies a Bearer token with Firebase Admin, then fetches (or creates) the MongoDB User and attaches it as `req.user`.
- **CalendarEvent.userId**: Typed as `ObjectId ref 'User'` in `backend/models/CalendarEvent.js`; must always receive `req.user._id`.
- **StudentPlacementStatus.userId**: Typed as `ObjectId ref 'User'` in `backend/models/StudentPlacementStatus.js`; model has no `studentId` field.
- **Post.uploadedBy**: Currently typed as `String` in `backend/models/Post.js`; must be changed to `ObjectId ref 'User'` so `.populate()` works.
- **digestText**: The raw string currently returned by `POST /api/ai/daily-digest`; must be parsed into structured fields the Dashboard expects.
- **ErrorBoundary**: A React class component that wraps the entire app and catches render-time exceptions.
- **ToastProvider**: A context+hook that exposes a `toast(message)` function; wired to an axios response interceptor for automatic error toasts.
- **Spinner**: A shared `<Loader2 className="animate-spin" />` component used uniformly across all loading states.

---

## Bug Details

### Bug Condition

All four bug groups share a unifying characteristic: a route or component uses the **wrong identifier or field name** when referencing a user or a response payload.

**Formal Specification:**

```
FUNCTION isBugCondition(context)
  INPUT: context — one of {routeCall, componentRender, apiResponse, authState}
  OUTPUT: boolean

  IF context is routeCall THEN
    RETURN (
      context.fieldUsed IN {"req.user.uid", "studentId: req.user.uid"}
      AND context.schemaFieldExpected IN {"userId: ObjectId", "firebaseUid"}
    )
  END IF

  IF context is componentRender THEN
    RETURN (
      context.symbolUsed IN {"ClipboardList", "BookOpen", "Briefcase"}
      AND context.symbolImported = false
    )
    OR (
      context.responseKeyRead IN {"greeting", "summaryLines", "recommendedAction"}
      AND context.responseKeyActual = "digestText"
    )
    OR (
      context.loadingState = true
      AND context.renderedElement = "plain text div"
    )
  END IF

  IF context is apiResponse THEN
    RETURN (
      context.populateField = "uploadedBy"
      AND context.fieldType = "String"   // not ObjectId
    )
  END IF

  IF context is authState THEN
    RETURN (
      context.tokenAge > 50_minutes
      AND context.interceptorPresent = false
    )
  END IF

  RETURN false
END FUNCTION
```

### Examples

**Group A examples:**
- `GET /api/placements` — `User.findOne({ uid: req.user.uid })` returns `null`; `userCgpa = 0`; every user is computed as ineligible even with CGPA 8.5.
- `POST /api/assignments` — `CalendarEvent.create({ userId: req.user.uid, ... })` stores a string where MongoDB expects an ObjectId; `GET /api/calendar/events?userId=<ObjectId>` never matches.
- `POST /api/placements/:id/apply` — upserts `StudentPlacementStatus` with `{ studentId: req.user.uid }` but the model has no `studentId` index; the unique index on `{ userId, placementId }` is never hit.
- `POST /api/upload/finalize` — creates Assignment without `userId`; `GET /api/dashboard/summary` filters `Assignment.find({ userId: req.user._id })` and returns 0 results even though assignments exist.

**Group B examples:**
- `Dashboard.jsx` line ~120: `<ClipboardList size={20} />` — ReferenceError crash because `ClipboardList` is not in the `import … from 'lucide-react'` statement.
- `setDigest(res.data)` stores `{ digestText: "Good morning Vriti…" }`; template renders `{digest.greeting}` which is `undefined`.
- `GET /api/posts/:batchId` `.populate('uploadedBy', 'name email role')` silently no-ops; `post.uploadedBy?.name` is always `undefined`.

**Group C examples:**
- Any page throws a TypeError in render; no ErrorBoundary exists; entire app goes white with an unreadable stack trace.
- `POST /api/ai/ask` fails with 500; `catch (err) { console.error(err) }` swallows the error with no visible feedback.

**Group D examples:**
- User keeps a tab open for 65 minutes; cached `api.defaults.headers.common['Authorization']` holds an expired token; next request returns 401.
- User navigates directly to `/dashboard`; `PrivateRoute` renders `<div>Loading…</div>` as plain unstyled text.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviours:**
- Firebase token verification via Firebase Admin SDK must continue to work as before.
- Auto-creation of a new MongoDB User document on first Google sign-in must continue.
- All existing GET routes (assignments, exams, placements list, calendar, batch, posts) must continue to return correct data.
- The AI assistant (`POST /api/ai/ask`) must continue to call Bedrock and return `{ answer, sources }`.
- The upload flow (text → AI pipeline → review card → finalize) must continue to work end-to-end.
- Batch creation, join, and member listing must continue to work correctly.
- The `PrivateRoute` redirect of unauthenticated users to `/login` must continue.
- All PATCH/status update routes must continue to work.

**Scope:**
All code paths that do NOT involve the incorrect field references, the missing icon imports, or the absent UI components should be completely unaffected. This includes: every route that already uses `req.user._id`, all non-calendar-event data storage, all frontend pages other than Dashboard's digest card, and all non-placement-apply interactions.

---

## Hypothesized Root Cause

### Group A — Identity field mismatch

1. **`verifyFirebaseToken` contract not documented at call sites**: The middleware resolves a full MongoDB User document and attaches it as `req.user`, but several route handlers were written as if `req.user` was the raw Firebase decoded token (which has a `.uid` string). The extra `User.findOne({ uid: ... })` call in `placements.js` GET suggests the author did not know `req.user` was already the DB user.

2. **`StudentPlacementStatus` field renamed during schema design**: The model was originally drafted with a `studentId` concept but the final schema uses `userId`. The routes were never updated.

3. **`finalize.js` created without userId field**: Assignments and exams created through finalize omit `userId` because the finalize route was likely authored before the dashboard query that relies on it.

### Group B — API contract drift

4. **Digest endpoint written to return raw text**: The `buildDigestPrompt` result is a freeform paragraph from Bedrock. The backend returns it as `{ digestText }` (simplest thing). The Dashboard was built against a planned structured response `{ greeting, summaryLines, recommendedAction }` that was never implemented in the backend.

5. **Icon imports not added incrementally**: The `ClipboardList`, `BookOpen`, and `Briefcase` icons were added to JSX during UI development but the import line at the top of `Dashboard.jsx` was never updated.

6. **`Post.uploadedBy` typed as String for flexibility**: An early pragmatic decision to store the Firebase UID avoided a join, but the Community feed then tried to `.populate()` it assuming it was an ObjectId, which silently fails.

### Group C — No resilience layer

7. **Resilience components deferred**: Error boundary, toast system, and spinner were planned but not implemented. Pages use `alert()` or `console.error()` as stopgaps.

### Group D — Token refresh not wired

8. **Token refresh left as a TODO**: `AuthContext` calls `getIdToken()` once on `onAuthStateChanged`, but there is no axios interceptor to force-refresh before each request. `api.defaults.headers` is a static assignment; it does not refresh the token dynamically.

---

## Correctness Properties

Property 1: Bug Condition A — CalendarEvent userId is always ObjectId

_For any_ API request that creates a `CalendarEvent` (assignments, exams, placements, or finalize routes), the fixed code SHALL store `userId: req.user._id` (MongoDB ObjectId) so that `GET /api/calendar/events` returns those events for the correct user.

**Validates: Requirements 2.2**

Property 2: Bug Condition A — StudentPlacementStatus uses userId field

_For any_ call to `POST /api/placements/:id/apply` or any `StudentPlacementStatus` query in `aiRoutes.js`, the fixed code SHALL use the field name `userId` (matching the schema) with value `req.user._id` (ObjectId), ensuring the unique index is respected and placement-apply state is queryable.

**Validates: Requirements 2.3, 2.5**

Property 3: Bug Condition B — Axios response interceptor displays toast for errors

_For any_ axios response with HTTP status ≥ 400, the fixed frontend SHALL invoke the global toast system to display a visible, dismissible error notification, ensuring no API failure is silently swallowed.

**Validates: Requirements 2.11**

Property 4: Bug Condition D — Axios request interceptor attaches fresh token

_For any_ outgoing axios request while a Firebase user is authenticated, the fixed request interceptor SHALL call `firebaseUser.getIdToken(true)` and attach the resulting token as the `Authorization: Bearer` header, ensuring requests never carry an expired token.

**Validates: Requirements 2.13**

---

## Fix Implementation

### Changes Required

#### File: `backend/routes/placements.js`

**Function**: `GET /`

**Specific Changes**:
1. **Remove redundant user lookup**: Delete `const user = await User.findOne({ uid: req.user.uid })` and replace `userCgpa` / `userBranch` reads with `req.user.cgpa` and `req.user.branch` (the middleware already attached the full user document).
2. **Fix CalendarEvent userId** in `POST /`: Change `userId: req.user.uid` → `userId: req.user._id`.
3. **Fix StudentPlacementStatus field names** in `GET /` status query: Change `StudentPlacementStatus.find({ studentId: req.user.uid })` → `StudentPlacementStatus.find({ userId: req.user._id })`.
4. **Fix StudentPlacementStatus upsert** in `POST /:id/apply`: Replace all occurrences of `studentId: req.user.uid` and `applicationStatus` with `userId: req.user._id` and `status` (matching schema enum).

#### File: `backend/routes/assignments.js`

**Function**: `POST /`

**Specific Changes**:
1. **Fix CalendarEvent userId**: Change `userId: req.user.uid` → `userId: req.user._id`.

#### File: `backend/routes/exams.js`

**Function**: `POST /`

**Specific Changes**:
1. **Fix CalendarEvent userId**: Change `userId: req.user.uid` → `userId: req.user._id`.

#### File: `backend/routes/finalize.js`

**Function**: `POST /finalize`

**Specific Changes**:
1. **Fix CalendarEvent userId** in all three branches (assignment, exam, placement): Change `userId: req.user.uid` → `userId: req.user._id`.
2. **Add userId to Assignment.create**: Add `userId: req.user._id` to the Assignment fields object.
3. **Add userId to Exam.create**: Add `userId: req.user._id` to the Exam fields object.

#### File: `backend/routes/aiRoutes.js`

**Function**: `gatherUserContext`

**Specific Changes**:
1. **Fix StudentPlacementStatus query**: Change `StudentPlacementStatus.find({ studentId: firebaseUid, applicationStatus: 'Applied' })` → `StudentPlacementStatus.find({ userId: req.user._id, status: 'Applied' })`. Since `gatherUserContext` currently receives only `firebaseUid`, update the call sites to pass the full user object (or the `_id`) instead.
2. **Fix CalendarEvent userId filter**: The `events` query uses `userId: firebaseUid` (string); change to pass the MongoDB `_id`. Update `gatherUserContext` signature to accept `userId` (ObjectId) rather than `firebaseUid` and update the two call sites in `/ask` and `/daily-digest` routes.

**Function**: `POST /daily-digest`

**Specific Changes**:
1. **Parse Bedrock output into structured fields**: After receiving `digestText` from `invokeTitan`, parse the freeform paragraph into `{ greeting, summaryLines, recommendedAction }` using a simple line-split heuristic, OR return `{ digestText }` and update `Dashboard.jsx` to render `digestText` as a plain string (simpler, lower risk). The lower-risk option — updating `Dashboard.jsx` to display `digestText` — is chosen to avoid brittle Bedrock output parsing.

#### File: `backend/models/Post.js`

**Specific Changes**:
1. **Change `uploadedBy` type**: Replace `{ type: String, required: true }` with `{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`.

#### File: `backend/routes/postRoutes.js` (and any route that creates Posts)

**Specific Changes**:
1. **Store `uploadedBy: req.user._id`** instead of `req.user.uid` when creating Post documents.

#### File: `frontend/src/pages/Dashboard.jsx`

**Specific Changes**:
1. **Add missing icon imports**: Add `ClipboardList`, `BookOpen`, `Briefcase` to the existing `lucide-react` import line.
2. **Fix digest rendering**: Replace the structured `{ greeting, summaryLines, recommendedAction }` destructuring with a single `digest.digestText` string display (matching the backend's actual response shape).

#### File: `frontend/src/components/ErrorBoundary.jsx` _(new file)_

**Specific Changes**:
1. Create a React class component `ErrorBoundary` with `componentDidCatch` and a friendly fallback UI including a "Reload" button.

#### File: `frontend/src/components/Spinner.jsx` _(new file)_

**Specific Changes**:
1. Create a functional component `Spinner` that renders a centred, full-screen `<Loader2 className="animate-spin" />` using Tailwind.

#### File: `frontend/src/components/Toast.jsx` + `frontend/src/contexts/ToastContext.jsx` _(new files)_

**Specific Changes**:
1. Create a `ToastProvider` context exposing a `toast(message, type)` function.
2. Render a fixed-position toast container consuming the context.

#### File: `frontend/src/lib/api.js`

**Specific Changes**:
1. **Add axios request interceptor**: Before each request, call `auth.currentUser?.getIdToken(true)` and update the `Authorization` header. Export a `setupInterceptors(auth)` function called from `AuthContext` after initial auth resolution.
2. **Add axios response interceptor**: On any response error (status ≥ 400), call the global `toast` function from `ToastContext` with `err.response?.data?.error || 'An error occurred'`.

#### File: `frontend/src/App.jsx`

**Specific Changes**:
1. **Wrap with `ErrorBoundary`**: Wrap the `<Routes>` tree inside `<ErrorBoundary>`.
2. **Wrap with `ToastProvider`**: Wrap around the app so all pages can consume `useToast`.

#### File: `frontend/src/App.jsx` — `PrivateRoute`

**Specific Changes**:
1. **Replace loading text with `<Spinner />`**: Change `<div className="...">Loading…</div>` to `<Spinner />`.

---

## Testing Strategy

### Validation Approach

Testing follows a two-phase approach: first write tests against the current (unfixed) code to observe the bug manifesting and confirm the root-cause hypothesis, then run the same tests against the fixed code to verify both fix correctness and preservation.

---

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix.

**Test Plan**: Write Jest/Supertest tests that call each broken route with a mock `req.user` that has both `._id` (ObjectId) and `.firebaseUid` (string). Assert on what is actually stored in the database. Run against unfixed code first; tests should fail and reveal the incorrect field values.

**Test Cases**:
1. **CalendarEvent ownership (unfixed)**: Call `POST /api/assignments` with a mocked auth user; query `CalendarEvent.findOne({ userId: req.user._id })`; assert it exists. Expected to fail — `userId` will be a string, not the ObjectId.
2. **Placements eligibility (unfixed)**: Call `GET /api/placements` for a user with CGPA 8.5; assert `eligibilityStatus === 'eligible'` on a matching placement. Expected to fail — `userCgpa` defaults to 0.
3. **StudentPlacementStatus apply (unfixed)**: Call `POST /api/placements/:id/apply`; query `StudentPlacementStatus.findOne({ userId: req.user._id, placementId: id })`; assert it exists. Expected to fail — record is stored under non-existent `studentId` field.
4. **Dashboard assignment count (unfixed)**: Call `POST /api/upload/finalize` with category=assignment; query `Assignment.findOne({ userId: req.user._id })`; assert it exists. Expected to fail — `userId` is never set.
5. **Dashboard.jsx render (unfixed)**: Shallow-render `DashboardPage`; assert no ReferenceError is thrown. Expected to fail due to missing icon imports.
6. **Digest card (unfixed)**: Simulate `handleGenerateDigest` response `{ digestText: "..." }`; assert `digest.greeting` is defined. Expected to fail — digest.greeting is undefined.

**Expected Counterexamples**:
- CalendarEvent documents have `userId` stored as a 28-character string, not a 24-character hex ObjectId.
- StudentPlacementStatus has `studentId` field (not in schema) and missing `userId`.
- `Dashboard.jsx` throws `ReferenceError: ClipboardList is not defined`.
- `digest.greeting` is `undefined`; digest card renders blank.

---

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL route WHERE isBugCondition(route, "wrong-field-ref") DO
  result := fixedRoute(mockRequest)
  createdDoc := DB.findOne({ userId: mockRequest.user._id })
  ASSERT createdDoc != null
  ASSERT createdDoc.userId equals ObjectId(mockRequest.user._id)
END FOR

FOR ALL component WHERE isBugCondition(component, "missing-import") DO
  renderResult := render(fixedComponent)
  ASSERT renderResult.error = null
  ASSERT renderResult.contains(expected JSX output)
END FOR

FOR ALL axiosRequest WHERE isBugCondition(authState, "expired-token") DO
  headers := captureHeaders(fixedInterceptor, axiosRequest)
  ASSERT headers['Authorization'] starts with 'Bearer '
  ASSERT tokenAge(headers['Authorization']) < 50_minutes
END FOR
```

---

### Preservation Checking

**Goal**: Verify that all unchanged behaviours continue to work after applying all fixes.

**Pseudocode:**
```
FOR ALL route WHERE NOT isBugCondition(route, fieldRef) DO
  ASSERT originalRoute(request) == fixedRoute(request)
END FOR

FOR ALL component WHERE NOT isBugCondition(component, symbolRef) DO
  ASSERT render(original) == render(fixed)
END FOR
```

**Testing Approach**: Property-based testing is recommended for the CalendarEvent userId and axios interceptor properties, because:
- It generates many synthetic request objects automatically.
- It verifies the ObjectId constraint holds for any valid user document, not just one fixture.
- It provides strong guarantees that non-bug-condition paths are unaffected.

**Preservation Test Cases**:
1. **Auth middleware unchanged**: Verify `verifyFirebaseToken` still attaches the full MongoDB User for any valid token.
2. **Assignment GET unchanged**: Verify `GET /api/assignments` still returns all assignments for a batch — no regression from adding `userId` to creation.
3. **Upload-to-finalize flow**: Verify the end-to-end upload → AI pipeline → finalize flow still creates a Post and domain entry.
4. **Batch operations**: Verify create-batch, join-batch, and list-members are unchanged.
5. **PrivateRoute redirect**: Verify unauthenticated navigation still redirects to `/login` after the `<Spinner>` change.
6. **Community feed sort**: Verify `GET /api/posts/:batchId` still sorts by `isPinned: -1, createdAt: -1` after the `uploadedBy` schema change.

---

### Unit Tests

- Test each route individually with a mock `req.user = { _id: ObjectId('...'), firebaseUid: '...' , cgpa: 8.5, branch: 'CSE' }`.
- Test `CalendarEvent.create` receives `userId` as an ObjectId instance.
- Test `StudentPlacementStatus.findOneAndUpdate` uses `userId` not `studentId`.
- Test `Assignment.create` inside `finalize.js` includes `userId` field.
- Test `Dashboard.jsx` renders without throwing when `digest = { digestText: '...' }`.
- Test `PrivateRoute` renders `<Spinner />` (not plain text) when `loading = true`.
- Test `ErrorBoundary` renders fallback UI when a child throws.

### Property-Based Tests

- **CalendarEvent userId property (Property 1)**: For any valid `req.user` object generated by fast-check (varying `_id` ObjectIds), assert that every CalendarEvent created by assignments/exams/placements/finalize routes stores `userId` equal to `req.user._id`.
- **StudentPlacementStatus userId property (Property 2)**: For any `req.user` and any valid `placementId`, assert that after `POST /:id/apply`, `StudentPlacementStatus.findOne({ userId: req.user._id, placementId })` returns a non-null document.
- **Toast on API error (Property 3)**: For any axios response with status code in range [400, 599], assert the global toast function is called with a non-empty string.
- **Token freshness (Property 4)**: For any simulated axios request while `auth.currentUser` is set, assert the interceptor calls `getIdToken(true)` and the resulting `Authorization` header differs from any cached expired token.

### Integration Tests

- Full flow: sign in → upload text → review → finalize → check Calendar page shows the event.
- Full flow: sign in → go to Placements → apply → check `StudentPlacementStatus` record exists with `userId`.
- Dashboard render: sign in → navigate to `/dashboard` → assert all four icon types render, digest card shows `digestText` content.
- Community feed: upload post → navigate to Community → assert `post.uploadedBy.name` is visible.
- 65-minute session simulation: after token refresh mock, assert next API call carries the new token, not the old one.
