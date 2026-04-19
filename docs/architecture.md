# TraceNow — System Architecture

## Overview

TraceNow is a hyperlocal real-time alert platform for missing child cases.  
It combines community sighting reports, AI-powered face matching, and geofenced push notifications to minimize response time.

---

## Component Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NGINX Reverse Proxy                          │
│           /api  →  NestJS Backend                                    │
│           /ai   →  FastAPI AI Microservice                           │
│           /     →  WebSocket (Socket.IO passthrough)                 │
└────────────────────────┬─────────────────┬───────────────────────────┘
                         │                 │
        ┌────────────────▼───┐   ┌─────────▼──────────────────┐
        │  NestJS Backend     │   │  FastAPI AI Microservice   │
        │                     │   │                            │
        │  REST API           │   │  /embeddings/store         │
        │  WebSocket Gateway  │   │  /embeddings/match         │
        │  FCM Notifications  │   │  FaceNet + FAISS           │
        │  RBAC (JWT + roles) │   │  S3 image upload           │
        └────────┬────────────┘   └───────────┬────────────────┘
                 │                             │
    ┌────────────▼─────────────────────────────▼────────────┐
    │                  PostgreSQL + PostGIS                  │
    │                                                        │
    │  users · cases · sightings · alerts · embeddings       │
    │                                                        │
    │  Spatial indexes: ST_DWithin, users_within_radius()   │
    └────────────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────────────┐
    │              Redis (planned: rate limit cache)         │
    └────────────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────────────┐
    │               AWS S3 (image storage)                   │
    │   cases/{uuid}.jpg  ·  sightings/{uuid}.jpg            │
    └────────────────────────────────────────────────────────┘
    ┌────────────────────────────────────────────────────────┐
    │               FAISS (in-process, AI service)           │
    │   IndexFlatL2 · 128-dim FaceNet embeddings             │
    │   Persisted to disk: /app/data/faiss.index             │
    └────────────────────────────────────────────────────────┘
```

---

## Mobile App (React Native / Expo)

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `/(auth)/login` | Firebase Phone OTP login |
| Home | `/(tabs)/home` | Google Map + nearby case markers + alert banner |
| Alerts | `/(tabs)/alerts` | Scrollable feed of active cases |
| Search | `/(tabs)/search` | Search + filter all cases by name/status |
| Profile | `/(tabs)/profile` | User info, live stats, name editing, logout |
| Case Detail | `/case/[id]` | Full case info, sightings, live WS updates |
| Report Case | `/report-case` | Multipart form: name, age, photo, GPS |
| Upload Sighting | `/upload-sighting` | Photo + GPS + AI confidence result |
| Authority Dashboard | `/authority/dashboard` | Case management for verified authorities |

### State management
- **React Query** — server state, cache invalidation, polling
- **AuthContext** — JWT + Firebase session, persisted via SecureStore
- **Socket.IO** — real-time updates (new case, sighting match, case status change)

---

## Backend Modules (NestJS)

| Module | Responsibilities |
|--------|-----------------|
| `AuthModule` | Firebase token verification → JWT issuance |
| `UsersModule` | User CRUD, GPS location update, FCM token, stats |
| `CasesModule` | Case CRUD, PostGIS nearby query, status management (RBAC) |
| `SightingsModule` | Sighting upload, AI match trigger, authority notification |
| `AlertsModule` | `users_within_radius` query → FCM batch + WS emit |
| `RealtimeModule` | Socket.IO gateway — case rooms + area subscriptions |
| `NotificationsModule` | Firebase Cloud Messaging (FCM) multicast wrapper |
| `StorageModule` | AWS S3 upload (buffer → signed URL) |
| `HealthModule` | Health check endpoint for Docker compose |

---

## AI Microservice (FastAPI)

| Endpoint | Role |
|----------|------|
| `POST /embeddings/store` | Extract FaceNet embedding from case photo → FAISS + PostgreSQL |
| `POST /embeddings/match` | Query FAISS with sighting photo → confidence scores |
| `POST /embeddings/generate` | Raw embedding extraction (dev/debug) |
| `GET /embeddings/{case_id}` | List stored embeddings for a case |
| `GET /health` | Liveness check + FAISS index size |

**Matching pipeline:**
1. Image decode → PIL → numpy array
2. DeepFace `FaceNet` model → 128-dim L2-normalised embedding
3. FAISS `IndexFlatL2` nearest-neighbour search (top-k)
4. L2 distance → confidence score: `1 − dist/2`
5. Results filtered by configurable threshold (default 0.75)

---

## End-to-End Flows

### Flow 1: Case Reported

```
Citizen POSTs /api/cases (multipart)
  → Backend inserts case (PostGIS coord)
  → [async] POST /ai/embeddings/store → FaceNet → FAISS indexed
  → [async] users_within_radius() → FCM batch + WS broadcast
  → Case appears on all nearby clients' maps within seconds
```

### Flow 2: Sighting Uploaded

```
Citizen POSTs /api/sightings (photo + GPS)
  → Backend inserts sighting
  → POST /ai/embeddings/match → FAISS search
  → If confidence ≥ 0.75:
      → FCM to all verified authorities
      → PATCH case status → "investigating"
      → WS case_updated event → all subscribed clients
```

### Flow 3: Case Resolved

```
Authority opens /authority/dashboard
  → Taps "Found Safe" on case card
  → PATCH /api/cases/:id/status (authority/admin JWT required)
  → WS case_updated broadcast
  → All clients show case as "Found Safe"
```

---

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Phone identity | Firebase Phone Auth (OTP) |
| API auth | JWT (HS256, 7-day expiry) |
| Role enforcement | `RolesGuard` + `@Roles()` decorator on sensitive endpoints |
| Rate limiting | NestJS Throttler: 60 req/min per IP |
| Image access | S3 (public-read, CDN-accessible; no PII in filenames) |
| Face data | Embeddings only stored (not raw photos) in FAISS |
| Confidence gate | 0.75 threshold prevents false-positive authority alerts |

---

## Database Schema (key tables)

```sql
users         (id, phone, name, role, fcm_token, location GEOGRAPHY, is_active)
cases         (id, reporter_id, child_name, child_age, last_seen_loc GEOGRAPHY,
               status, image_url, embedding_id, alert_radius_km)
sightings     (id, case_id, uploader_id, location GEOGRAPHY, image_url,
               confidence, is_verified, notes)
alerts        (id, case_id, user_id, channel)   -- dedup prevention
embeddings    (id, case_id, sighting_id, embedding_type, faiss_index, model)
authorities   (id, user_id, badge_number, department, verified)
```

Key PostGIS function:
```sql
users_within_radius(p_lng, p_lat, p_radius_km)
  → TABLE(user_id, phone, fcm_token, distance)
```

---

## Infrastructure

```
Production (AWS):
  ECS             → backend + ai-service containers
  RDS (Postgres)  → PostgreSQL 15 + PostGIS 3.3
  ElastiCache     → Redis
  S3 + CloudFront → image storage + CDN
  ALB             → load balancing (replaces Nginx)

Local Dev (Docker Compose):
  postgis/postgis:15-3.3  → port 5432
  redis:7-alpine          → port 6379
  ai-service (FastAPI)    → port 8000
  backend (NestJS)        → port 3000
  nginx:1.25-alpine       → port 80 / 443
```
