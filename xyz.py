import pandas as pd

# Generate equipment IDs
equipment_ids = [f"EQP{str(i).zfill(3)}" for i in range(1, 51)]

# Files to update
files = {
    "labeled_preventive_data.csv": "preventive_label",
    "labeled_corrective_data.csv": "corrective_label",
    "labeled_replacement_data.csv": "replacement_label"
}

for file, label_col in files.items():
    df = pd.read_csv(file)
    
    if len(df) != 50:
        print(f"Warning: {file} does not contain exactly 50 rows. Skipping.")
        continue

    df.insert(0, "equipment_id", equipment_ids)
    df.to_csv(file, index=False)
    print(f"Updated: {file}")



from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Replace with values from your DB
hashed_pw = "$2b$12$DI9uePmgaXCTMT60BLdI5eWZ.m0sADxLNYMFIccB6Aestcjh/Ifzq"
plain_pw = "pass1"

print("Match:", pwd_context.verify(plain_pw, hashed_pw))



