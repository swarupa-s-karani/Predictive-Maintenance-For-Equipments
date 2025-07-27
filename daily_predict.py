import numpy as np
import pandas as pd
import joblib
import sqlite3
from tensorflow.keras.models import load_model
from sklearn.preprocessing import StandardScaler

# --- Load saved models and scaler ---
lstm_model = load_model('saved_models/lstm_model.h5')
lgbm_model = joblib.load('saved_models/lgbm_model.pkl')
scaler = joblib.load('saved_models/scaler.pkl')

# --- Connect to database and fetch latest usage logs ---
conn = sqlite3.connect("hospital_equipment_system.db")  # Replace with actual DB path
query = """
SELECT equipment_id, timestamp, usage_hours, patients_served, workload_level, avg_cpu_temp, error_count
FROM usage_logs
ORDER BY equipment_id, timestamp DESC
"""
df = pd.read_sql_query(query, conn)
conn.close()

# --- Preprocess ---
features = ["usage_hours", "patients_served", "workload_level", "avg_cpu_temp", "error_count"]
df["timestamp"] = pd.to_datetime(df["timestamp"])
df = df.sort_values(["equipment_id", "timestamp"], ascending=[True, False])

equipment_ids = df["equipment_id"].unique()
sequences = []
equipment_map = []

for eq_id in equipment_ids:
    eq_data = df[df["equipment_id"] == eq_id]
    if len(eq_data) >= 5:
        recent_logs = eq_data.head(5).sort_values("timestamp")  # oldest to newest
        X_scaled = scaler.transform(recent_logs[features])
        sequences.append(X_scaled)
        equipment_map.append(eq_id)

if not sequences:
    print("Not enough data for any equipment.")
    exit()

X_seq = np.array(sequences)
X_flat = X_seq.reshape(X_seq.shape[0], -1)

# --- Predict ---
lstm_probs = lstm_model.predict(X_seq).flatten()
lgbm_probs = lgbm_model.predict_proba(X_flat)[:, 1]
ensemble_probs = (lstm_probs + lgbm_probs) / 2
ensemble_preds = (ensemble_probs > 0.4).astype(int)

# --- Output result ---
result_df = pd.DataFrame({
    "equipment_id": equipment_map,
    "maintenance_needed": ensemble_preds,
    "confidence_score": ensemble_probs
})

print(result_df)
