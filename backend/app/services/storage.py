"""Supabase Storage helpers."""
import io
from supabase import create_client
from app.config import get_settings

BUCKET = "datasets"


def get_storage_client():
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def upload_file(user_id: str, dataset_id: str, filename: str, data: bytes) -> str:
    client = get_storage_client()
    path = f"{user_id}/{dataset_id}/{filename}"
    client.storage.from_(BUCKET).upload(path, data, {"content-type": "application/octet-stream", "x-upsert": "true"})
    return path


def download_file(path: str) -> bytes:
    client = get_storage_client()
    return client.storage.from_(BUCKET).download(path)


def delete_file(path: str) -> None:
    client = get_storage_client()
    client.storage.from_(BUCKET).remove([path])


def get_usage(user_id: str) -> tuple[int, int]:
    """Returns (used_bytes, file_count)."""
    client = get_storage_client()
    try:
        files = client.storage.from_(BUCKET).list(user_id)
        total = sum(f.get("metadata", {}).get("size", 0) for f in (files or []))
        return total, len(files or [])
    except Exception:
        return 0, 0
