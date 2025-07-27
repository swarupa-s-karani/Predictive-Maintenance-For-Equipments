# train_priority_models.py
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report
import joblib

# Updated feature list includes prediction
features = [
    "equipment_age",
    "downtime_hours",
    "num_failures",
    "response_time_hours",
    "needs_maintenance_10_days"
]

scaler = StandardScaler()

for mtype in ["preventive", "corrective", "replacement"]:
    df = pd.read_csv(f"labeled_{mtype}_data.csv")
    X = df[features]
    y = df[f"{mtype}_label"].map({"Low": 0, "Medium": 1, "High": 2})

    if y.nunique() < 2:
        print(f"Skipping {mtype} model training: only 1 class present ({y.unique()[0]})")
        continue

    X_scaled = scaler.fit_transform(X)
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, stratify=y, test_size=0.2, random_state=42)

    model = SVC(kernel="rbf", probability=True)
    model.fit(X_train, y_train)

    print(f"\n{mtype.upper()} MODEL:")
    print(classification_report(y_test, model.predict(X_test)))

    joblib.dump(model, f"saved_models/{mtype}_model.pkl")

# Save scaler
joblib.dump(scaler, "saved_models/multi_priority_scaler.pkl")
print("Training complete.")
