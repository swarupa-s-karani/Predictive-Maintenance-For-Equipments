# generate_equipment_report.py
# generate_equipment_report.py
import matplotlib
matplotlib.use('Agg')  # ✅ Set backend first!

import matplotlib.pyplot as plt
import sqlite3
import pandas as pd
import os
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

DB_PATH = "hospital_equipment_system.db"
CHARTS_DIR = "charts"
os.makedirs(CHARTS_DIR, exist_ok=True)

def fetch_equipment_metrics(equipment_id: str):
    
    conn = sqlite3.connect(DB_PATH)

    # 1. Equipment Age
    eq_df = pd.read_sql("SELECT equipment_id, installation_date FROM equipment WHERE equipment_id = ?", conn, params=(equipment_id,))
    if eq_df.empty:
        raise ValueError(f"No equipment found for ID: {equipment_id}")
    eq_df["installation_date"] = pd.to_datetime(eq_df["installation_date"])
    eq_df["equipment_age"] = (pd.Timestamp.today() - eq_df["installation_date"]).dt.days // 365

    # 2. Maintenance metrics
    maint_df = pd.read_sql(
        "SELECT * FROM maintenance_logs WHERE equipment_id = ? AND status != 'Scheduled'",
        conn, params=(equipment_id,)
    )
    downtime = maint_df["downtime_hours"].sum()
    response_time = maint_df["response_time_hours"].mean() if not maint_df.empty else 0
    num_failures = maint_df.shape[0]

    # 3. Usage logs for plotting trends
    usage_df = pd.read_sql("SELECT * FROM usage_logs WHERE equipment_id = ?", conn, params=(equipment_id,))
    conn.close()

    usage_df["timestamp"] = pd.to_datetime(usage_df["timestamp"])
    if usage_df.empty:
        raise ValueError(f"No usage logs found for {equipment_id}")

    usage_df['date'] = usage_df['timestamp'].dt.date
    daily_usage = usage_df.groupby('date').agg({
        'usage_hours': 'mean',
        'avg_cpu_temp': 'mean',
        'workload_level': 'mean',
        'error_count': 'sum',
        'timestamp': 'first'
    }).reset_index()
    daily_usage['date'] = pd.to_datetime(daily_usage['date'])
    daily_usage = daily_usage.sort_values('date')

    # 4. Classification labels
    pm_path = "labeled_preventive_data.csv"
    cm_path = "labeled_corrective_data.csv"
    rp_path = "labeled_replacement_data.csv"

    pm_label = pd.read_csv(pm_path).set_index("equipment_id").loc[equipment_id, "preventive_label"]
    cm_label = pd.read_csv(cm_path).set_index("equipment_id").loc[equipment_id, "corrective_label"]
    rp_label = pd.read_csv(rp_path).set_index("equipment_id").loc[equipment_id, "replacement_label"]

    # 5. Plot trends and save to charts/trend_graph.png
    chart_path = os.path.join(CHARTS_DIR, "trend_graph.png")
    fig, axs = plt.subplots(4, 1, figsize=(14, 14), sharex=True)

    axs[0].plot(daily_usage['date'], daily_usage['usage_hours'], marker='o', label='Avg Usage Hours', color='teal')
    axs[0].set_ylabel("Usage Hours")
    axs[0].set_title(f"Daily Usage Trend - {equipment_id}", fontweight='bold')
    axs[0].legend(); axs[0].grid(True)

    axs[1].plot(daily_usage['date'], daily_usage['avg_cpu_temp'], marker='x', label='Avg CPU Temp', color='coral')
    axs[1].set_ylabel("CPU Temp (°C)")
    axs[1].legend(); axs[1].grid(True)

    axs[2].plot(daily_usage['date'], daily_usage['workload_level'], marker='s', label='Workload Level', color='purple')
    axs[2].set_ylabel("Workload Level")
    axs[2].legend(); axs[2].grid(True)

    axs[3].plot(daily_usage['date'], daily_usage['error_count'], marker='^', label='Error Count', color='red')
    axs[3].set_ylabel("Error Count"); axs[3].set_xlabel("Date")
    axs[3].legend(); axs[3].grid(True)

    plt.xticks(rotation=45)
    stats = f"""
    Total Days: {len(daily_usage)}
    Avg Usage Hours: {daily_usage['usage_hours'].mean():.1f}
    Avg CPU Temp: {daily_usage['avg_cpu_temp'].mean():.1f}°C
    Avg Workload: {daily_usage['workload_level'].mean():.1f}
    Total Errors: {daily_usage['error_count'].sum()}
    """
    plt.figtext(0.02, 0.02, stats, fontsize=10,
                bbox=dict(boxstyle="round", facecolor="lightyellow", alpha=0.7))

    plt.tight_layout()
    plt.subplots_adjust(bottom=0.15)
    plt.savefig(chart_path, dpi=300, bbox_inches='tight')
    plt.close()  # ✅ Prevent memory/thread issues

    # 6. Return combined metrics for LLM
    return {
        "equipment_id": equipment_id,
        "equipment_age": int(eq_df["equipment_age"].iloc[0]),
        "downtime_hours": float(downtime),
        "num_failures": int(num_failures),
        "response_time_hours": float(round(response_time, 2)),
        "predicted_to_fail": cm_label == "High" or rp_label == "High",
        "maintenance_needs": {
            "preventive": pm_label,
            "corrective": cm_label,
            "replacement": rp_label,
        },
        "usage_hours": round(daily_usage["usage_hours"].mean(), 1),
        "avg_cpu_temp": round(daily_usage["avg_cpu_temp"].mean()),
        "error_count": int(daily_usage["error_count"].sum()),
        "risk_score": int(min(100, (
            0.4 * daily_usage["error_count"].sum() +
            0.3 * daily_usage["avg_cpu_temp"].mean() +
            0.3 * daily_usage["usage_hours"].mean()
        ))),
        "chart_path": chart_path
    }
