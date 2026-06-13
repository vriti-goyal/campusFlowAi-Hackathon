# Implementation Plan

## Overview

This task list covers the full bugfix workflow for CampusFlow AI integration defects across four bug groups:
- **Group A**: Broken identity references in backend routes (`req.user.uid` vs `req.user._id`, `studentId` vs `userId`)
- **Group B**: Mismatched API field names and response shapes (missing icon imports, digest key mismatch, Post.uploadedBy type)
- **Group C**: Missing frontend resilience components (ErrorBoundary, Spinner, Toast/ToastContext)
- **Group D**: Broken auth token refresh and PrivateRoute loading state

Tasks follow the exploratory bugfix workflow: write PBT exploration tests first (before any fix), write preservation tests second, then implement fixes in order, then verify.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "4.1", "4.2", "4.3", "4.4", "5.1", "5.2", "5.3", "5.4", "6.1", "6.2", "6.3"] },
    { "wave": 3, "tasks": ["7", "8", "9", "10"] },
    { "wave": 4, "tasks": ["11"] },
    { "wave": 5, "tasks": ["12"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - CalendarEvent userId and StudentPlacementStatus userId ObjectId Correctness
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples demonstrating that CalendarEvent.userId is stored as a string and StudentPlacementStatus.userId is stored under the wrong field name
  - **Scoped PBT Approach**: For each route (POST /api/assignments, POST /api/exams, POST /api/placements, POST /api/upload/finalize, POST /api/placements/:id/apply), scope the property to a concrete mock req.user = { _id: ObjectId, firebaseUid: string, uid: string }
  - Test 1 — CalendarEvent ownership: call POST /api/assignments with mock auth user; query CalendarEvent.findOne({ userId: req.user._id }); assert it is non-null and userId is a Mongoose ObjectId instance (not a string)
  - Test 2 — StudentPlacementStatus apply: call POST /api/placements/:id/apply; query StudentPlacementStatus.findOne({ userId: req.user._id, placementId: id }); assert it is non-null
  - Test 3 — Placements eligibility: call GET /api/placements for a user with cgpa: 8.5; assert at least one matching placement has eligibilityStatus === 'eligible'
  - Test 4 — Dashboard assignment count: call POST /api/upload/finalize with category=assignment; query Assignment.findOne({ userId: req.user._id }); assert it is non-null
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (proves the bugs exist)
  - Document counterexamples found (e.g., CalendarEvent.userId is a 28-char string not an ObjectId; StudentPlacementStatus record has `studentId` field instead of `userId`)
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-buggy routes continue to behave identically after all fixes
  - **IMPORTANT**: Follow observation-first methodology — run UNFIXED code for non-buggy inputs and record results
  - Observe: GET /api/assignments returns correct list for a batch on unfixed code
  - Observe: verifyFirebaseToken attaches full MongoDB User document as req.user on unfixed code
  - Observe: POST /api/batch, GET /api/batch/my-batches continue to work on unfixed code
  - Observe: GET /api/posts/:batchId returns posts sorted by isPinned: -1, createdAt: -1 on unfixed code
  - Observe: POST /api/ai/ask calls Bedrock and returns { answer, sources } on unfixed code
  - Observe: unauthenticated navigation to /dashboard redirects to /login on unfixed code
  - Write property-based test: for any valid batchId, GET /api/assignments returns an array where every element has all schema fields intact (title, deadline, status, priorityLevel)
  - Write property-based test: for any valid Firebase token, verifyFirebaseToken attaches req.user._id as a Mongoose ObjectId
  - Write property-based test: for any GET /api/posts/:batchId call with varying category/search params, the returned array is sorted isPinned desc, createdAt desc
  - Write property-based test: for any axios response with status code in [200, 299], the global toast function is NOT called
  - Run ALL preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: All preservation tests PASS (establishes baseline behavior)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 3. Fix Bug Group A — Broken identity references in backend routes

  - [x] 3.1 Fix placements.js GET route — remove redundant User.findOne and use req.user directly
    - In GET / handler: delete the lines `const user = await User.findOne({ uid: req.user.uid })` and the `User` import if no longer needed
    - Replace `const userCgpa = user?.cgpa || 0` with `const userCgpa = req.user.cgpa || 0`
    - Replace `const userBranch = user?.branch || ''` with `const userBranch = req.user.branch || ''`
    - Fix StudentPlacementStatus query in GET /: change `StudentPlacementStatus.find({ studentId: req.user.uid })` → `StudentPlacementStatus.find({ userId: req.user._id })`
    - _Bug_Condition: isBugCondition({ fieldUsed: "req.user.uid", schemaFieldExpected: "userId: ObjectId" }) = true_
    - _Expected_Behavior: userCgpa and userBranch are derived from req.user (already-attached MongoDB User doc); eligibilityStatus reflects actual user profile_
    - _Preservation: All existing GET /api/placements filtering by batchId must continue to work_
    - _Requirements: 2.1_

  - [x] 3.2 Fix CalendarEvent userId in placements.js POST route
    - In POST / handler: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create call
    - _Bug_Condition: CalendarEvent.userId receives a Firebase UID string instead of ObjectId_
    - _Expected_Behavior: CalendarEvent.userId = req.user._id (Mongoose ObjectId) so GET /api/calendar/events returns the event_
    - _Requirements: 2.2_

  - [x] 3.3 Fix StudentPlacementStatus field names in placements.js apply route
    - In POST /:id/apply handler: replace `studentId: req.user.uid` with `userId: req.user._id` in both the filter and the upsert body of findOneAndUpdate
    - Ensure the upsert body sets `userId: req.user._id, placementId, applicationStatus: 'Applied', appliedAt: new Date()`
    - Remove any reference to `studentId`
    - _Bug_Condition: isBugCondition({ fieldUsed: "studentId: req.user.uid" }) = true — schema has no studentId field_
    - _Expected_Behavior: StudentPlacementStatus.findOne({ userId: req.user._id, placementId }) returns non-null after apply_
    - _Requirements: 2.3_

  - [x] 3.4 Fix CalendarEvent userId in assignments.js POST route
    - In POST / handler: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create call
    - _Bug_Condition: CalendarEvent.userId receives Firebase UID string_
    - _Expected_Behavior: CalendarEvent.userId = req.user._id (ObjectId)_
    - _Requirements: 2.2_

  - [x] 3.5 Fix CalendarEvent userId in exams.js POST route
    - In POST / handler: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create call
    - _Bug_Condition: CalendarEvent.userId receives Firebase UID string_
    - _Expected_Behavior: CalendarEvent.userId = req.user._id (ObjectId)_
    - _Requirements: 2.2_

  - [x] 3.6 Fix finalize.js — CalendarEvent userId and add userId to Assignment and Exam creates
    - In POST /finalize, assignment branch: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create
    - In assignment branch: add `userId: req.user._id` to the Assignment.create fields object
    - In POST /finalize, exam branch: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create
    - In exam branch: add `userId: req.user._id` to the Exam.create fields object
    - In POST /finalize, placement branch: change `userId: req.user.uid` → `userId: req.user._id` in CalendarEvent.create
    - _Bug_Condition: finalize.js omits userId on Assignment/Exam creates and passes UID string to CalendarEvent_
    - _Expected_Behavior: Assignment.userId = req.user._id; Exam.userId = req.user._id; all three CalendarEvents store ObjectId_
    - _Preservation: The POST/review/finalize upload flow must continue to create Post and domain entry end-to-end_
    - _Requirements: 2.2, 2.4_

  - [x] 3.7 Fix aiRoutes.js — change studentId → userId and firebaseUid → req.user._id in StudentPlacementStatus and CalendarEvent queries
    - Update `gatherUserContext` function signature: replace the `firebaseUid` parameter with `user` (the full req.user object)
    - Change `StudentPlacementStatus.find({ studentId: firebaseUid, applicationStatus: 'Applied' })` → `StudentPlacementStatus.find({ userId: user._id, status: 'Applied' })`
    - Change `CalendarEvent.find({ userId: firebaseUid, ... })` → `CalendarEvent.find({ userId: user._id, ... })`
    - Update the two call sites in POST /ask and POST /daily-digest: change `gatherUserContext(req.user.uid)` → `gatherUserContext(req.user)`
    - In POST /ask: remove the extra `User.findOne({ firebaseUid: req.user.uid })` lookup for chat history; use `req.user._id` directly as `userId` for AIChatHistory.create
    - In GET /history: remove `User.findOne({ firebaseUid: req.user.uid })`; use `req.user._id` directly
    - _Bug_Condition: gatherUserContext uses studentId (non-existent field) and firebaseUid string for ObjectId fields_
    - _Expected_Behavior: AI context correctly filters applied placements and calendar events for the authenticated user_
    - _Preservation: POST /api/ai/ask must continue to call Bedrock and return { answer, sources } — Requirements: 3.9_
    - _Requirements: 2.5_

- [x] 4. Fix Bug Group B — Mismatched API field names and response shapes

  - [x] 4.1 Fix Post.uploadedBy model — change type from String to ObjectId ref 'User'
    - In backend/models/Post.js: change `uploadedBy: { type: String, required: true }` to `uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }`
    - _Bug_Condition: Post.uploadedBy typed as String; .populate('uploadedBy') silently no-ops_
    - _Expected_Behavior: .populate('uploadedBy', 'name email role') resolves user document; post.uploadedBy.name is visible in Community feed_
    - _Preservation: GET /api/posts/:batchId must continue to sort by isPinned: -1, createdAt: -1 and support category/search filters — Requirements: 3.11_
    - _Requirements: 2.9_

  - [x] 4.2 Fix postRoutes.js — store uploadedBy: req.user._id instead of any UID string
    - In POST /api/posts handler: verify `uploadedBy: req.user._id` is used (already correct in postRoutes.js — confirm no other route creates Posts with req.user.uid)
    - Check upload.js route: if Post is created there, ensure `uploadedBy: req.user._id` is used, not `req.user.uid`
    - _Bug_Condition: Any Post creation using req.user.uid for uploadedBy breaks populate after schema change_
    - _Expected_Behavior: All Post documents have uploadedBy as a valid ObjectId that can be populated_
    - _Requirements: 2.9_

  - [x] 4.3 Fix Dashboard.jsx — add missing icon imports
    - In frontend/src/pages/Dashboard.jsx: add `ClipboardList`, `BookOpen`, `Briefcase` to the lucide-react import statement
    - Current import line: `import { LayoutDashboard, AlertCircle, CalendarDays, Bot, Users, Sparkles, Loader2, Target, CheckCircle, Bell, ArrowRight } from 'lucide-react'`
    - Updated import line must include `ClipboardList, BookOpen, Briefcase`
    - _Bug_Condition: isBugCondition({ symbolUsed: ["ClipboardList","BookOpen","Briefcase"], symbolImported: false }) = true — React render crash_
    - _Expected_Behavior: Dashboard renders without ReferenceError; focus item icons display correctly per item.type_
    - _Requirements: 2.7_

  - [x] 4.4 Fix Dashboard.jsx — update digest card to display digestText instead of greeting/summaryLines/recommendedAction
    - Replace the structured digest rendering block that reads `digest.greeting`, `digest.summaryLines`, and `digest.recommendedAction`
    - Replace with a simple single-block display of `digest.digestText` as a preformatted or paragraph string
    - The digest card should render the raw digestText paragraph from the backend response
    - _Bug_Condition: isBugCondition({ responseKeyRead: "greeting", responseKeyActual: "digestText" }) = true — digest card always blank_
    - _Expected_Behavior: Daily Digest card renders the actual AI-generated paragraph from { digestText }_
    - _Requirements: 2.8_

- [x] 5. Fix Bug Group C — Add missing frontend resilience components

  - [x] 5.1 Create frontend/src/components/ErrorBoundary.jsx
    - Create a React class component `ErrorBoundary` with `constructor`, `static getDerivedStateFromError`, `componentDidCatch`, and `render` methods
    - State: `{ hasError: false, error: null }`
    - getDerivedStateFromError: return `{ hasError: true, error }`
    - componentDidCatch: log error and errorInfo to console
    - render: when hasError is true, render a centered full-screen fallback UI with: a warning icon, heading "Something went wrong", brief error message, and a "Reload Page" button that calls `window.location.reload()`
    - When hasError is false, render `this.props.children`
    - _Bug_Condition: isBugCondition({ apiError: unhandled, globalBoundaryExists: false }) = true_
    - _Expected_Behavior: React render exceptions show friendly fallback UI instead of blank white screen_
    - _Requirements: 2.10_

  - [x] 5.2 Create frontend/src/components/Spinner.jsx
    - Create a functional component `Spinner` using lucide-react Loader2
    - Render a `<div>` with Tailwind classes for: fixed position, full viewport coverage, flex centering, semi-transparent background
    - Inside: `<Loader2 className="animate-spin text-primary" size={48} />`
    - Export as default
    - _Bug_Condition: PrivateRoute renders plain text "Loading…" div — inconsistent with rest of UI_
    - _Expected_Behavior: All loading states use consistent centered animated spinner_
    - _Requirements: 2.12, 2.14_

  - [x] 5.3 Create frontend/src/contexts/ToastContext.jsx
    - Create a React context `ToastContext` with `createContext`
    - Create `ToastProvider` component: maintains `toasts` state (array of `{ id, message, type }`)
    - Expose `toast(message, type = 'error')` function that adds a toast with a unique id (Date.now()) and auto-removes it after 4000ms using setTimeout
    - Expose `removeToast(id)` function for manual dismissal
    - Provide `{ toasts, toast, removeToast }` via context value
    - Export `ToastProvider` and `useToast` hook
    - _Bug_Condition: No global toast mechanism; API errors silently swallowed or use browser alert()_
    - _Expected_Behavior: Any component or interceptor can call toast(message) to display a visible notification_
    - _Requirements: 2.11_

  - [x] 5.4 Create frontend/src/components/Toast.jsx
    - Create a `ToastContainer` functional component that consumes `useToast`
    - Render a fixed-position container (bottom-right, z-index high) listing all active toasts
    - Each toast: colored div (red for error, green for success, blue for info) with message text and an ✕ dismiss button calling `removeToast(toast.id)`
    - Include enter/exit transition classes with Tailwind
    - Export as default
    - _Bug_Condition: No in-app toast UI renders even if toast() is called_
    - _Expected_Behavior: Toast notifications appear and auto-dismiss; user receives visible feedback for API errors_
    - _Requirements: 2.11_

- [x] 6. Fix Bug Group D — Auth token refresh and protected route loading state

  - [x] 6.1 Update frontend/src/lib/api.js — add axios request interceptor for force-refreshing Firebase tokens
    - Add import: `import { auth } from '@/lib/firebase'`
    - Add import or reference to ToastContext toast function (pass via setupInterceptors)
    - Export a new `setupInterceptors(toastFn)` function
    - Inside setupInterceptors: add `api.interceptors.request.use` handler that calls `auth.currentUser?.getIdToken(true)`, then sets `config.headers['Authorization'] = \`Bearer \${freshToken}\`` before returning config
    - Handle the case where `auth.currentUser` is null (no-op, pass config through)
    - Add `api.interceptors.response.use` handler: on error (status ≥ 400), call `toastFn(err.response?.data?.error || err.message || 'An error occurred', 'error')` then re-throw the error
    - _Bug_Condition: isBugCondition({ tokenAge: > 50min, interceptorPresent: false }) = true — expired token causes 401 mid-session_
    - _Expected_Behavior: Every outgoing request carries a freshly force-refreshed Firebase token; every response error triggers a global toast_
    - _Requirements: 2.13, 2.11_

  - [x] 6.2 Update frontend/src/App.jsx — wrap app with ErrorBoundary and ToastProvider, replace PrivateRoute loading text with Spinner
    - Import `ErrorBoundary` from `@/components/ErrorBoundary`
    - Import `ToastProvider` from `@/contexts/ToastContext`
    - Import `ToastContainer` from `@/components/Toast`
    - Import `Spinner` from `@/components/Spinner`
    - In `PrivateRoute`: replace `<div className="flex items-center justify-center h-screen text-muted-foreground">Loading…</div>` with `<Spinner />`
    - In the App export: wrap the outer JSX with `<ErrorBoundary>` as the outermost boundary, then `<ToastProvider>` inside it
    - Add `<ToastContainer />` as a sibling to `<Routes>` inside `ToastProvider` so toasts render globally
    - _Bug_Condition: App has no error boundary and PrivateRoute shows plain text during loading_
    - _Expected_Behavior: Render errors caught by ErrorBoundary; loading state shows branded Spinner; toast notifications render globally_
    - _Requirements: 2.10, 2.12, 2.14_

  - [x] 6.3 Update frontend/src/contexts/AuthContext.jsx — call setupInterceptors after auth resolves
    - Import `setupInterceptors` from `@/lib/api`
    - Import `useToast` (or obtain toast function) — since AuthContext renders inside ToastProvider, use `useToast()` hook
    - After `setAuthToken(token)` in the `onAuthStateChanged` callback, call `setupInterceptors(toast)` (pass the toast function from context)
    - Ensure setupInterceptors is only registered once; add a guard with a module-level boolean flag `interceptorsInitialized` inside api.js to prevent duplicate interceptor registration
    - _Bug_Condition: axios interceptors never wired; token never force-refreshed before expiry_
    - _Expected_Behavior: setupInterceptors called once on first auth resolution; every subsequent request auto-refreshes the token_
    - _Requirements: 2.13_

- [x] 7. Verify bug condition exploration test now passes
  - **Property 1: Expected Behavior** - CalendarEvent userId and StudentPlacementStatus userId ObjectId Correctness
  - **IMPORTANT**: Re-run the SAME test suite from task 1 — do NOT write new tests
  - The tests from task 1 encode the expected behavior; when they pass, the fix is confirmed
  - Re-run test 1: POST /api/assignments CalendarEvent.userId is a Mongoose ObjectId matching req.user._id
  - Re-run test 2: POST /api/placements/:id/apply StudentPlacementStatus.findOne({ userId: req.user._id }) returns non-null
  - Re-run test 3: GET /api/placements for user with cgpa 8.5 returns eligibilityStatus === 'eligible'
  - Re-run test 4: POST /api/upload/finalize (category=assignment) Assignment.findOne({ userId: req.user._id }) returns non-null
  - **EXPECTED OUTCOME**: All four tests PASS (confirms Group A bugs are fixed)
  - _Requirements: 2.2, 2.3, 2.4_

- [x] 8. Verify preservation tests still pass
  - **Property 2: Preservation** - Non-buggy routes continue to behave identically after all fixes
  - **IMPORTANT**: Re-run the SAME preservation tests from task 2 — do NOT write new tests
  - Run all property-based preservation tests written in task 2
  - **EXPECTED OUTCOME**: All preservation tests PASS (confirms no regressions)
  - Confirm in particular: GET /api/assignments, GET /api/posts/:batchId sort order, verifyFirebaseToken user attachment, unauthenticated redirect to /login
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 9. Add property-based test: axios response interceptor toast trigger (Property 3)
  - **Property 3: Bug Condition B** - Axios Response Interceptor Displays Toast for All Error Status Codes
  - Write a property-based test using fast-check (or equivalent) that generates arbitrary HTTP status codes in range [400, 599]
  - For each generated status code: mock axios to return a response with that status; run the response interceptor from api.js
  - Assert: the toast function is called exactly once with a non-empty string message
  - For status codes in [200, 299]: assert toast function is NOT called (preservation)
  - Run test on FIXED code (post task 6.1)
  - **EXPECTED OUTCOME**: Test PASSES for all generated error status codes
  - _Requirements: 2.11_

- [x] 10. Add property-based test: axios request interceptor token freshness (Property 4)
  - **Property 4: Bug Condition D** - Axios Request Interceptor Attaches Fresh Token for Any Authenticated User
  - Write a property-based test using fast-check that generates arbitrary mock Firebase user objects with a `getIdToken(true)` method returning a fresh token string
  - For each generated user: set `auth.currentUser` to the mock; invoke the request interceptor from api.js with a mock config object
  - Assert: `config.headers['Authorization']` starts with `'Bearer '`
  - Assert: the token in the header is the fresh token returned by `getIdToken(true)`, not any previously cached token
  - For null `auth.currentUser`: assert interceptor passes config through unchanged (no error thrown)
  - Run test on FIXED code (post task 6.1)
  - **EXPECTED OUTCOME**: Test PASSES confirming fresh token attached on every request
  - _Requirements: 2.13_

- [x] 11. Create KNOWN_ISSUES.md at project root
  - Create a KNOWN_ISSUES.md file at `c:\Users\Vriti Goyal\campusFlowAi-Hackathon\KNOWN_ISSUES.md`
  - Document the following remaining known issues (out of scope for this bugfix):
    - **Batch ID propagation in dashboard**: GET /api/batch/my-batches populates batchId but the spread in batchRoutes may lose `_id` if batchId is not populated — document the risk and the frontend workaround (use `batchRes.data[0]._id` vs `batchRes.data[0].batchId._id`)
    - **Upload.jsx finalize state sync**: After POST /api/upload/finalize, the edited extraction is confirmed server-side but the frontend does not update the stored extraction state; any subsequent edits to the displayed review card are lost
    - **AI context not user-scoped for assignments/exams**: gatherUserContext still fetches assignments and exams without filtering by userId, so the AI sees all batch assignments, not just those owned by the requesting user
    - **No pagination on posts feed**: GET /api/posts/:batchId returns all posts without pagination; large batches may cause slow loads
    - **Missing logout token invalidation**: On logout, the Firebase token is cleared from the client but there is no server-side session revocation; any intercepted token remains valid until its 1-hour expiry
  - _Requirements: (documentation — no requirement clause number)_

- [x] 12. Checkpoint — Ensure all tests pass
  - Run the full backend test suite (Jest/Supertest): `npm test` in `/backend`
  - Run the full frontend test suite (Vitest): `npm run test -- --run` in `/frontend`
  - Verify Property 1 (task 7): CalendarEvent and StudentPlacementStatus exploration tests pass
  - Verify Property 2 (task 8): All preservation tests pass with no regressions
  - Verify Property 3 (task 9): Axios response interceptor toast test passes for all [400, 599] status codes
  - Verify Property 4 (task 10): Axios request interceptor token freshness test passes for all generated users
  - Manually smoke-test critical paths: sign in → placements (check eligibility) → apply → calendar → dashboard (check digest) → community (check author names)
  - Ensure all tests pass; ask the user if questions arise

## Notes

- All PBT tasks (1, 2, 9, 10) use fast-check (frontend) or a compatible property-based testing library
- Backend tests use Jest + Supertest with an in-memory MongoDB (e.g., mongodb-memory-server)
- Tasks 1 and 2 MUST be completed before any implementation tasks (3–6) begin
- Tasks 7 and 8 re-run the exact same tests written in tasks 1 and 2 respectively — do not write new tests
- The `setupInterceptors` guard flag in api.js prevents duplicate interceptor registration on hot reload
- KNOWN_ISSUES.md (task 11) documents out-of-scope issues only; nothing in it requires a code change in this bugfix cycle
