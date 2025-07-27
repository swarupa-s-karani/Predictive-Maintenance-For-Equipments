# fastapi_app/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import sqlite3

SECRET_KEY = "your-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    conn = sqlite3.connect("hospital_equipment_system.db")
    cursor = conn.cursor()
    cursor.execute("SELECT username, password, role FROM personnel WHERE username = ?", (form_data.username,))
    user = cursor.fetchone()
    conn.close()

    if not user or not verify_password(form_data.password, user[1]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    username = user[0]
    role = user[2].lower().replace(" ", "")  # Fix: lowercase and remove spaces

    token = create_access_token({"sub": username, "role": role})

    return {
        "access_token": token,
        "token_type": "bearer",
        "role": role  # Return lowercase role to frontend
    }

