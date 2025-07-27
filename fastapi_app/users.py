#users.py
# fastapi_app/users.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import sqlite3
from passlib.context import CryptContext

from fastapi_app.dependencies import get_current_user, require_role

router = APIRouter()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_db():
    return sqlite3.connect("hospital_equipment_system.db")

# --- Pydantic Model for input ---
class UserIn(BaseModel):
    personnel_id: str
    name: str
    role: str  # e.g., admin, biomedical, technician
    department: str
    experience_years: int
    username: str
    password: str  # plain password from frontend

# --- Show current logged-in user’s full profile ---
@router.get("/me")
def who_am_i(user=Depends(get_current_user)):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT personnel_id, name, role, department, experience_years, username 
        FROM personnel WHERE username = ?
    """, (user["username"],))
    result = cursor.fetchone()
    conn.close()

    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    keys = ["personnel_id", "name", "role", "department", "experience_years", "username"]
    return dict(zip(keys, result))

# --- List all users (admin only) ---
@router.get("/", dependencies=[Depends(require_role("admin"))])
def list_users():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT personnel_id, name, role, department, experience_years FROM personnel
    """)
    users = cursor.fetchall()
    conn.close()
    return {"users": users}

# --- Add a new user (admin only) ---
@router.post("/", dependencies=[Depends(require_role("admin"))])
def add_user(user: UserIn):
    conn = get_db()
    cursor = conn.cursor()

    hashed_password = pwd_context.hash(user.password)

    cursor.execute("""
        INSERT INTO personnel (personnel_id, name, role, department, experience_years, username, password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        user.personnel_id, user.name, user.role,
        user.department, user.experience_years,
        user.username, hashed_password
    ))

    conn.commit()
    conn.close()
    return {"message": "User added"}

# --- Delete user by ID (admin only) ---
@router.delete("/{personnel_id}", dependencies=[Depends(require_role("admin"))])
def delete_user(personnel_id: str):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM personnel WHERE personnel_id = ?", (personnel_id,))
    conn.commit()
    conn.close()
    return {"message": f"User {personnel_id} deleted"}
