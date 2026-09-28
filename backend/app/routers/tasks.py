"""Task status polling."""
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/tasks", tags=["tasks"])

# Import shared task store
from app.routers.datasets import _tasks


@router.get("/{task_id}")
def get_task_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return {"task_id": task_id, **task}
