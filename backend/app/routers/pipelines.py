"""Cleaning pipeline CRUD."""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.middleware.auth import get_current_user

router = APIRouter(tags=["pipelines"])


def _get_supabase():
    from supabase import create_client
    from app.config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


@router.get("/datasets/{dataset_id}/pipelines")
def list_pipelines(dataset_id: str, user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("cleaning_pipelines").select("*").eq("dataset_id", dataset_id).eq("user_id", user["user_id"]).order("created_at").execute()
    return res.data or []


class CreatePipelineRequest(BaseModel):
    name: str


@router.post("/datasets/{dataset_id}/pipelines")
def create_pipeline(dataset_id: str, req: CreatePipelineRequest, user=Depends(get_current_user)):
    import uuid
    sb = _get_supabase()
    data = {
        "id": str(uuid.uuid4()),
        "dataset_id": dataset_id,
        "user_id": user["user_id"],
        "name": req.name,
        "steps": [],
    }
    res = sb.table("cleaning_pipelines").insert(data).execute()
    return res.data[0] if res.data else data


class UpdatePipelineRequest(BaseModel):
    steps: list


@router.put("/pipelines/{pipeline_id}")
def update_pipeline(pipeline_id: str, req: UpdatePipelineRequest, user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("cleaning_pipelines").update({"steps": req.steps}).eq("id", pipeline_id).eq("user_id", user["user_id"]).execute()
    if not res.data:
        raise HTTPException(404, "Pipeline not found")
    return res.data[0]


@router.delete("/pipelines/{pipeline_id}", status_code=204)
def delete_pipeline(pipeline_id: str, user=Depends(get_current_user)):
    sb = _get_supabase()
    sb.table("cleaning_pipelines").delete().eq("id", pipeline_id).eq("user_id", user["user_id"]).execute()
