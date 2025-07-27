#frontend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi_app.auth import router as auth_router
from fastapi_app.equipments import router as equipment_router
from fastapi_app.maintenance import router as maintenance_router
from fastapi_app.predict import router as predict_router
from fastapi_app.users import router as user_router
from fastapi_app.calendar import router as calendar_router
from fastapi_app.eda import router as eda_router

app = FastAPI(title="Hospital Equipment Maintenance API")

# Enable CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # React dev
        "http://127.0.0.1:5173",  # Just in case
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register routers
app.include_router(auth_router, tags=["Auth"])
app.include_router(equipment_router, prefix="/equipments", tags=["Equipments"])
app.include_router(maintenance_router, prefix="/maintenance-log", tags=["Maintenance Logs"])
app.include_router(predict_router, prefix="/predict", tags=["Prediction"])
app.include_router(user_router, prefix="/users", tags=["Users"])
app.include_router(calendar_router, prefix="/calendar", tags=["Calendar"])
app.include_router(eda_router)
