"""
AWS S3 storage helpers for the AI microservice.
Falls back to local filesystem if AWS creds are not set (dev mode).
"""
from __future__ import annotations

import os
import uuid
import logging
from io import BytesIO
from pathlib import Path
from typing import Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET = os.getenv("AWS_S3_BUCKET", "")
_USE_S3 = bool(S3_BUCKET and os.getenv("AWS_ACCESS_KEY_ID"))

_s3_client = None
if _USE_S3:
    _s3_client = boto3.client("s3", region_name=AWS_REGION)

LOCAL_UPLOAD_DIR = Path("/app/data/uploads")
LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def upload_image(image_bytes: bytes, prefix: str = "uploads") -> str:
    """
    Upload image bytes to S3 (or local disk in dev mode).
    Returns the public URL / local path.
    """
    key = f"{prefix}/{uuid.uuid4().hex}.jpg"

    if _USE_S3:
        try:
            _s3_client.put_object(
                Bucket=S3_BUCKET,
                Key=key,
                Body=image_bytes,
                ContentType="image/jpeg",
            )
            return f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
        except ClientError as exc:
            logger.error("S3 upload failed: %s", exc)
            raise

    # Local fallback
    local_path = LOCAL_UPLOAD_DIR / Path(key).name
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(image_bytes)
    return f"file://{local_path}"


def get_signed_url(s3_url: str, expires: int = 3600) -> Optional[str]:
    """Generate a signed URL for private S3 objects."""
    if not _USE_S3 or not s3_url.startswith("https://"):
        return s3_url

    key = "/".join(s3_url.split("/")[3:])
    try:
        return _s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=expires,
        )
    except ClientError as exc:
        logger.error("Failed to generate signed URL: %s", exc)
        return s3_url
