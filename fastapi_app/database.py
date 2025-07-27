#database.py
import sqlite3
import os

def get_db():
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    db_path = os.path.join(BASE_DIR, "..", "hospital_equipment_system.db")
    return sqlite3.connect(db_path)
