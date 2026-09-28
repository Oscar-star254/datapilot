"""Account management: storage usage, delete account."""
from fastapi import APIRouter, Depends
from app.middleware.auth import get_current_user
from app.config import get_settings
from app.services.storage import get_usage

router = APIRouter(prefix="/account", tags=["account"])


def _get_supabase():
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


@router.get("/storage")
def storage_usage(user=Depends(get_current_user)):
    settings = get_settings()
    used, count = get_usage(user["user_id"])
    return {
        "used_bytes": used,
        "file_count": count,
        "limit_bytes": settings.storage_limit_bytes,
    }


@router.delete("", status_code=204)
def delete_account(user=Depends(get_current_user)):
    sb = _get_supabase()
    uid = user["user_id"]
    # Delete all user data in order
    sb.table("dashboards").delete().eq("user_id", uid).execute()
    sb.table("charts").delete().eq("user_id", uid).execute()
    sb.table("cleaning_pipelines").delete().eq("user_id", uid).execute()
    # Delete dataset files and records
    datasets_res = sb.table("datasets").select("file_path").eq("user_id", uid).execute()
    from app.services.storage import delete_file
    for ds in datasets_res.data or []:
        try:
            delete_file(ds["file_path"])
        except Exception:
            pass
    sb.table("datasets").delete().eq("user_id", uid).execute()
    # Delete auth user (admin API)
    try:
        sb.auth.admin.delete_user(uid)
    except Exception:
        pass
