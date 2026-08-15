from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import joblib
import numpy as np
import pandas as pd
import cv2
import shap
import xgboost as xgb
import uuid
import os
from tensorflow.keras.models import load_model
import tensorflow.keras.backend as K
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

# ══════════════════════════════════════════════════════════════════
# FOCAL LOSS — required to deserialise the image model
# ══════════════════════════════════════════════════════════════════
def categorical_focal_loss(gamma=2.0, alpha=0.25):
    def focal_loss(y_true, y_pred):
        y_pred = K.clip(y_pred, K.epsilon(), 1.0 - K.epsilon())
        cross_entropy = -y_true * K.log(y_pred)
        weight = alpha * K.pow(1 - y_pred, gamma)
        loss = weight * cross_entropy
        return K.sum(loss, axis=-1)
    return focal_loss

# ══════════════════════════════════════════════════════════════════
# LOAD MODELS ONCE AT STARTUP
# ══════════════════════════════════════════════════════════════════
print("Loading models...")

clinical_model = xgb.XGBClassifier()
clinical_model.load_model('../models/clinical_model_xgboost_FINAL.json')

clinical_threshold = joblib.load('../models/clinical_threshold_FINAL.pkl')

image_model = load_model(
    '../models/mobilenetv2_final_v4_tta.keras',
    custom_objects={'focal_loss': categorical_focal_loss(gamma=2.0, alpha=0.25)}
)

clinical_explainer = shap.TreeExplainer(clinical_model)

print("Models loaded successfully.")

# ══════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════
FEATURE_ORDER = [
    'age', 'glucose', 'bmi', 'diastolic_bp', 'gender_encoded',
    'pregnancies', 'skin_thickness', 'insulin', 'pedigree_function',
    'systolic_bp', 'pulse_rate', 'family_diabetes', 'hypertensive',
    'cardiovascular_disease'
] + [f'{c}_missing' for c in [
    'pregnancies', 'skin_thickness', 'insulin', 'pedigree_function',
    'systolic_bp', 'pulse_rate', 'family_diabetes', 'hypertensive', 'cardiovascular_disease'
]]

DEFAULTS = {
    'pregnancies': 3.0, 'skin_thickness': 23.0, 'insulin': 30.5,
    'pedigree_function': 0.3725, 'systolic_bp': 120.0, 'pulse_rate': 75.0,
    'family_diabetes': 0.0, 'hypertensive': 0.0, 'cardiovascular_disease': 0.0
}

STAGE_LABELS = {0: 'No DR', 1: 'Mild NPDR', 2: 'Moderate NPDR', 3: 'Severe NPDR', 4: 'Proliferative DR'}

REPORTS_DIR = 'generated_reports'
os.makedirs(REPORTS_DIR, exist_ok=True)

# ══════════════════════════════════════════════════════════════════
# APP SETUP
# ══════════════════════════════════════════════════════════════════
app = FastAPI(title="DR Detection API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to your real frontend URL before deployment
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
# REQUEST SCHEMA
# ══════════════════════════════════════════════════════════════════
class ClinicalInput(BaseModel):
    age: float
    glucose: float
    bmi: float
    diastolic_bp: float
    gender: str = "Female"
    pregnancies: Optional[float] = None
    skin_thickness: Optional[float] = None
    insulin: Optional[float] = None
    pedigree_function: Optional[float] = None
    systolic_bp: Optional[float] = None
    pulse_rate: Optional[float] = None
    family_diabetes: Optional[float] = None
    hypertensive: Optional[float] = None
    cardiovascular_disease: Optional[float] = None


# ══════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ══════════════════════════════════════════════════════════════════
def build_clinical_row(data: dict) -> pd.DataFrame:
    row = {
        'age': data['age'],
        'glucose': data['glucose'],
        'bmi': data['bmi'],
        'diastolic_bp': data['diastolic_bp'],
        'gender_encoded': 1 if data.get('gender', 'Female') == 'Male' else 0,
    }
    for field, default in DEFAULTS.items():
        val = data.get(field)
        provided = val is not None
        row[field] = val if provided else default
        row[f'{field}_missing'] = 0 if provided else 1
    return pd.DataFrame([row])[FEATURE_ORDER]


def run_clinical_prediction(clinical_dict: dict) -> dict:
    X_input = build_clinical_row(clinical_dict)
    proba = float(clinical_model.predict_proba(X_input)[0, 1])
    shap_values = clinical_explainer.shap_values(X_input)
    return {
        "risk_score": round(proba * 100, 1),
        "risk_prediction": "High Risk" if proba >= clinical_threshold else "Low Risk",
        "shap_values": shap_values[0].tolist(),
        "feature_names": FEATURE_ORDER,
        "input_values": X_input.iloc[0].tolist()
    }


def preprocess_retinal_image(img, target_size=224):
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        largest = max(contours, key=cv2.contourArea)
        x, y, w, h = cv2.boundingRect(largest)
        img = img[y:y + h, x:x + w]
    img = cv2.resize(img, (target_size, target_size))
    lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l_clahe = clahe.apply(l)
    lab_clahe = cv2.merge((l_clahe, a, b))
    return cv2.cvtColor(lab_clahe, cv2.COLOR_LAB2RGB)


def run_image_prediction(image_bytes: bytes) -> dict:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

    processed = preprocess_retinal_image(img_rgb)
    model_input = preprocess_input(processed.astype(np.float32))
    batch = np.expand_dims(model_input, axis=0)

    # Test-time augmentation — matches the final Model 2 approach from Chapter 3
    preds = [image_model.predict(batch, verbose=0)]

    flipped = tf.image.flip_left_right(batch).numpy()
    preds.append(image_model.predict(flipped, verbose=0))

    for angle in [-10, 10]:
        rotated = np.array([
            tf.keras.preprocessing.image.random_rotation(im, angle, row_axis=0, col_axis=1, channel_axis=2)
            for im in batch
        ])
        preds.append(image_model.predict(rotated, verbose=0))

    brightened = tf.image.adjust_brightness(batch, 0.1).numpy()
    preds.append(image_model.predict(brightened, verbose=0))

    avg_pred = np.mean(preds, axis=0)[0]
    predicted_stage = int(np.argmax(avg_pred))
    confidence = float(avg_pred[predicted_stage])

    return {
        "predicted_stage": predicted_stage,
        "stage_label": STAGE_LABELS[predicted_stage],
        "confidence": round(confidence * 100, 1),
        "all_probabilities": {STAGE_LABELS[i]: round(float(p) * 100, 1) for i, p in enumerate(avg_pred)},
        "_processed_image": processed  # internal use only — stripped before JSON response
    }


def strip_internal(result: dict) -> dict:
    """Remove keys prefixed with _ before sending a JSON response."""
    return {k: v for k, v in result.items() if not k.startswith('_')}


# ══════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════
@app.get("/")
def root():
    return {"status": "DR Detection API is running"}


@app.get("/health")
def health():
    return {"clinical_model": "loaded", "image_model": "loaded"}


@app.post("/predict/clinical")
def predict_clinical_endpoint(data: ClinicalInput):
    result = run_clinical_prediction(data.dict())
    return {"mode": "Mode 1 — Clinical Only", "clinical": result}


@app.post("/predict/image")
async def predict_image_endpoint(file: UploadFile = File(...)):
    image_bytes = await file.read()
    result = run_image_prediction(image_bytes)
    return {"mode": "Mode 2 — Image Only", "image": strip_internal(result)}


@app.post("/predict/fusion")
async def predict_fusion_endpoint(
    file: UploadFile = File(...),
    age: float = Form(...),
    glucose: float = Form(...),
    bmi: float = Form(...),
    diastolic_bp: float = Form(...),
    gender: str = Form("Female")
):
    clinical_dict = {
        "age": age, "glucose": glucose, "bmi": bmi,
        "diastolic_bp": diastolic_bp, "gender": gender
    }
    clinical_result = run_clinical_prediction(clinical_dict)

    image_bytes = await file.read()
    image_result = run_image_prediction(image_bytes)

    severity_labels = ['No DR', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'Proliferative DR']
    image_severity = sum(
        (i / 4.0) * (image_result["all_probabilities"][label] / 100)
        for i, label in enumerate(severity_labels)
    )

    fused_score = round(
        (0.6 * (clinical_result["risk_score"] / 100) + 0.4 * image_severity) * 100, 1
    )

    return {
        "mode": "Mode 3 — Fusion",
        "clinical": clinical_result,
        "image": strip_internal(image_result),
        "fused_risk_score": fused_score
    }