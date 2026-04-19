"""
Embeddings router — core AI endpoints.

POST /embeddings/generate    → upload image, extract embedding, return vector
POST /embeddings/store       → store embedding in FAISS + DB (for a case)
POST /embeddings/match       → match a sighting image against stored embeddings
GET  /embeddings/{case_id}   → retrieve embedding metadata for a case
"""
from __future__ import annotations

import uuid
import logging
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from db.database import get_db
from models.schemas import (
    EmbeddingResponse,
    MatchRequest,
    MatchResponse,
    MatchResult,
)
from services import face_service, storage_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/embeddings", tags=["Embeddings"])

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB


async def _read_image(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported image type: {file.content_type}. Use JPEG, PNG or WebP.",
        )
    data = await file.read()
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image too large (max 10 MB).")
    return data


# ─── POST /embeddings/generate ────────────────────────────────────────────────
@router.post("/generate", response_model=dict)
async def generate_embedding(
    image: UploadFile = File(..., description="Child or sighting photo"),
):
    """
    Extract a FaceNet embedding from an uploaded image.
    Returns the raw embedding vector (for inspection / testing).
    """
    image_bytes = await _read_image(image)
    try:
        emb = face_service.extract_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    return {"embedding": emb.tolist(), "dim": len(emb)}


# ─── POST /embeddings/store ────────────────────────────────────────────────────
@router.post("/store", response_model=EmbeddingResponse, status_code=201)
async def store_embedding(
    image: UploadFile = File(...),
    case_id: uuid.UUID = Form(...),
    embedding_type: str = Form(default="case"),
    db: AsyncSession = Depends(get_db),
):
    """
    1. Extract embedding from image.
    2. Upload image to S3.
    3. Add embedding to FAISS index.
    4. Insert embedding metadata into PostgreSQL.
    5. Return EmbeddingResponse.
    """
    image_bytes = await _read_image(image)

    # Extract embedding
    try:
        emb = face_service.extract_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Upload image
    prefix = "cases" if embedding_type == "case" else "sightings"
    try:
        image_url = storage_service.upload_image(image_bytes, prefix=prefix)
    except Exception as exc:
        logger.error("Image upload failed: %s", exc)
        raise HTTPException(status_code=502, detail="Image storage failed.")

    # Store in FAISS
    faiss_pos = face_service.store_embedding(emb, str(case_id))

    # Persist metadata in PostgreSQL
    embedding_id = uuid.uuid4()
    await db.execute(
        text("""
            INSERT INTO embeddings (id, case_id, embedding_type, faiss_index, model)
            VALUES (:id, :case_id, :embedding_type, :faiss_index, 'facenet')
        """),
        {
            "id": str(embedding_id),
            "case_id": str(case_id),
            "embedding_type": embedding_type,
            "faiss_index": faiss_pos,
        },
    )
    await db.commit()

    return EmbeddingResponse(
        embedding_id=embedding_id,
        faiss_index=faiss_pos,
        case_id=case_id,
        model="facenet",
    )


# ─── POST /embeddings/match ────────────────────────────────────────────────────
@router.post("/match", response_model=MatchResponse)
async def match_embedding(
    image: UploadFile = File(..., description="Sighting photo to match"),
    top_k: int = Form(default=5),
    threshold: float = Form(default=0.75),
):
    """
    1. Extract embedding from sighting image.
    2. Search FAISS index for top-k nearest neighbours.
    3. Filter by confidence threshold.
    4. Return ranked matches.
    """
    image_bytes = await _read_image(image)

    try:
        query_emb = face_service.extract_embedding(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    matches = face_service.search_similar(query_emb, top_k=top_k, threshold=threshold)

    best = matches[0] if matches else None
    above = bool(matches)

    return MatchResponse(
        matches=matches,
        best_match=best,
        above_threshold=above,
    )


# ─── GET /embeddings/{case_id} ───────────────────────────────────────────────
@router.get("/{case_id}", response_model=list[EmbeddingResponse])
async def get_embeddings_for_case(
    case_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Return all stored embeddings for a given case."""
    rows = await db.execute(
        text("""
            SELECT id, case_id, sighting_id, embedding_type, faiss_index, model
            FROM embeddings
            WHERE case_id = :case_id
            ORDER BY created_at DESC
        """),
        {"case_id": str(case_id)},
    )
    results = rows.mappings().all()
    if not results:
        raise HTTPException(status_code=404, detail="No embeddings found for this case.")

    return [
        EmbeddingResponse(
            embedding_id=r["id"],
            faiss_index=r["faiss_index"],
            case_id=r["case_id"],
            sighting_id=r.get("sighting_id"),
            model=r["model"],
        )
        for r in results
    ]
