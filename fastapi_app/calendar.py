#calendar.py
from fastapi import APIRouter

router = APIRouter()

@router.get("/calendar")
def get_calendar():
    return {"message": "Calendar endpoint coming soon!"}
