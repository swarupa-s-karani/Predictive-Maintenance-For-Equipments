# generate_equipment_report.py
import matplotlib
matplotlib.use('Agg')  # ✅ Set backend first!

import matplotlib.pyplot as plt
import sqlite3
import pandas as pd
import numpy as np
import os
from datetime import datetime
import warnings
import math
warnings.filterwarnings('ignore')

DB_PATH = "hospital_equipment_system.db"
CHARTS_DIR = "charts"
os.makedirs(CHARTS_DIR, exist_ok=True)

def safe_float(value, default=0.0):
    """Safely convert value to float, handling NaN and inf values"""
    try:
        if pd.isna(value) or math.isinf(float(value)):
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def safe_int(value, default=0):
    """Safely convert value to int, handling NaN and inf values"""
    try:
        if pd.isna(value) or math.isinf(float(value)):
            return default
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_mean(series, default=0.0):
    """Safely calculate mean, handling empty series and NaN values"""
    if series.empty or series.isna().all():
        return default
    mean_val = series.mean()
    return safe_float(mean_val, default)

def safe_sum(series, default=0.0):
    """Safely calculate sum, handling empty series and NaN values"""
    if series.empty:
        return default
    sum_val = series.sum()
    return safe_float(sum_val, default)

def fetch_equipment_metrics(equipment_id: str):
    
    conn = sqlite3.connect(DB_PATH)

    # 1. Equipment Age
    eq_df = pd.read_sql("SELECT equipment_id, installation_date FROM equipment WHERE equipment_id = ?", conn, params=(equipment_id,))
    if eq_df.empty:
        raise ValueError(f"No equipment found for ID: {equipment_id}")
    eq_df["installation_date"] = pd.to_datetime(eq_df["installation_date"])
    eq_df["equipment_age"] = (pd.Timestamp.today() - eq_df["installation_date"]).dt.days // 365

    # 2. Maintenance metrics with safe handling
    maint_df = pd.read_sql(
        "SELECT * FROM maintenance_logs WHERE equipment_id = ? AND status != 'Scheduled'",
        conn, params=(equipment_id,)
    )
    
    # Safely calculate maintenance metrics
    downtime = safe_sum(maint_df["downtime_hours"]) if not maint_df.empty else 0.0
    response_time = safe_mean(maint_df["response_time_hours"]) if not maint_df.empty else 0.0
    num_failures = len(maint_df) if not maint_df.empty else 0

    # 3. Usage logs for plotting trends
    usage_df = pd.read_sql("SELECT * FROM usage_logs WHERE equipment_id = ?", conn, params=(equipment_id,))
    conn.close()

    usage_df["timestamp"] = pd.to_datetime(usage_df["timestamp"])
    if usage_df.empty:
        raise ValueError(f"No usage logs found for {equipment_id}")

    # Clean usage data
    usage_df = usage_df.fillna(0)  # Replace NaN with 0
    usage_df = usage_df.replace([np.inf, -np.inf], 0)  # Replace inf with 0

    usage_df['date'] = usage_df['timestamp'].dt.date
    daily_usage = usage_df.groupby('date').agg({
        'usage_hours': 'mean',
        'avg_cpu_temp': 'mean',
        'workload_level': 'mean',
        'error_count': 'sum',
        'timestamp': 'first'
    }).reset_index()
    
    # Clean aggregated data
    daily_usage = daily_usage.fillna(0)
    daily_usage = daily_usage.replace([np.inf, -np.inf], 0)
    
    daily_usage['date'] = pd.to_datetime(daily_usage['date'])
    daily_usage = daily_usage.sort_values('date')

    # 4. Classification labels with safe handling
    pm_path = "labeled_preventive_data.csv"
    cm_path = "labeled_corrective_data.csv"
    rp_path = "labeled_replacement_data.csv"

    try:
        pm_label = pd.read_csv(pm_path).set_index("equipment_id").loc[equipment_id, "preventive_label"]
    except (FileNotFoundError, KeyError):
        pm_label = "Medium"  # Default fallback
        
    try:
        cm_label = pd.read_csv(cm_path).set_index("equipment_id").loc[equipment_id, "corrective_label"]
    except (FileNotFoundError, KeyError):
        cm_label = "Medium"  # Default fallback
        
    try:
        rp_label = pd.read_csv(rp_path).set_index("equipment_id").loc[equipment_id, "replacement_label"]
    except (FileNotFoundError, KeyError):
        rp_label = "Low"  # Default fallback

    # 5. Plot trends and save to charts/trend_graph.png
    chart_path = os.path.join(CHARTS_DIR, "trend_graph.png")
    
    try:
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
        
        # Safe calculations for stats
        avg_usage = safe_mean(daily_usage['usage_hours'])
        avg_temp = safe_mean(daily_usage['avg_cpu_temp'])
        avg_workload = safe_mean(daily_usage['workload_level'])
        total_errors = safe_sum(daily_usage['error_count'])
        
        stats = f"""
        Total Days: {len(daily_usage)}
        Avg Usage Hours: {avg_usage:.1f}
        Avg CPU Temp: {avg_temp:.1f}°C
        Avg Workload: {avg_workload:.1f}
        Total Errors: {int(total_errors)}
        """
        plt.figtext(0.02, 0.02, stats, fontsize=10,
                    bbox=dict(boxstyle="round", facecolor="lightyellow", alpha=0.7))

        plt.tight_layout()
        plt.subplots_adjust(bottom=0.15)
        plt.savefig(chart_path, dpi=300, bbox_inches='tight')
        plt.close()  # ✅ Prevent memory/thread issues
    except Exception as e:
        print(f"Error creating chart: {e}")
        # Create a simple fallback chart or skip chart creation
        plt.figure(figsize=(8, 6))
        plt.text(0.5, 0.5, f"Chart unavailable for {equipment_id}", 
                ha='center', va='center', fontsize=14)
        plt.savefig(chart_path, dpi=300, bbox_inches='tight')
        plt.close()

    # 6. Return combined metrics for LLM with safe calculations
    avg_usage_hours = safe_mean(daily_usage["usage_hours"])
    avg_cpu_temp = safe_mean(daily_usage["avg_cpu_temp"])
    total_error_count = safe_sum(daily_usage["error_count"])
    
    # Safe risk score calculation
    risk_score = min(100, max(0, (
        0.4 * total_error_count +
        0.3 * avg_cpu_temp +
        0.3 * avg_usage_hours
    )))
    risk_score = safe_int(risk_score)

    return {
        "equipment_id": equipment_id,
        "equipment_age": safe_int(eq_df["equipment_age"].iloc[0]),
        "downtime_hours": safe_float(downtime),
        "num_failures": safe_int(num_failures),
        "response_time_hours": safe_float(response_time, 0.0),
        "predicted_to_fail": cm_label == "High" or rp_label == "High",
        "maintenance_needs": {
            "preventive": str(pm_label),
            "corrective": str(cm_label),
            "replacement": str(rp_label),
        },
        "usage_hours": safe_float(avg_usage_hours),
        "avg_cpu_temp": safe_float(avg_cpu_temp),
        "error_count": safe_int(total_error_count),
        "risk_score": risk_score,
        "chart_path": chart_path
    }