#models.py
from pydantic import BaseModel
from typing import Optional

class Equipment(BaseModel):
    equipment_id: str
    type: str
    manufacturer: str
    location: str
    criticality: str
    installation_date: str

class MaintenanceLog(BaseModel):
    maintenance_id: str
    equipment_id: str
    date: str
    maintenance_type: str
    downtime_hours: float
    cost_inr: float
    issue_description: str
    parts_replaced: str
    vendor: str
    technician_id: str
    service_rating: int
    response_time_hours: float
    completion_status: str
    warranty_covered: str
    next_service_due: str
    status: str

class UserCreate(BaseModel):
    personnel_id: str
    name: str
    role: str
    department: str
    experience_years: float
    username: str
    password: str
