#fastapi_app/equipments.py
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel
import matplotlib.pyplot as plt
import sqlite3, io, base64, os
import pandas as pd

from fastapi_app.dependencies import get_current_user, require_role

router = APIRouter()

def get_db():
    return sqlite3.connect("hospital_equipment_system.db")

# Pydantic model
class EquipmentIn(BaseModel):
    equipment_id: str
    type: str
    manufacturer: str
    location: str
    criticality: str
    installation_date: str

# List Equipments (allowed for all authenticated users)
@router.get("/")
def list_equipments(
    type: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM equipment WHERE 1=1"
    params = []

    if type:
        query += " AND type = ?"
        params.append(type)
    if location:
        query += " AND location = ?"
        params.append(location)

    # Restrict technician to only "Scheduled" equipment
    if user["role"] == "technician":
        query += " AND equipment_id IN (SELECT DISTINCT equipment_id FROM maintenance_logs WHERE status = 'Scheduled')"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    return {"equipments": rows}

# Get Equipment Details + Trend Chart
@router.get("/{equipment_id}")
def get_equipment(equipment_id: str, user=Depends(get_current_user)):
    from generate_equipment_report import fetch_equipment_metrics

    conn = get_db()
    cursor = conn.cursor()

    # Technician can access only "Scheduled" equipment
    if user["role"] == "technician":
        cursor.execute("SELECT COUNT(*) FROM maintenance_logs WHERE equipment_id = ? AND status = 'Scheduled'", (equipment_id,))
        if cursor.fetchone()[0] == 0:
            raise HTTPException(status_code=403, detail="Not authorized for this equipment")

    cursor.execute("SELECT * FROM equipment WHERE equipment_id = ?", (equipment_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Equipment not found")

    # Generate trend graph
    try:
        metrics = fetch_equipment_metrics(equipment_id)
        chart_path = metrics.get("chart_path")
        img_data = ""
        if chart_path and os.path.exists(chart_path):
            with open(chart_path, "rb") as f:
                encoded = base64.b64encode(f.read()).decode('utf-8')
                img_data = f"data:image/png;base64,{encoded}"
        return {
            "equipment": row,
            "trend_plot": img_data
        }
    except Exception:
        return {
            "equipment": row,
            "trend_plot": None
        }

# Add Equipment (admin only)
@router.post("/", dependencies=[Depends(require_role("admin"))])
def add_equipment(data: EquipmentIn):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO equipment (equipment_id, type, manufacturer, location, criticality, installation_date)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        data.equipment_id, data.type, data.manufacturer,
        data.location, data.criticality, data.installation_date
    ))
    conn.commit()
    conn.close()
    return {"message": "Equipment added"}

# Update Equipment (admin only)
@router.put("/{equipment_id}", dependencies=[Depends(require_role("admin"))])
def update_equipment(equipment_id: str, data: EquipmentIn):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE equipment SET type = ?, manufacturer = ?, location = ?, criticality = ?, installation_date = ?
        WHERE equipment_id = ?
    """, (
        data.type, data.manufacturer, data.location,
        data.criticality, data.installation_date, equipment_id
    ))
    conn.commit()
    conn.close()
    return {"message": "Equipment updated"}

# Delete Equipment (admin only)
@router.delete("/{equipment_id}", dependencies=[Depends(require_role("admin"))])
def delete_equipment(equipment_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM equipment WHERE equipment_id = ?", (equipment_id,))
    conn.commit()
    conn.close()
    return {"message": "Equipment deleted"}
