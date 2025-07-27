#import sqlite3

#conn = sqlite3.connect("hospital_equipment_system.db")
#cursor = conn.cursor()
#cursor.execute("SELECT username, password, role FROM personnel")
#rows = cursor.fetchall()
#for row in rows:
#    print("Username:", row[0], "| Password:", row[1], "| Role:", row[2])
#conn.close()


# fastapi_app/ hash_password.py
from passlib.context import CryptContext
import sqlite3

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

conn = sqlite3.connect("hospital_equipment_system.db")
cursor = conn.cursor()
cursor.execute("SELECT username, password FROM personnel")
rows = cursor.fetchall()

for username, password in rows:
    hashed = pwd_context.hash(password)
    cursor.execute("UPDATE personnel SET password = ? WHERE username = ?", (hashed, username))

conn.commit()
conn.close()
print("All passwords hashed with bcrypt.")
