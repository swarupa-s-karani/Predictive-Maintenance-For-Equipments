# generate_priority_features.py
import sqlite3
import pandas as pd
from datetime import datetime

conn = sqlite3.connect("hospital_equipment_system.db")

# Equipment Age
equipment_df = pd.read_sql("SELECT equipment_id, installation_date FROM equipment", conn)
equipment_df["installation_date"] = pd.to_datetime(equipment_df["installation_date"])
equipment_df["equipment_age"] = (pd.Timestamp.today() - equipment_df["installation_date"]).dt.days // 365

# Downtime and Failures
maintenance_df = pd.read_sql("SELECT equipment_id, downtime_hours, response_time_hours FROM maintenance_logs", conn)
agg_maintenance = maintenance_df.groupby("equipment_id").agg({
    "downtime_hours": "sum",
    "response_time_hours": "mean"
}).reset_index()
agg_maintenance["num_failures"] = maintenance_df.groupby("equipment_id").size().values

# Failure prediction from model
failure_df = pd.read_sql("SELECT equipment_id, needs_maintenance_10_days FROM failure_predictions", conn)

# Merge all
df = equipment_df.merge(agg_maintenance, on="equipment_id", how="left")
df = df.merge(failure_df, on="equipment_id", how="left")
df = df.fillna({
    "downtime_hours": 0,
    "response_time_hours": 0,
    "num_failures": 0,
    "needs_maintenance_10_days": 0  # Default: not predicted to fail
})

df.to_csv("equipment_priority_features.csv", index=False)
print(" Saved: equipment_priority_features.csv")
