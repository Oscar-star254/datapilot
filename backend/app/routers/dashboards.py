"""Dashboard CRUD with public sharing."""
import uuid
import secrets
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user

router = APIRouter(tags=["dashboards"])


def _get_supabase():
    from supabase import create_client
    from app.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


class DashboardIn(BaseModel):
    name: str
    description: str = ""
    layout: list = []
    is_public: bool = False


@router.get("/dashboards")
def list_dashboards(user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("dashboards").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).execute()
    return res.data or []


@router.post("/dashboards")
def create_dashboard(req: DashboardIn, user=Depends(get_current_user)):
    sb = _get_supabase()
    data = {"id": str(uuid.uuid4()), "user_id": user["user_id"], **req.model_dump(), "public_slug": None}
    res = sb.table("dashboards").insert(data).execute()
    return res.data[0] if res.data else data


@router.put("/dashboards/{dashboard_id}")
def update_dashboard(dashboard_id: str, req: dict, user=Depends(get_current_user)):
    sb = _get_supabase()
    # Handle public toggle: generate/clear slug
    if "is_public" in req:
        existing_res = sb.table("dashboards").select("public_slug").eq("id", dashboard_id).eq("user_id", user["user_id"]).single().execute()
        if existing_res.data:
            existing_slug = existing_res.data.get("public_slug")
            if req["is_public"] and not existing_slug:
                req["public_slug"] = secrets.token_urlsafe(8)
            elif not req["is_public"]:
                req["public_slug"] = None

    res = sb.table("dashboards").update(req).eq("id", dashboard_id).eq("user_id", user["user_id"]).execute()
    if not res.data:
        raise HTTPException(404, "Dashboard not found")
    return res.data[0]


@router.delete("/dashboards/{dashboard_id}", status_code=204)
def delete_dashboard(dashboard_id: str, user=Depends(get_current_user)):
    sb = _get_supabase()
    sb.table("dashboards").delete().eq("id", dashboard_id).eq("user_id", user["user_id"]).execute()


@router.get("/public/dashboards/{slug}")
def get_public_dashboard(slug: str):
    sb = _get_supabase()
    res = sb.table("dashboards").select("*").eq("public_slug", slug).eq("is_public", True).single().execute()
    if not res.data:
        raise HTTPException(404, "Dashboard not found")
    return res.data
