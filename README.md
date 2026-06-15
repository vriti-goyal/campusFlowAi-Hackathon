# CampusFlow AI

CampusFlow AI is a full-stack student operations platform for managing assignments, exams, placements, batch collaboration, timetable workflows, calendar planning, Gmail-driven notices, and an AI assistant.

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Repository Structure](#repository-structure)
5. [Prerequisites](#prerequisites)
6. [Local Setup](#local-setup)
7. [Environment Variables](#environment-variables)
8. [Frontend Routes](#frontend-routes)
9. [Backend API Modules](#backend-api-modules)
10. [Data Model Overview](#data-model-overview)
11. [Background Jobs (Cron)](#background-jobs-cron)
12. [Testing](#testing)
13. [Seeding and Demo Data](#seeding-and-demo-data)
14. [Deployment](#deployment)
15. [Troubleshooting](#troubleshooting)
16. [Security Notes](#security-notes)
17. [Project Documentation Index](#project-documentation-index)

## System Overview
Core capabilities:
- Firebase-authenticated student platform with role-aware data access.
- Assignment, exam, placement, and calendar management.
- Batch creation, member management, and community posting.
- Timetable and exam schedule upload/parsing pipelines.
- Gmail OAuth integration for notice ingestion.
- AI assistant and daily digest built around user context.
- Background reminder processing via scheduled jobs.

## Architecture
High-level flow:
1. Frontend (React + Vite) authenticates users using Firebase Web SDK.
2. Frontend sends Firebase ID token in `Authorization: Bearer <token>`.
3. Backend verifies token using Firebase Admin middleware.
4. Backend reads/writes MongoDB documents via Mongoose models.
5. Upload/document flows use S3 and parsing services.
6. AI requests are processed through the Groq-backed `invokeAI` layer.
7. Cron jobs generate and process reminders periodically.

## Tech Stack
- Frontend: React 18, Vite 5, Tailwind CSS, Radix UI primitives, Axios, Vitest
- Backend: Node.js (ESM), Express 4, Mongoose, Morgan, CORS, Multer, Jest
- Auth: Firebase Auth (client), Firebase Admin (server)
- Database: MongoDB (Atlas-compatible)
- Cloud Integrations: AWS S3, AWS Textract, Google OAuth/Gmail API
- AI: Groq Chat Completions API via `backend/config/gemini.js`

## Repository Structure
```text
campusFlowAi-Hackathon/
  backend/
    config/          # DB, Firebase, AI, AWS, OAuth clients
    middleware/      # Firebase token verification
    models/          # Mongoose schemas
    routes/          # Feature-wise REST endpoints
    services/        # Parsing, routing, scoring, reminders
    scripts/         # Seed and cleanup scripts
    tests/           # Jest test suites
    server.js        # API entrypoint
    cron.js          # Scheduled jobs
  frontend/
    src/
      components/
      contexts/
      hooks/
      layouts/
      lib/
      pages/
      tests/
    vite.config.js
  DEPLOYMENT.md
  GMAIL_SETUP.md
  KNOWN_ISSUES.md
  SCHEMA_CHANGES.md
  UI_GUIDELINES.md
```

## Prerequisites
- Node.js `>=18` (recommended: latest active LTS)
- npm `>=9`
- MongoDB instance (Atlas/local)
- Firebase project with Authentication enabled
- AWS account/bucket/credentials for upload and parsing features
- Google Cloud OAuth credentials for Gmail integration (optional but required for Gmail module)

## Local Setup
### 1) Clone and install
```bash
git clone <your-repo-url>
cd campusFlowAi-Hackathon
cd backend && npm install
cd ../frontend && npm install
```

### 2) Configure env files
Create:
- `backend/.env`
- `frontend/.env`

Use the variables listed in [Environment Variables](#environment-variables).

### 3) Run backend
```bash
cd backend
npm run dev
```
Default backend URL:
- `http://localhost:8080` (from `PORT || 8080`)
- Health check: `GET /health`

### 4) Run frontend
```bash
cd frontend
npm run dev
```
Default frontend URL:
- `http://localhost:5173`

## Environment Variables
### Backend (`backend/.env`)
Required:
- `MONGO_URI`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `PORT` (optional locally, required by many hosts)
- `FRONTEND_URL` (for CORS and OAuth callback redirects outside localhost)

AI:
- `GROQ_API_KEY` (required for assistant/digest features)
- `GROQ_MODEL` (optional, default: `llama-3.1-8b-instant`)
- `GROQ_VISION_MODEL` (optional, defaults to `GROQ_MODEL`)

AWS/storage/document pipeline:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `S3_BUCKET_NAME`
- `BEDROCK_MODEL_ID` (optional fallback/default in config)

Gmail OAuth:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GMAIL_TOKEN_ENCRYPTION_KEY`

Legacy/optional:
- `JWT_SECRET` (present in project docs, not core to Firebase token flow)

### Frontend (`frontend/.env`)
Required:
- `VITE_API_BASE_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Example local values:
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## Frontend Routes
Public:
- `/login`
- `/setup` (for authenticated users with incomplete profile)

Authenticated app routes:
- `/dashboard`
- `/notices`
- `/assignments`
- `/exams`
- `/placements`
- `/placement-notices`
- `/calendar`
- `/timetable`
- `/assistant`
- `/batch`
- `/profile`

## Backend API Modules
Mounted route groups:
- `/health`
- `/api/upload`
- `/api/assignments`
- `/api/exams`
- `/api/placements`
- `/api/users`
- `/api/batch`
- `/api/posts`
- `/api/calendar`
- `/api/dashboard`
- `/api/ai`
- `/api/notifications`
- `/api/gmail`
- `/api/placement-notices`
- `/api/exam-schedule`
- `/api/timetable`
- `/api/admin`

Notes:
- Many endpoints are protected by Firebase token middleware.
- Health route is intentionally public.
- CORS allowlist defaults to localhost `5173` plus optional `FRONTEND_URL`.

## Data Model Overview
Primary collections:
- `User`
- `Batch`, `BatchMember`
- `Post`
- `Assignment`, `StudentAssignmentStatus`
- `Exam`, `ExamSchedule`
- `Placement`, `PlacementNotice`, `StudentPlacementStatus`
- `CalendarEvent`
- `Timetable`, `TimetableOverride`, `TimetableLog`, `TimetableAuditLog`
- `Notification`, `Reminder`
- `AIChatHistory`
- `GmailToken`

See `SCHEMA_CHANGES.md` for phase-wise schema additions.

## Background Jobs (Cron)
Defined in `backend/cron.js`:
- Every 6 hours: scans urgent assignments/exams and creates notifications.
- Every 5 minutes: processes due reminders via `processReminders()`.

## Testing
Backend:
```bash
cd backend
npm test
```
Uses Jest with `babel-jest`, includes route/service tests under `backend/tests`.

Frontend:
```bash
cd frontend
npm test
```
Uses Vitest (`vitest run`) with tests under `frontend/src/tests`.

## Seeding and Demo Data
Scripts available:
- `backend/scripts/seed.js`
- `backend/scripts/cleanDemo.js`

Run manually:
```bash
cd backend
node scripts/seed.js
node scripts/cleanDemo.js
```

## Deployment
Deployment docs are maintained separately:
- Backend and frontend hosting: `DEPLOYMENT.md`
- Amplify build config: `amplify.yml`
- Gmail OAuth setup: `GMAIL_SETUP.md`

Production recommendations:
- Use HTTPS for frontend and API endpoints.
- Set `FRONTEND_URL` to deployed frontend domain.
- Ensure Firebase authorized domains include deployed frontend.
- Ensure S3 CORS is configured for frontend origin.

## Troubleshooting
Common checks:
1. `401 Unauthorized`: verify frontend sends `Authorization` token and backend Firebase Admin env variables are valid.
2. CORS error: ensure request origin matches `localhost:5173` or `FRONTEND_URL`.
3. AI assistant failure: verify `GROQ_API_KEY` and outbound network access.
4. Gmail callback mismatch: verify `GOOGLE_REDIRECT_URI` exactly matches console settings.
5. Upload/parsing issues: verify AWS credentials, region, bucket permissions, and bucket CORS.

## Security Notes
- Never commit real credentials or private keys.
- Rotate any credentials that were exposed in repository history or tracked env-like files.
- Add dedicated template files such as `backend/.env.example` and `frontend/.env.example` with placeholders only.
- Restrict cloud IAM permissions to least privilege for S3/Textract/AI services.

## Project Documentation Index
- `DEPLOYMENT.md`: deployment workflow and production notes
- `GMAIL_SETUP.md`: Gmail OAuth setup
- `KNOWN_ISSUES.md`: currently tracked issues and workarounds
- `SCHEMA_CHANGES.md`: schema evolution across feature phases
- `UI_GUIDELINES.md`: frontend design system and component usage rules
