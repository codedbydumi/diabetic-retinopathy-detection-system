from fastapi import FastAPI, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import joblib
import numpy as np
import pandas as pd
import cv2
import shap
import uuid
import os
from tensorflow.keras.models import load_model
import tensorflow.keras.backend as K

# ── Focal loss definition (needed to load the image model) ──
def categorical_focal_loss(gamma=2.0, alpha=0.25):
    def focal_loss(y_true, y_pred):
        y_pred = K.clip(y_pred, K.epsilon(), 1.0 - K.epsilon())
        cross_entropy = -y_true * K.log(y_pred)
        weight = alpha * K.pow(1 - y_pred, gamma)
        loss = weight * cross_entropy
        return K.sum(loss, axis=-1)
    return focal_loss

# ── Load models once at startup (not per-request) ──
print("Loading models...")
clinical_model = joblib.load('../models/clinical_model_xgboost_FINAL.pkl')
clinical_threshold = joblib.load('../models/clinical_threshold_FINAL.pkl')
image_model = load_model(
    '../models/mobilenetv2_final_v4_tta.keras',
    custom_objects={'focal_loss': categorical_focal_loss(gamma=2.0, alpha=0.25)}
)
clinical_explainer = shap.TreeExplainer(clinical_model)
print("Models loaded successfully.")

FEATURE_ORDER = ['age','glucose','bmi','diastolic_bp','gender_encoded',
    'pregnancies','skin_thickness','insulin','pedigree_function',
    'systolic_bp','pulse_rate','family_diabetes','hypertensive',
    'cardiovascular_disease'] + [f'{c}_missing' for c in
    ['pregnancies','skin_thickness','insulin','pedigree_function',
     'systolic_bp','pulse_rate','family_diabetes','hypertensive','cardiovascular_disease']]

DEFAULTS = {'pregnancies': 3.0, 'skin_thickness': 23.0, 'insulin': 30.5,
    'pedigree_function': 0.3725, 'systolic_bp': 120.0, 'pulse_rate': 75.0,
    'family_diabetes': 0.0, 'hypertensive': 0.0, 'cardiovascular_disease': 0.0}

REPORTS_DIR = 'generated_reports'
os.makedirs(REPORTS_DIR, exist_ok=True)

app = FastAPI(title="DR Detection API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your frontend's actual URL before deployment
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "DR Detection API is running"}

@app.get("/health")
def health():
    return {"clinical_model": "loaded", "image_model": "loaded"}