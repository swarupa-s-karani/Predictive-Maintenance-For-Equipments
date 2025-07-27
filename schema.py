import sqlite3

conn = sqlite3.connect("hospital_equipment_system.db")
cursor = conn.cursor()

# Fetch all table names
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]

for table in tables:
    print(f"\nTable: {table}")
    cursor.execute(f"PRAGMA table_info({table})")
    for col in cursor.fetchall():
        col_id, name, dtype, _, _, pk = col
        print(f"   - {name} ({dtype}){' [PK]' if pk else ''}")

conn.close()


