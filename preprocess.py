import sqlite3
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

# Connect to the DB
conn = sqlite3.connect("hospital_equipment_system.db")

# Load data
usage_df = pd.read_sql_query("SELECT * FROM usage_logs", conn)
pred_df = pd.read_sql_query("SELECT * FROM failure_predictions", conn)
equip_df = pd.read_sql_query("SELECT * FROM equipment", conn)

# Convert timestamp and dates
usage_df["timestamp"] = pd.to_datetime(usage_df["timestamp"])
pred_df["prediction_date"] = pd.to_datetime(pred_df["prediction_date"])
equip_df["installation_date"] = pd.to_datetime(equip_df["installation_date"])

# Sort usage logs
usage_df = usage_df.sort_values(["equipment_id", "timestamp"])

# Merge usage with predictions for target label
# We assume prediction was made based on past 5-day logs — so we align on dates
merged_df = pd.merge_asof(
    usage_df.sort_values("timestamp"),
    pred_df.sort_values("prediction_date"),
    by="equipment_id",
    left_on="timestamp",
    right_on="prediction_date",
    direction="forward",
    tolerance=pd.Timedelta("10D")  # only if prediction happens within next 10 days
)

# Drop rows without labels (NaN)
merged_df = merged_df.dropna(subset=["needs_maintenance_10_days"])

# View info
print(merged_df.head())
print(merged_df.info())

# Check missing values
print("\nMissing values:")
print(merged_df.isnull().sum())

# EDA: Plot correlations
plt.figure(figsize=(10, 6))
sns.heatmap(merged_df.select_dtypes(include="number").corr(), annot=True, cmap="coolwarm")
plt.title("Feature Correlation Heatmap")
plt.tight_layout()
plt.show()

# Plot class distribution
sns.countplot(x="needs_maintenance_10_days", data=merged_df)
plt.title("Target Distribution (Maintenance Needed in 10 Days)")
plt.show()

# Distribution of numeric features
numeric_cols = ["usage_hours", "patients_served", "workload_level", "avg_cpu_temp", "error_count"]
for col in numeric_cols:
    plt.figure(figsize=(6, 4))
    sns.histplot(data=merged_df, x=col, kde=True)
    plt.title(f"Distribution of {col}")
    plt.tight_layout()
    plt.show()

# Close DB connection
conn.close()

merged_df.to_csv("processed_equipment_data.csv", index=False)