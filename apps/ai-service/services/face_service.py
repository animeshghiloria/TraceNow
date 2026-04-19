"""
Face recognition service.

Uses DeepFace (FaceNet backend) for embedding generation and FAISS for fast
nearest-neighbour search over stored embeddings.

Index layout:
  - FAISS IndexFlatL2 over 128-dim FaceNet embeddings
  - faiss_index (int) ↔ embedding row in PostgreSQL
"""
from __future__ import annotations

import io
import os
import asyncio
import logging
import threading
from pathlib import Path
from typing import Optional

import numpy as np
import faiss
from PIL import Image
from deepface import DeepFace

from models.schemas import MatchResult

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 128          # FaceNet output size
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.75"))
FAISS_INDEX_PATH = os.getenv("FAISS_INDEX_PATH", "/app/data/faiss.index")

# --------------------------------------------------------------------------- #
# Global FAISS state (in-process, protected by a threading.Lock)             #
# --------------------------------------------------------------------------- #
_index: Optional[faiss.IndexFlatL2] = None
# Maps faiss position → case_id (UUID string). We keep a parallel list so we
# can return the original case_id when a match is found.
_id_map: list[str] = []
_lock = threading.Lock()


def _cosine_to_confidence(l2_distance: float) -> float:
    """
    Convert an L2 distance to a confidence score in [0, 1].
    FaceNet embeddings are L2-normalised, so L2 dist ∈ [0, 2].
    confidence = 1 − dist/2   →   dist=0 ⇒ 1.0, dist=2 ⇒ 0.0
    """
    dist = float(np.clip(l2_distance, 0.0, 2.0))
    return round(1.0 - dist / 2.0, 4)


# --------------------------------------------------------------------------- #
# Initialise / persist FAISS index                                             #
# --------------------------------------------------------------------------- #

def load_index(id_map: list[str]) -> None:
    """Called on startup. Hydrate _index and _id_map from disk if they exist."""
    global _index, _id_map
    with _lock:
        path = Path(FAISS_INDEX_PATH)
        if path.exists():
            _index = faiss.read_index(str(path))
            _id_map = id_map
            logger.info("FAISS index loaded from disk: %d vectors", _index.ntotal)
        else:
            _index = faiss.IndexFlatL2(EMBEDDING_DIM)
            _id_map = id_map
            logger.info("New FAISS index created (empty).")


def save_index() -> None:
    """Persist FAISS index to disk."""
    with _lock:
        if _index is not None:
            path = Path(FAISS_INDEX_PATH)
            path.parent.mkdir(parents=True, exist_ok=True)
            faiss.write_index(_index, str(path))


def index_size() -> int:
    with _lock:
        return _index.ntotal if _index is not None else 0


# --------------------------------------------------------------------------- #
# Embedding extraction                                                          #
# --------------------------------------------------------------------------- #

def extract_embedding(image_bytes: bytes) -> np.ndarray:
    """
    Decode image bytes → 128-dim L2-normalised FaceNet embedding.
    Raises ValueError if no face is detected.
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(img)

    result = DeepFace.represent(
        img_path=img_array,
        model_name="Facenet",
        enforce_detection=True,
        detector_backend="retinaface",
    )

    if not result:
        raise ValueError("No face detected in the provided image.")

    emb = np.array(result[0]["embedding"], dtype=np.float32)
    # L2-normalise so that L2 distance ≡ cosine distance
    norm = np.linalg.norm(emb)
    if norm > 0:
        emb = emb / norm
    return emb


# --------------------------------------------------------------------------- #
# Store embedding                                                               #
# --------------------------------------------------------------------------- #

def store_embedding(embedding: np.ndarray, case_id: str) -> int:
    """
    Add a single embedding to the FAISS index.
    Returns the faiss_index (position) assigned.
    """
    global _id_map
    with _lock:
        vec = embedding.reshape(1, -1).astype(np.float32)
        _index.add(vec)
        position = _index.ntotal - 1
        _id_map.append(case_id)

    # Persist asynchronously (cheap for flat index)
    save_index()
    return position


# --------------------------------------------------------------------------- #
# Search / match                                                                #
# --------------------------------------------------------------------------- #

def search_similar(
    query_embedding: np.ndarray,
    top_k: int = 5,
    threshold: float = CONFIDENCE_THRESHOLD,
) -> list[MatchResult]:
    """
    Search FAISS for the top-k nearest vectors.
    Returns only matches whose confidence ≥ threshold.
    """
    with _lock:
        if _index is None or _index.ntotal == 0:
            return []

        k = min(top_k, _index.ntotal)
        vec = query_embedding.reshape(1, -1).astype(np.float32)
        distances, indices = _index.search(vec, k)

    results: list[MatchResult] = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0:
            continue
        confidence = _cosine_to_confidence(dist)
        if confidence >= threshold:
            results.append(
                MatchResult(
                    case_id=_id_map[idx],
                    confidence=confidence,
                    faiss_index=int(idx),
                )
            )

    results.sort(key=lambda r: r.confidence, reverse=True)
    return results
