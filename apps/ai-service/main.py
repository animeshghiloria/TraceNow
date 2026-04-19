"""
TraceNow — AI Microservice entry point.

Startup sequence:
  1. Connect to PostgreSQL and hydrate the FAISS id_map from the embeddings table.
  2. Load FAISS index from disk (or create a fresh one).
  3. Mount all routers.
  4. Expose /health endpoint.
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from db.database import engine, AsyncSessionLocal
from routers import embeddings as embeddings_router
from services import face_service
from models.schemas import HealthResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ─── Lifespan (startup / shutdown) ────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Hydrate FAISS index from PostgreSQL on startup."""
    logger.info("AI service starting up…")

    async with AsyncSessionLocal() as session:
        rows = await session.execute(
            text("""
                SELECT case_id::text, faiss_index
                FROM embeddings
                WHERE embedding_type = 'case'
                ORDER BY faiss_index ASC
            """)
        )
        records = rows.mappings().all()

    # Build id_map: position → case_id string
    id_map: list[str] = [""] * (len(records))
    for r in records:
        idx = r["faiss_index"]
        if 0 <= idx < len(id_map):
            id_map[idx] = r["case_id"]

    face_service.load_index(id_map)
    logger.info("FAISS index ready: %d vectors loaded.", face_service.index_size())

    yield  # app running

    logger.info("AI service shutting down — saving FAISS index…")
    face_service.save_index()


# ─── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="TraceNow AI Service",
    description="Face embedding generation and matching for the TraceNow platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(embeddings_router.router)


# ─── Health ───────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    return HealthResponse(
        status="ok",
        faiss_index_size=face_service.index_size(),
        model="facenet",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=False,
    )
