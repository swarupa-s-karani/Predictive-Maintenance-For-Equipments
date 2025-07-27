# ml_model2.py
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score, roc_curve
from lightgbm import LGBMClassifier
import matplotlib.pyplot as plt
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Input
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import StandardScaler

# Data loading
df = pd.read_csv("processed_equipment_data.csv")
df["timestamp"] = pd.to_datetime(df["timestamp"])
features = ["usage_hours", "patients_served", "workload_level", "avg_cpu_temp", "error_count"]
target = "needs_maintenance_10_days"
df[features] = df[features].fillna(0)

# Standard scaling
scaler = StandardScaler()
df[features] = scaler.fit_transform(df[features])

# Rolling window for LSTM
sequences, labels = [], []
grouped = df.groupby("equipment_id")
for _, group in grouped:
    group = group.sort_values("timestamp")
    if len(group) >= 6:
        for i in range(len(group) - 5):
            sequences.append(group.iloc[i:i+5][features].values)
            labels.append(group.iloc[i+5][target])

X_seq = np.array(sequences)
y_seq = np.array(labels)

# Train/test split for LSTM
X_train_seq, X_test_seq, y_train_seq, y_test_seq = train_test_split(
    X_seq, y_seq, test_size=0.2, random_state=42, stratify=y_seq)

# Flatten for traditional models
X_flat = X_seq.reshape(X_seq.shape[0], -1)
X_train_flat, X_test_flat, y_train, y_test = train_test_split(
    X_flat, y_seq, test_size=0.2, random_state=42, stratify=y_seq)

# --- LSTM Model ---
lstm_model = Sequential([
    Input(shape=(5, len(features))),
    LSTM(64),
    Dense(1, activation='sigmoid')
])
lstm_model.compile(loss='binary_crossentropy', optimizer='adam', metrics=['accuracy'])
early_stop = EarlyStopping(monitor='val_loss', patience=5, restore_best_weights=True)

lstm_model.fit(
    X_train_seq, y_train_seq,
    validation_split=0.2,
    epochs=50,
    batch_size=32,
    callbacks=[early_stop],
    verbose=0
)

y_pred_lstm_prob = lstm_model.predict(X_test_seq).flatten()
y_pred_lstm = (y_pred_lstm_prob > 0.5).astype(int)

print("\nLSTM Model:")
print(classification_report(y_test_seq, y_pred_lstm))
print("Confusion Matrix:\n", confusion_matrix(y_test_seq, y_pred_lstm))
print("ROC-AUC:", roc_auc_score(y_test_seq, y_pred_lstm_prob))
fpr, tpr, _ = roc_curve(y_test_seq, y_pred_lstm_prob)
plt.plot(fpr, tpr, label="LSTM")

# --- LightGBM Model ---
lgbm = LGBMClassifier()
lgbm.fit(X_train_flat, y_train)
y_pred_lgbm_prob = lgbm.predict_proba(X_test_flat)[:, 1]
y_pred_lgbm = (y_pred_lgbm_prob > 0.5).astype(int)

print("\nLightGBM Model:")
print(classification_report(y_test, y_pred_lgbm))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred_lgbm))
print("ROC-AUC:", roc_auc_score(y_test, y_pred_lgbm_prob))
fpr, tpr, _ = roc_curve(y_test, y_pred_lgbm_prob)
plt.plot(fpr, tpr, label="LightGBM")

# --- Ensemble: LSTM + LightGBM ---
y_pred_ensemble_prob = (y_pred_lstm_prob + y_pred_lgbm_prob) / 2
y_pred_ensemble = (y_pred_ensemble_prob > 0.40).astype(int)

print("\nEnsemble Model (LSTM + LightGBM):")
print(classification_report(y_test, y_pred_ensemble))
print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred_ensemble))
print("ROC-AUC:", roc_auc_score(y_test, y_pred_ensemble_prob))
fpr, tpr, _ = roc_curve(y_test, y_pred_ensemble_prob)
plt.plot(fpr, tpr, label="Ensemble")

# Save LSTM
lstm_model.save("lstm_model.h5")

# Save LightGBM
import joblib
joblib.dump(lgbm, "lgbm_model.pkl")

# Save Scaler
joblib.dump(scaler, "scaler.pkl")

# --- Final ROC Plot ---
plt.title("ROC-AUC Curves")
plt.xlabel("False Positive Rate")
plt.ylabel("True Positive Rate")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.show()

# --- CUSTOM INPUT TESTING SECTION ---

# Custom Input Set 1: Risky
input1 = pd.DataFrame([
    [5.5, 18, 0.60, 56.50, 1],
    [6.3, 20, 0.70, 58.30, 2],
    [7.1, 22, 0.80, 60.10, 3],
    [8.0, 24, 0.90, 62.00, 4],
    [9.0, 26, 1.00, 64.00, 5]
], columns=features)

# Custom Input Set 2: Safe
input2 = pd.DataFrame([
    [4.87, 18, 0.49, 55.21, 0],
    [3.10, 12, 0.31, 45.84, 0],
    [3.08, 8, 0.31, 48.86, 0],
    [5.90, 17, 0.59, 47.91, 0],
    [8.84, 15, 0.88, 64.87, 1]
], columns=features)

def predict_custom_input(input_df, label):
    # Scale using training scaler
    input_scaled = scaler.transform(input_df)

    # LSTM: shape (1, 5, 5)
    input_lstm = input_scaled.reshape(1, 5, len(features))
    pred_lstm_prob = lstm_model.predict(input_lstm).flatten()[0]

    # LightGBM: shape (1, 25)
    input_flat = input_scaled.reshape(1, -1)
    pred_lgbm_prob = lgbm.predict_proba(input_flat)[:, 1][0]

    # Ensemble
    ensemble_prob = (pred_lstm_prob + pred_lgbm_prob) / 2
    ensemble_pred = int(ensemble_prob > 0.40)

    print(f"\n {label} Prediction")
    print(f"LSTM prob:     {pred_lstm_prob:.4f}")
    print(f"LightGBM prob: {pred_lgbm_prob:.4f}")
    print(f"Ensemble prob: {ensemble_prob:.4f}")
    print(f"Final Prediction: {ensemble_pred} (1 = Needs Maintenance, 0 = No)")

# Run on custom inputs
predict_custom_input(input1, "Input Set 1 (Risky)")
predict_custom_input(input2, "Input Set 2 (Safe)")
