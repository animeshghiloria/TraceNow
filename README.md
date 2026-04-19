# 📍 TraceNow

> **Real-time hyperlocal alert platform for missing child cases.**  
> Community-powered. AI-accelerated. Built for zero response time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[![React Native](https://img.shields.io/badge/React_Native-Expo_51-purple)](https://expo.dev)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         NGINX (Reverse Proxy)                   │
│              /api → Backend    /ai → AI Service                 │
└───────────────────────────┬──────────────────┬──────────────────┘
                            │                  │
            ┌───────────────▼──┐   ┌───────────▼──────────────┐
            │  NestJS Backend   │   │  FastAPI AI Microservice  │
            │  REST + WebSocket │   │  DeepFace + FAISS         │
            └───────┬───────────┘   └──────────────┬───────────┘
                    │                              │
        ┌───────────▼──────────────────────────────▼──────┐
        │           PostgreSQL + PostGIS                   │
        │   users · cases · sightings · alerts · embeddings│
        └─────────────────────────────────────────────────┘
        ┌─────────────────────────────────────────────────┐
        │           Redis (Cache + Pub/Sub + RateLimit)   │
        └─────────────────────────────────────────────────┘
```

---

## 📁 Monorepo Structure

```
TraceNow/
├── apps/
│   ├── mobile/          # React Native (Expo) — iOS + Android
│   ├── backend/         # NestJS — REST + WebSocket API
│   └── ai-service/      # FastAPI — Face recognition microservice
├── infra/
│   ├── docker-compose.yml
│   ├── postgres/init.sql
│   └── nginx/nginx.conf
├── docs/
│   └── architecture.md
├── .env.example
└── README.md
```

---

## 🚀 Quick Start (Local with Docker)

### Prerequisites

- Docker Desktop ≥ 24
- Node.js ≥ 20 (for mobile dev)
- Expo CLI (`npm i -g expo-cli`)

### 1. Clone & configure

```bash
git clone https://github.com/your-org/TraceNow.git
cd TraceNow
cp .env.example .env
# Edit .env — at minimum set JWT_SECRET
```

### 2. Start all backend services

```bash
cd infra
docker compose up --build
```

Services started:
| Service | Port | URL |
|---------|------|-----|
| Nginx (gateway) | 80 | `http://localhost` |
| NestJS backend | 3000 | `http://localhost/api` |
| FastAPI AI | 8000 | `http://localhost/ai` |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

> 💡 First run downloads the FaceNet model (~90MB). Subsequent starts are instant.

### 3. Run the mobile app

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your device.

---

## 🔐 Firebase Setup (Required for Auth)

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Phone Authentication**
3. Download the **service account JSON** from Project Settings → Service Accounts
4. Encode it:
   ```bash
   base64 -i service-account.json | tr -d '\n'
   ```
5. Set `FIREBASE_SERVICE_ACCOUNT=<base64_output>` in `.env`

Add your `google-services.json` (Android) and `GoogleService-Info.plist` (iOS) to `apps/mobile/`.

---

## ☁️ AWS S3 Setup (Required for Image Storage)

1. Create an S3 bucket (e.g., `tracenow-images`) in `ap-south-1`
2. Set CORS to allow uploads from your app
3. Create an IAM user with `s3:PutObject`, `s3:GetObject` permissions
4. Fill in `.env`: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

> Without S3 credentials, the system logs a warning and uses mock URLs in dev mode.

---

## 🧠 AI Service API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health + FAISS index size |
| `/embeddings/generate` | POST | Extract embedding from image (test/debug) |
| `/embeddings/store` | POST | Store embedding for a case in FAISS + DB |
| `/embeddings/match` | POST | Match sighting image → returns confidence |
| `/embeddings/{case_id}` | GET | Get stored embeddings for a case |

**Match request** (`multipart/form-data`):
- `image`: JPEG/PNG photo
- `top_k`: number of results (default 5)
- `threshold`: minimum confidence (default 0.75)

---

## ⚙️ Backend API

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/verify` | POST | — | Exchange Firebase token for JWT |
| `/api/users/me` | GET | JWT | Get current user |
| `/api/users/location` | PATCH | JWT | Update user GPS location |
| `/api/users/fcm-token` | PATCH | JWT | Update FCM push token |
| `/api/cases` | GET | JWT | List cases |
| `/api/cases/nearby` | GET | JWT | Cases within radius (`?lat&lng&radius`) |
| `/api/cases` | POST | JWT | Report missing child (multipart) |
| `/api/cases/:id` | GET | JWT | Case details |
| `/api/cases/:id/status` | PATCH | JWT | Update case status |
| `/api/sightings` | POST | JWT | Upload sighting (multipart) |
| `/api/sightings/case/:id` | GET | JWT | Get sightings for case |
| `/api/health` | GET | — | Backend health check |

### WebSocket Events

Connect to `ws://localhost/socket.io`

| Event | Direction | Payload |
|-------|-----------|---------|
| `subscribe_case` | Client→Server | `{ caseId }` |
| `new_case` | Server→Client | Case object |
| `new_sighting` | Server→Client | Sighting object |
| `case_updated` | Server→Client | `{ id, status }` |

---

## 📱 Mobile App Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/(auth)/login` | Firebase OTP authentication |
| Home | `/(tabs)/home` | Map + nearby cases + alert banner |
| Alerts | `/(tabs)/alerts` | Scrollable feed of open cases |
| Profile | `/(tabs)/profile` | User info, authority badge, logout |
| Report Case | `/report-case` | Form + image upload |
| Case Detail | `/case/[id]` | Case info + sightings + live status |
| Upload Sighting | `/upload-sighting` | Camera + AI match result |

---

## 🔄 End-to-End Flow

```
1. User reports missing child
   → Image + details → POST /api/cases
   → Backend: insert to PostgreSQL (PostGIS coord)
   → Async: POST /ai/embeddings/store → FAISS indexed
   → Async: ST_DWithin query → FCM batch + WebSocket broadcast

2. Citizen spots child
   → Photo + location → POST /api/sightings
   → Backend: POST /ai/embeddings/match
   → AI: FaceNet embedding → FAISS search → confidence score
   → If ≥ 75%: FCM to all verified authorities + PATCH case status → investigating

3. Case resolved
   → Authority: PATCH /api/cases/:id/status {status: "found_safe"}
   → WebSocket: case_updated → all subscribed clients update UI
```

---

## 🛡 Security

- **Firebase OTP** — verified phone-based identity
- **JWT** with configurable expiry (default 7 days)
- **RBAC** — `citizen`, `authority`, `admin` roles
- **Face embeddings only** — raw images are never stored for matching (GDPR-friendly)
- **Signed S3 URLs** — images are not publicly accessible
- **Rate limiting** — 60 req/min per IP via NestJS Throttler
- **Confidence threshold** — prevents false positive authority notifications

---

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_DB` | Database name | `tracenow` |
| `POSTGRES_PASSWORD` | DB password | `tracenow_secret` |
| `REDIS_PASSWORD` | Redis auth | `redis_secret` |
| `JWT_SECRET` | JWT signing key | **MUST CHANGE** |
| `FIREBASE_SERVICE_ACCOUNT` | Base64 JSON | — |
| `AWS_ACCESS_KEY_ID` | S3 access key | — |
| `AWS_SECRET_ACCESS_KEY` | S3 secret | — |
| `AWS_S3_BUCKET` | S3 bucket name | — |
| `CONFIDENCE_THRESHOLD` | AI match threshold | `0.75` |
| `ALERT_RADIUS_KM` | Default alert radius | `5` |

---

## 🚀 Production Deployment (AWS)

```
EC2/ECS  →  backend + ai-service containers
RDS      →  PostgreSQL 15 + PostGIS
ElastiCache → Redis
S3       →  image storage
CloudFront → CDN for S3
ALB      →  load balancer (replaces Nginx)
```

Deploy with Docker images to ECS, point `DATABASE_URL` to RDS endpoint, and configure ALB rules.

---

## 📄 License

MIT © TraceNow Contributors
