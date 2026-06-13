# CampusFlow AI 🎓

> A full-stack student operations platform powered by **React**, **Express**, **MongoDB**, **Firebase Auth**, and **AWS Bedrock**.

---

## Repository Structure

```
campusFlowAi-Hackathon/
├── backend/                  Express + Node.js API (ESM)
│   ├── config/db.js          Mongoose connection
│   ├── controllers/          Route handlers
│   ├── middleware/auth.js    Firebase Admin token verification
│   ├── models/               Mongoose schemas
│   ├── routes/               Express routers
│   ├── utils/                Helper functions
│   └── server.js             Entry point
│
├── frontend/                 React + Vite + Tailwind CSS + Shadcn UI
│   ├── src/
│   │   ├── components/
│   │   │   └── layout/AppLayout.jsx  Sidebar layout
│   │   ├── contexts/AuthContext.jsx  Firebase Auth + idToken
│   │   ├── lib/
│   │   │   ├── api.js        Axios instance (→ VITE_API_BASE_URL)
│   │   │   └── firebase.js   Firebase client SDK init
│   │   ├── pages/            One file per route
│   │   ├── App.jsx           React Router setup
│   │   └── main.jsx          React entry point
│   ├── index.html
│   └── vite.config.js
│
├── .env.example              Root-level env template (backend vars)
├── .gitignore
└── README.md
```

---

## Environment Variables

### Backend (`backend/.env`)

Copy `.env.example` → `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string |
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `S3_BUCKET_NAME` | S3 bucket for file uploads |
| `BEDROCK_MODEL_ID` | AWS Bedrock model ID (Nova) |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `JWT_SECRET` | Secret for any custom JWT signing |
| `PORT` | API server port (default `5000`) |

### Frontend (`frontend/.env`)

Copy `frontend/.env.example` → `frontend/.env` and fill in:

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Backend URL (default `http://localhost:5000`) |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |

---

## Running Locally

### Backend

```bash
cd backend
npm install
# create backend/.env from .env.example
npm run dev       # uses nodemon, restarts on change
```

API available at **http://localhost:5000**  
Health check: `GET http://localhost:5000/health`

### Frontend

```bash
cd frontend
npm install
# frontend/.env already pre-filled with your Firebase project
npm run dev
```

App available at **http://localhost:5173**

---

## Routes

| Path | Page |
|---|---|
| `/login` | Google sign-in |
| `/dashboard` | Overview & stats |
| `/community` | Student community |
| `/assignments` | Assignment tracker |
| `/exams` | Exam schedule |
| `/placements` | Job & internship board |
| `/calendar` | Unified calendar |
| `/assistant` | AI chat (AWS Bedrock) |
| `/upload` | File upload (S3) |
| `/batch` | Bulk operations |
| `/profile` | User profile |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Shadcn UI (Radix), React Router v6 |
| Auth | Firebase Auth (Google sign-in), Firebase Admin SDK |
| Backend | Express 4, Node.js (ESM), Morgan, CORS |
| Database | MongoDB via Mongoose |
| Storage | AWS S3 |
| AI | AWS Bedrock (Nova) |
