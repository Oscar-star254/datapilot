"""Chart CRUD."""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/charts", tags=["charts"])


def _get_supabase():
    from supabase import create_client
    from app.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


class ChartIn(BaseModel):
    name: str
    dataset_id: str
    pipeline_id: str | None = None
    chart_type: str
    config: dict = {}


@router.get("")
def list_charts(user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("charts").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).execute()
    return res.data or []


@router.post("")
def create_chart(req: ChartIn, user=Depends(get_current_user)):
    sb = _get_supabase()
    data = {"id": str(uuid.uuid4()), "user_id": user["user_id"], **req.model_dump()}
    res = sb.table("charts").insert(data).execute()
    return res.data[0] if res.data else data


@router.put("/{chart_id}")
def update_chart(chart_id: str, req: ChartIn, user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("charts").update(req.model_dump()).eq("id", chart_id).eq("user_id", user["user_id"]).execute()
    if not res.data:
        raise HTTPException(404, "Chart not found")
    return res.data[0]


@router.delete("/{chart_id}", status_code=204)
def delete_chart(chart_id: str, user=Depends(get_current_user)):
    sb = _get_supabase()
    sb.table("charts").delete().eq("id", chart_id).eq("user_id", user["user_id"]).execute()
