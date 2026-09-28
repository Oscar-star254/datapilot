"""Dataset upload, list, delete, profile, paginated data view."""
import io
import uuid
import asyncio
from typing import Any
import pandas as pd
import numpy as np

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Query, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.config import get_settings
from app.services.storage import upload_file, download_file, delete_file
from app.services.profiler import profile_dataframe
from app.services.data_loader import load_dataframe, apply_pipeline

router = APIRouter(prefix="/datasets", tags=["datasets"])

# In-memory task store (use Redis in production)
_tasks: dict[str, dict] = {}
# In-memory dataset metadata (use DB in production - this is backed by Supabase)
_meta: dict[str, dict] = {}


def _get_supabase():
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def _require_dataset(dataset_id: str, user_id: str) -> dict:
    sb = _get_supabase()
    res = sb.table("datasets").select("*").eq("id", dataset_id).eq("user_id", user_id).single().execute()
    if not res.data:
        raise HTTPException(404, "Dataset not found")
    return res.data


def _get_df(dataset_id: str, user_id: str, pipeline_id: str | None = None) -> pd.DataFrame:
    ds = _require_dataset(dataset_id, user_id)
    df = load_dataframe(ds["file_path"], ds["file_type"])
    if pipeline_id:
        sb = _get_supabase()
        pipe_res = sb.table("cleaning_pipelines").select("*").eq("id", pipeline_id).eq("user_id", user_id).single().execute()
        if pipe_res.data:
            df = apply_pipeline(df, pipe_res.data.get("steps", []))
    return df


async def _process_upload(task_id: str, dataset_id: str, user_id: str, file_path: str, file_type: str):
    _tasks[task_id] = {"status": "running", "progress": 10, "message": "Loading file…"}
    try:
        df = await asyncio.to_thread(load_dataframe, file_path, file_type)
        _tasks[task_id]["progress"] = 50
        _tasks[task_id]["message"] = "Profiling…"
        profile = await asyncio.to_thread(profile_dataframe, df)
        _tasks[task_id]["progress"] = 90

        sb = _get_supabase()
        sb.table("datasets").update({
            "status": "ready",
            "row_count": len(df),
            "column_count": len(df.columns),
            "profile": profile,
        }).eq("id", dataset_id).execute()

        _tasks[task_id] = {"status": "completed", "progress": 100, "message": "Done"}
    except Exception as e:
        _tasks[task_id] = {"status": "failed", "progress": 0, "message": str(e), "error": str(e)}
        sb = _get_supabase()
        sb.table("datasets").update({"status": "error"}).eq("id", dataset_id).execute()


@router.post("/upload")
async def upload_dataset(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    name: str = Form(...),
    user=Depends(get_current_user),
):
    settings = get_settings()
    user_id = user["user_id"]
    content = await file.read()

    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(400, f"File exceeds {settings.max_file_size_mb} MB limit")

    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("csv", "xlsx", "xls", "json"):
        raise HTTPException(400, "Unsupported file type. Use CSV, XLSX, or JSON.")
    file_type = "xlsx" if ext in ("xlsx", "xls") else ext

    dataset_id = str(uuid.uuid4())
    task_id = str(uuid.uuid4())

    file_path = await asyncio.to_thread(upload_file, user_id, dataset_id, filename, content)

    sb = _get_supabase()
    sb.table("datasets").insert({
        "id": dataset_id,
        "user_id": user_id,
        "name": name,
        "original_filename": filename,
        "file_path": file_path,
        "file_size": len(content),
        "file_type": file_type,
        "status": "profiling",
        "row_count": 0,
        "column_count": 0,
    }).execute()

    background_tasks.add_task(_process_upload, task_id, dataset_id, user_id, file_path, file_type)
    _tasks[task_id] = {"status": "pending", "progress": 0, "message": "Queued"}

    return {"task_id": task_id, "dataset_id": dataset_id}


@router.get("")
def list_datasets(user=Depends(get_current_user)):
    sb = _get_supabase()
    res = sb.table("datasets").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).execute()
    return res.data or []


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str, user=Depends(get_current_user)):
    return _require_dataset(dataset_id, user["user_id"])


@router.patch("/{dataset_id}")
def rename_dataset(dataset_id: str, body: dict, user=Depends(get_current_user)):
    _require_dataset(dataset_id, user["user_id"])
    name = body.get("name", "").strip()
    if not name:
        raise HTTPException(400, "Name is required")
    sb = _get_supabase()
    res = sb.table("datasets").update({"name": name}).eq("id", dataset_id).execute()
    return res.data[0] if res.data else {}


@router.delete("/{dataset_id}", status_code=204)
def delete_dataset(dataset_id: str, user=Depends(get_current_user)):
    ds = _require_dataset(dataset_id, user["user_id"])
    try:
        delete_file(ds["file_path"])
    except Exception:
        pass
    sb = _get_supabase()
    sb.table("datasets").delete().eq("id", dataset_id).execute()
    # Also delete related pipelines/charts
    sb.table("cleaning_pipelines").delete().eq("dataset_id", dataset_id).execute()


@router.get("/{dataset_id}/data")
def get_data_page(
    dataset_id: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    sort_column: str | None = None,
    sort_direction: str = "asc",
    pipeline_id: str | None = None,
    filters: str | None = None,
    user=Depends(get_current_user),
):
    import json
    df = _get_df(dataset_id, user["user_id"], pipeline_id)

    # Apply filters
    if filters:
        try:
            filter_list = json.loads(filters)
            for f in filter_list:
                col, op, val = f.get("column"), f.get("operator"), f.get("value")
                if col and col in df.columns:
                    s = df[col]
                    if op == "eq": df = df[s == val]
                    elif op == "neq": df = df[s != val]
                    elif op == "gt": df = df[pd.to_numeric(s, errors="coerce") > float(val)]
                    elif op == "gte": df = df[pd.to_numeric(s, errors="coerce") >= float(val)]
                    elif op == "lt": df = df[pd.to_numeric(s, errors="coerce") < float(val)]
                    elif op == "lte": df = df[pd.to_numeric(s, errors="coerce") <= float(val)]
                    elif op == "contains": df = df[s.astype(str).str.contains(str(val), na=False)]
                    elif op == "not_contains": df = df[~s.astype(str).str.contains(str(val), na=False)]
                    elif op == "is_null": df = df[s.isna()]
                    elif op == "not_null": df = df[s.notna()]
        except Exception:
            pass

    if sort_column and sort_column in df.columns:
        df = df.sort_values(sort_column, ascending=(sort_direction == "asc"))

    total = len(df)
    start = (page - 1) * page_size
    page_df = df.iloc[start:start + page_size]

    def safe_val(v: Any) -> Any:
        if isinstance(v, (np.integer,)): return int(v)
        if isinstance(v, (np.floating,)): return None if np.isnan(v) else float(v)
        if pd.isna(v) if not isinstance(v, str) else False: return None
        return v

    records = [{col: safe_val(row[col]) for col in page_df.columns} for _, row in page_df.iterrows()]

    return {
        "data": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size),
    }


@router.get("/{dataset_id}/export")
def export_data(
    dataset_id: str,
    format: str = Query("csv", pattern="^(csv|xlsx|json)$"),
    pipeline_id: str | None = None,
    user=Depends(get_current_user),
):
    ds = _require_dataset(dataset_id, user["user_id"])
    df = _get_df(dataset_id, user["user_id"], pipeline_id)

    buf = io.BytesIO()
    if format == "csv":
        df.to_csv(buf, index=False)
        media_type = "text/csv"
        suffix = "csv"
    elif format == "xlsx":
        df.to_excel(buf, index=False)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        suffix = "xlsx"
    else:
        df.to_json(buf, orient="records")
        media_type = "application/json"
        suffix = "json"

    buf.seek(0)
    fname = ds.get("name", "export")
    return StreamingResponse(buf, media_type=media_type, headers={"Content-Disposition": f'attachment; filename="{fname}.{suffix}"'})


class ChartDataRequest(BaseModel):
    x_column: str | None = None
    y_column: str | None = None
    group_by: str | None = None
    aggregation: str = "sum"
    chart_type: str = "bar"
    pipeline_id: str | None = None
    resample: str | None = None
    moving_avg: int | None = None
    forecast_periods: int | None = None


@router.post("/{dataset_id}/chart-data")
def get_chart_data(dataset_id: str, req: ChartDataRequest, user=Depends(get_current_user)):
    from app.services.chart_data import prepare_chart_data
    df = _get_df(dataset_id, user["user_id"], req.pipeline_id)
    return prepare_chart_data(df, req.model_dump())


@router.get("/{dataset_id}/stats/descriptive")
def descriptive_stats(dataset_id: str, pipeline_id: str | None = None, user=Depends(get_current_user)):
    from app.services.analytics import descriptive_stats as ds_fn
    df = _get_df(dataset_id, user["user_id"], pipeline_id)
    return {"result": ds_fn(df)}


@router.get("/{dataset_id}/stats/correlation")
def correlation(dataset_id: str, method: str = "pearson", pipeline_id: str | None = None, user=Depends(get_current_user)):
    from app.services.analytics import correlation_matrix
    df = _get_df(dataset_id, user["user_id"], pipeline_id)
    return {"result": correlation_matrix(df, method)}


class RegressionRequest(BaseModel):
    target: str
    features: list[str] = []
    type: str = "linear"
    pipeline_id: str | None = None


@router.post("/{dataset_id}/stats/regression")
def regression(dataset_id: str, req: RegressionRequest, user=Depends(get_current_user)):
    from app.services.analytics import run_regression
    df = _get_df(dataset_id, user["user_id"], req.pipeline_id)
    numeric_cols = df.select_dtypes(include=["number"]).columns.tolist()
    features = [f for f in (req.features or numeric_cols) if f != req.target and f in df.columns]
    if not features:
        raise HTTPException(400, "No numeric feature columns found")
    result = run_regression(df, req.target, features, req.type)
    return {"result": result}


class HypothesisRequest(BaseModel):
    test: str
    col1: str
    col2: str | None = None
    pipeline_id: str | None = None


@router.post("/{dataset_id}/stats/hypothesis")
def hypothesis_test(dataset_id: str, req: HypothesisRequest, user=Depends(get_current_user)):
    from app.services.analytics import run_hypothesis_test
    df = _get_df(dataset_id, user["user_id"], req.pipeline_id)
    result = run_hypothesis_test(df, req.test, req.col1, req.col2)
    return {"result": result}


class QueryRequest(BaseModel):
    sql: str
    pipeline_id: str | None = None


@router.post("/{dataset_id}/query")
def run_sql(dataset_id: str, req: QueryRequest, user=Depends(get_current_user)):
    import duckdb, time
    settings = get_settings()
    sql = req.sql.strip()
    # Basic security: only SELECT allowed
    if not sql.upper().lstrip("(").startswith("SELECT") and not sql.upper().lstrip("(").startswith("WITH"):
        raise HTTPException(400, "Only SELECT queries are allowed")
    if ";" in sql.rstrip(";"):
        raise HTTPException(400, "Multiple statements not allowed")

    df = _get_df(dataset_id, user["user_id"], req.pipeline_id)
    data = df  # exposed as 'data' in DuckDB  # noqa

    con = duckdb.connect()
    try:
        start = time.time()
        result = con.execute(sql).fetchall()
        elapsed = int((time.time() - start) * 1000)
        cols = [d[0] for d in con.description or []]
        return {"columns": cols, "rows": [list(r) for r in result[:10000]], "row_count": len(result), "duration_ms": elapsed}
    except Exception as e:
        raise HTTPException(400, str(e))
    finally:
        con.close()
