# fastapi_app/eda.py
import base64
from fastapi import APIRouter, Response
from generate_eda_image import generate_eda_image
import os

router = APIRouter()

@router.get("/eda/overall-eda-image")
async def get_eda_image():
    path = generate_eda_image()
    if os.path.exists(path):
        with open(path, "rb") as img_file:
            encoded_string = base64.b64encode(img_file.read()).decode("utf-8")
            return {"image_base64": encoded_string}
    return Response(content="EDA image not found", status_code=404)
