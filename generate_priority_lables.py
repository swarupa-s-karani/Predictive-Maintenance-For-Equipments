# generate_priority_labels.py
import pandas as pd

df = pd.read_csv("equipment_priority_features.csv")

# Use predictive + historical features
features = [
    "equipment_age",
    "downtime_hours",
    "num_failures",
    "response_time_hours",
    "needs_maintenance_10_days"
]

def assign_label_by_quantile(series):
    q1 = series.quantile(0.33)
    q2 = series.quantile(0.66)
    def label(value):
        if value <= q1: return "Low"
        elif value <= q2: return "Medium"
        else: return "High"
    return series.apply(label)

# Assign based on combined indicators
df["preventive_label"] = assign_label_by_quantile(df["equipment_age"])
df["corrective_label"] = assign_label_by_quantile(df["num_failures"] + df["downtime_hours"] + 50 * df["needs_maintenance_10_days"])
df["replacement_label"] = assign_label_by_quantile(df["equipment_age"] + df["num_failures"] + 30 * df["needs_maintenance_10_days"])

# Save labeled datasets
df[features + ["preventive_label"]].to_csv("labeled_preventive_data.csv", index=False)
df[features + ["corrective_label"]].to_csv("labeled_corrective_data.csv", index=False)
df[features + ["replacement_label"]].to_csv("labeled_replacement_data.csv", index=False)

print("Saved quantile-based label files for all 3 types.")

# Show counts
for mtype in ["preventive", "corrective", "replacement"]:
    print(f"{mtype.capitalize()}:", df[f"{mtype}_label"].value_counts().to_dict())
