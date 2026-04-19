from __future__ import annotations

import uuid
from typing import Optional
from pydantic import BaseModel, Field


# ─── Request ──────────────────────────────────────────────────────────────────

class StoreEmbeddingRequest(BaseModel):
    case_id: uuid.UUID
    embedding_type: str = "case"   # 'case' | 'sighting'


class MatchRequest(BaseModel):
    """Sent by the backend when a citizen uploads a sighting image."""
    top_k: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.75, ge=0.0, le=1.0)


# ─── Response ─────────────────────────────────────────────────────────────────

class EmbeddingResponse(BaseModel):
    embedding_id: uuid.UUID
    faiss_index: int
    case_id: Optional[uuid.UUID] = None
    sighting_id: Optional[uuid.UUID] = None
    model: str = "facenet"


class MatchResult(BaseModel):
    case_id: uuid.UUID
    confidence: float           # 0-1; higher = more similar
    faiss_index: int


class MatchResponse(BaseModel):
    matches: list[MatchResult]
    best_match: Optional[MatchResult] = None
    above_threshold: bool


class HealthResponse(BaseModel):
    status: str
    faiss_index_size: int
    model: str
