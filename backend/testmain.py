from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Optional
import joblib
import numpy as np
import pandas as pd
import cv2
import shap
import xgboost as xgb
import uuid
import os
import base64
import matplotlib
matplotlib.use('Agg')  # headless backend — no display needed on a server
import matplotlib.pyplot as plt
from tensorflow.keras.models import load_model, Model as KerasModel
import tensorflow.keras.backend as K
import tensorflow as tf
from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
                                  Table, TableStyle, Image as RLImage, PageBreak)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.graphics.shapes import Drawing, String, Circle, Line, Wedge
from datetime import datetime
import math
import random

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

# Find the last conv layer name once at startup (used by Grad-CAM every request)
LAST_CONV_LAYER = None
for layer in image_model.layers:
    if 'conv' in layer.name.lower() and 'bn' in layer.name.lower():
        LAST_CONV_LAYER = layer.name
if LAST_CONV_LAYER is None:
    for layer in reversed(image_model.layers):
        if 'conv' in layer.name.lower():
            LAST_CONV_LAYER = layer.name
            break
print(f"Grad-CAM target layer: {LAST_CONV_LAYER}")

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
IMAGES_DIR = 'generated_images'
os.makedirs(REPORTS_DIR, exist_ok=True)
os.makedirs(IMAGES_DIR, exist_ok=True)

# In-memory store mapping report_id -> data needed to rebuild/serve the report.
# NOTE: this resets if the server restarts. For production use, replace with a
# database or persistent cache — acceptable for this project's current scope
# (Chapter 4, Section 4.7 — stateless design).
REPORT_CACHE = {}

# Image upload validation constants
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/jpg"}
MAX_IMAGE_SIZE_MB = 15

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
# REQUEST SCHEMA — bounds verified against clinical reference ranges
# AND cross-checked against the training dataset (34/6056 = 0.6% of
# training rows fell outside these bounds due to data entry errors
# in the DiaBD source; documented in Chapter 3/Discussion as a
# separate finding from the glucose unit correction).
# ══════════════════════════════════════════════════════════════════
class ClinicalInput(BaseModel):
    age: float = Field(..., ge=1, le=120, description="Age in years")
    glucose: float = Field(..., ge=40, le=600, description="Blood glucose in mg/dL")
    bmi: float = Field(..., ge=10, le=70, description="Body Mass Index in kg/m²")
    diastolic_bp: float = Field(..., ge=30, le=160, description="Diastolic blood pressure in mmHg")
    gender: str = Field("Female", pattern="^(Male|Female)$")
    pregnancies: Optional[float] = Field(None, ge=0, le=20)
    skin_thickness: Optional[float] = Field(None, ge=0, le=100)
    insulin: Optional[float] = Field(None, ge=0, le=900)
    pedigree_function: Optional[float] = Field(None, ge=0, le=3)
    systolic_bp: Optional[float] = Field(None, ge=50, le=250)
    pulse_rate: Optional[float] = Field(None, ge=30, le=220)
    family_diabetes: Optional[float] = Field(None, ge=0, le=1)
    hypertensive: Optional[float] = Field(None, ge=0, le=1)
    cardiovascular_disease: Optional[float] = Field(None, ge=0, le=1)


# ══════════════════════════════════════════════════════════════════
# IMAGE UPLOAD VALIDATION
# ══════════════════════════════════════════════════════════════════
async def validate_image_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Must be PNG or JPEG."
        )

    image_bytes = await file.read()
    size_mb = len(image_bytes) / (1024 * 1024)
    if size_mb > MAX_IMAGE_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large ({size_mb:.1f}MB). Maximum {MAX_IMAGE_SIZE_MB}MB."
        )

    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return image_bytes


# ══════════════════════════════════════════════════════════════════
# CLINICAL HELPERS
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
        "input_values": X_input.iloc[0].tolist(),
        "_shap_explanation": shap_values[0],
        "_X_input": X_input
    }


# ══════════════════════════════════════════════════════════════════
# IMAGE + GRAD-CAM HELPERS
# ══════════════════════════════════════════════════════════════════
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


def make_gradcam_heatmap(img_array, pred_index=None):
    grad_model = KerasModel(
        image_model.inputs, [image_model.get_layer(LAST_CONV_LAYER).output, image_model.output]
    )
    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    grads = tape.gradient(class_channel, last_conv_layer_output)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    last_conv_layer_output = last_conv_layer_output[0]
    heatmap = last_conv_layer_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
    return heatmap.numpy(), int(pred_index)


def overlay_gradcam(img_original, heatmap, alpha=0.4):
    heatmap_resized = cv2.resize(heatmap, (img_original.shape[1], img_original.shape[0]))
    heatmap_resized = np.uint8(255 * heatmap_resized)
    jet = matplotlib.colormaps.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[heatmap_resized]
    jet_heatmap = np.uint8(jet_heatmap * 255)
    superimposed = jet_heatmap * alpha + img_original * (1 - alpha)
    return np.uint8(superimposed)


def run_image_prediction(image_bytes: bytes, generate_heatmap: bool = True) -> dict:
    nparr = np.frombuffer(image_bytes, np.uint8)
    img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image. File may be corrupted or not a valid image.")

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

    result = {
        "predicted_stage": predicted_stage,
        "stage_label": STAGE_LABELS[predicted_stage],
        "confidence": round(confidence * 100, 1),
        "all_probabilities": {STAGE_LABELS[i]: round(float(p) * 100, 1) for i, p in enumerate(avg_pred)},
    }

    if generate_heatmap:
        heatmap, _ = make_gradcam_heatmap(batch, pred_index=predicted_stage)
        overlayed = overlay_gradcam(processed, heatmap)
        gradcam_filename = f"gradcam_{uuid.uuid4().hex[:10]}.png"
        gradcam_path = os.path.join(IMAGES_DIR, gradcam_filename)
        cv2.imwrite(gradcam_path, cv2.cvtColor(overlayed, cv2.COLOR_RGB2BGR))

        # Also save the original preprocessed image to disk (not just the
        # overlay) so the PDF report can show both side by side, matching
        # the UI's GradCamViewer component.
        original_filename = f"original_{uuid.uuid4().hex[:10]}.png"
        original_path = os.path.join(IMAGES_DIR, original_filename)
        cv2.imwrite(original_path, cv2.cvtColor(processed, cv2.COLOR_RGB2BGR))

        # base64-encode both images for direct inline display in the frontend
        _, overlay_buf = cv2.imencode('.png', cv2.cvtColor(overlayed, cv2.COLOR_RGB2BGR))
        gradcam_base64 = base64.b64encode(overlay_buf).decode('utf-8')

        _, original_buf = cv2.imencode('.png', cv2.cvtColor(processed, cv2.COLOR_RGB2BGR))
        original_base64 = base64.b64encode(original_buf).decode('utf-8')

        result["_gradcam_path"] = gradcam_path
        result["_original_path"] = original_path
        result["gradcam_image_base64"] = gradcam_base64
        result["original_image_base64"] = original_base64

    return result


def strip_internal(result: dict) -> dict:
    """Remove keys prefixed with _ before sending a JSON response."""
    return {k: v for k, v in result.items() if not k.startswith('_')}


# ══════════════════════════════════════════════════════════════════
# PDF REPORT GENERATOR (adapted from Chapter 3, Section 3.8)
# ══════════════════════════════════════════════════════════════════
NAVY = colors.HexColor('#0A2342')
TEAL = colors.HexColor('#0D9488')
TEAL_LIGHT = colors.HexColor('#CCFBF1')
GRAY = colors.HexColor('#64748B')
GRAY_LIGHT = colors.HexColor('#E2E8F0')
BG_LIGHT = colors.HexColor('#F8FAFC')
GREEN = colors.HexColor('#059669')
GREEN_BG = colors.HexColor('#ECFDF5')
AMBER = colors.HexColor('#D97706')
AMBER_BG = colors.HexColor('#FFFBEB')
RED = colors.HexColor('#DC2626')
RED_BG = colors.HexColor('#FEF2F2')

styles = getSampleStyleSheet()
section_style = ParagraphStyle('Section', fontSize=11.5, textColor=NAVY, fontName='Helvetica-Bold', spaceBefore=4, spaceAfter=8)
body_style = ParagraphStyle('Body', fontSize=9, textColor=colors.HexColor('#1E293B'), leading=14)
caption_style = ParagraphStyle('Caption', fontSize=8, textColor=GRAY, leading=12, fontName='Helvetica-Oblique')
disclaimer_style = ParagraphStyle('Disclaimer', fontSize=7, textColor=GRAY, leading=10, fontName='Helvetica-Oblique')


def draw_risk_gauge(risk_pct, risk_level, risk_color_hex):
    d = Drawing(60 * mm, 32 * mm)
    cx, cy, r = 30 * mm, 4 * mm, 22 * mm
    zones = [(0, 30, colors.HexColor('#D1FAE5')), (30, 60, colors.HexColor('#FEF3C7')), (60, 100, colors.HexColor('#FEE2E2'))]
    for start, end, col in zones:
        a1 = 180 - (start / 100 * 180)
        a2 = 180 - (end / 100 * 180)
        d.add(Wedge(cx, cy, r, a2, a1, radius1=r - 4 * mm, fillColor=col, strokeColor=None))
    angle_rad = math.radians(180 - (risk_pct / 100 * 180))
    needle_len = r - 2 * mm
    nx = cx + needle_len * math.cos(angle_rad)
    ny = cy + needle_len * math.sin(angle_rad)
    d.add(Line(cx, cy, nx, ny, strokeColor=NAVY, strokeWidth=2))
    d.add(Circle(cx, cy, 2 * mm, fillColor=NAVY, strokeColor=None))
    d.add(String(cx, cy + 6 * mm, f"{risk_pct}%", fontSize=18, fontName='Helvetica-Bold', fillColor=colors.HexColor(risk_color_hex), textAnchor='middle'))
    d.add(String(cx, cy - 3 * mm, risk_level, fontSize=8, fontName='Helvetica-Bold', fillColor=GRAY, textAnchor='middle'))
    return d


def draw_header_footer_factory(report_id, gen_time):
    def draw_header_footer(canvas, doc):
        canvas.saveState()
        page_w, page_h = A4
        canvas.setFillColor(NAVY)
        canvas.rect(0, page_h - 22 * mm, page_w, 22 * mm, fill=1, stroke=0)
        canvas.setFillColor(TEAL)
        canvas.rect(0, page_h - 22 * mm, 3 * mm, 22 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.white)
        canvas.setFont('Helvetica-Bold', 13)
        canvas.drawString(12 * mm, page_h - 10 * mm, "DIABETIC RETINOPATHY SCREENING REPORT")
        canvas.setFont('Helvetica', 8)
        canvas.setFillColor(TEAL_LIGHT)
        canvas.drawString(12 * mm, page_h - 16 * mm, "AI-Assisted Clinical Decision Support  \u2014  For Physician Review Only")
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(colors.white)
        canvas.drawRightString(page_w - 12 * mm, page_h - 9 * mm, f"Report ID: {report_id}")
        canvas.drawRightString(page_w - 12 * mm, page_h - 15 * mm, f"Generated: {gen_time}")
        canvas.setFillColor(GRAY)
        canvas.setFont('Helvetica', 7)
        canvas.drawString(12 * mm, 10 * mm, "DR Detection System \u2014 Clinical Decision Support Tool")
        canvas.drawRightString(page_w - 12 * mm, 10 * mm, f"Page {doc.page}")
        canvas.setStrokeColor(GRAY_LIGHT)
        canvas.setLineWidth(0.5)
        canvas.line(12 * mm, 13 * mm, page_w - 12 * mm, 13 * mm)
        canvas.restoreState()
    return draw_header_footer


def build_doc(output_path, report_id, gen_time):
    doc = BaseDocTemplate(output_path, pagesize=A4, topMargin=28 * mm, bottomMargin=18 * mm, leftMargin=12 * mm, rightMargin=12 * mm)
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='normal')
    doc.addPageTemplates([PageTemplate(id='report', frames=[frame], onPage=draw_header_footer_factory(report_id, gen_time))])
    return doc


def build_pdf_report(patient_data: dict, gradcam_path: str = None, original_path: str = None, shap_fig_path: str = None, output_path: str = None):
    has_clinical = shap_fig_path is not None
    has_image = gradcam_path is not None
    mode = "Mode 3 \u2014 Fusion" if (has_clinical and has_image) else "Mode 1 \u2014 Clinical Only" if has_clinical else "Mode 2 \u2014 Image Only"

    report_id = f"DR-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"
    gen_time = datetime.now().strftime('%d %B %Y, %H:%M')

    doc = build_doc(output_path, report_id, gen_time)
    elements = []

    if has_clinical:
        risk_score = patient_data['clinical_risk_score']
    else:
        risk_score = round((patient_data['predicted_dr_stage'] / 4.0) * 100 * (patient_data['image_confidence'] / 100), 1)

    risk_level = "LOW RISK" if risk_score < 30 else "MODERATE RISK" if risk_score < 60 else "HIGH RISK"
    risk_hex = '#059669' if risk_score < 30 else '#D97706' if risk_score < 60 else '#DC2626'
    risk_bg = GREEN_BG if risk_score < 30 else AMBER_BG if risk_score < 60 else RED_BG
    risk_border = GREEN if risk_score < 30 else AMBER if risk_score < 60 else RED

    id_table = Table([[
        Paragraph(f"<font color='#64748B' size=7><b>PATIENT ID</b></font><br/><font size=10>PT-{report_id[-4:]}</font>", body_style),
        Paragraph(f"<font color='#64748B' size=7><b>SCREENING DATE</b></font><br/><font size=10>{datetime.now().strftime('%d %b %Y')}</font>", body_style),
        Paragraph(f"<font color='#64748B' size=7><b>MODE USED</b></font><br/><font size=10>{mode}</font>", body_style),
    ]], colWidths=[58 * mm, 58 * mm, 58 * mm])
    id_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT), ('BOX', (0, 0), (-1, -1), 0.5, GRAY_LIGHT),
        ('LINEAFTER', (0, 0), (0, 0), 0.5, GRAY_LIGHT), ('LINEAFTER', (1, 0), (1, 0), 0.5, GRAY_LIGHT),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('LEFTPADDING', (0, 0), (-1, -1), 10),
    ]))
    elements.append(id_table)
    elements.append(Spacer(1, 10))

    gauge = draw_risk_gauge(risk_score, risk_level, risk_hex)
    if has_image:
        stage_text = f"""<font size=13 color='#0A2342'><b>{patient_data['predicted_stage_label']}</b></font>
        <font size=9 color='#64748B'>(Stage {patient_data['predicted_dr_stage']})</font><br/><br/>
        <font size=8 color='#64748B'>IMAGE MODEL CONFIDENCE</font><br/>
        <font size=11 color='#0A2342'><b>{patient_data['image_confidence']}%</b></font>"""
    else:
        stage_text = """<font size=13 color='#0A2342'><b>Clinical Risk Assessment</b></font><br/><br/>
        <font size=8 color='#64748B'>BASED ON</font><br/>
        <font size=10 color='#0A2342'>13 clinical parameters (no retinal image provided)</font>"""

    risk_card = Table([[gauge, Paragraph(stage_text, body_style)]], colWidths=[65 * mm, 109 * mm])
    risk_card.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), risk_bg), ('BOX', (0, 0), (-1, -1), 1, risk_border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('TOPPADDING', (0, 0), (-1, -1), 14), ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (1, 0), (1, 0), 14),
    ]))
    elements.append(risk_card)
    elements.append(Spacer(1, 14))

    if has_clinical:
        elements.append(Paragraph("CLINICAL PARAMETERS", section_style))

        # Always-present required fields first, then any optional fields
        # that were actually provided (patient_data only contains keys
        # that were filled in — see get_report()).
        field_display = [
            ('age', 'Age', 'yrs'), ('glucose', 'Glucose', 'mg/dL'),
            ('bmi', 'BMI', 'kg/m\u00b2'), ('diastolic_bp', 'Diastolic BP', 'mmHg'),
            ('systolic_bp', 'Systolic BP', 'mmHg'), ('pulse_rate', 'Pulse rate', 'bpm'),
            ('pregnancies', 'Pregnancies', ''), ('skin_thickness', 'Skin thickness', 'mm'),
            ('insulin', 'Insulin level', '\u00b5U/mL'), ('pedigree_function', 'Family history score', ''),
        ]
        flag_display = [
            ('family_diabetes', 'Family diabetes history'),
            ('hypertensive', 'Hypertension'),
            ('cardiovascular_disease', 'Cardiovascular disease'),
        ]

        present_fields = [(key, label, unit) for key, label, unit in field_display if key in patient_data]
        present_flags = [(key, label) for key, label in flag_display if key in patient_data]

        param_rows = []
        for i in range(0, len(present_fields), 2):
            left = present_fields[i]
            right = present_fields[i + 1] if i + 1 < len(present_fields) else None
            row = (
                left[1], f"{patient_data[left[0]]} {left[2]}".strip(),
                right[1] if right else '', f"{patient_data[right[0]]} {right[2]}".strip() if right else ''
            )
            param_rows.append(row)
        for i in range(0, len(present_flags), 2):
            left = present_flags[i]
            right = present_flags[i + 1] if i + 1 < len(present_flags) else None
            left_val = 'Yes' if patient_data[left[0]] else 'No'
            row = (
                left[1], left_val,
                right[1] if right else '', ('Yes' if patient_data[right[0]] else 'No') if right else ''
            )
            param_rows.append(row)

        clin_data = [[Paragraph(f"<font size=7 color='#64748B'><b>{a}</b></font>", body_style), Paragraph(f"<font size=10>{b}</font>", body_style),
                      Paragraph(f"<font size=7 color='#64748B'><b>{c}</b></font>", body_style), Paragraph(f"<font size=10>{d}</font>", body_style)]
                     for a, b, c, d in param_rows]
        clin_table = Table(clin_data, colWidths=[30 * mm, 44 * mm, 30 * mm, 44 * mm])
        clin_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, GRAY_LIGHT), ('BACKGROUND', (0, 0), (0, -1), BG_LIGHT), ('BACKGROUND', (2, 0), (2, -1), BG_LIGHT),
            ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7), ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(clin_table)
        elements.append(Spacer(1, 16))
    else:
        elements.append(Paragraph("CLINICAL PARAMETERS", section_style))
        elements.append(Paragraph("<i>No clinical data provided for this screening. Risk assessment based on retinal image analysis only.</i>", caption_style))
        elements.append(Spacer(1, 16))

    if has_image:
        elements.append(Paragraph("RETINAL IMAGE ANALYSIS \u2014 GRAD-CAM", section_style))
        if original_path:
            img_card = Table(
                [[RLImage(original_path, width=55 * mm, height=55 * mm),
                  RLImage(gradcam_path, width=55 * mm, height=55 * mm)]],
                colWidths=[87 * mm, 87 * mm]
            )
            img_card.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('BOX', (0, 0), (-1, -1), 0.5, GRAY_LIGHT),
                ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            elements.append(img_card)
            elements.append(Spacer(1, 4))
            caption_row = Table(
                [[Paragraph("Original image", caption_style), Paragraph("Grad-CAM heatmap", caption_style)]],
                colWidths=[87 * mm, 87 * mm]
            )
            caption_row.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER')]))
            elements.append(caption_row)
        else:
            img_card = Table([[RLImage(gradcam_path, width=60 * mm, height=60 * mm)]], colWidths=[174 * mm])
            img_card.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('BOX', (0, 0), (-1, -1), 0.5, GRAY_LIGHT), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
            elements.append(img_card)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(f"Heatmap highlights regions the model identified as most influential in classifying this retina as "
                                    f"<b>{patient_data['predicted_stage_label']}</b> (Stage {patient_data['predicted_dr_stage']}), "
                                    f"{patient_data['image_confidence']}% confidence.", caption_style))

    if has_clinical and has_image:
        elements.append(PageBreak())
    elif has_image and not has_clinical:
        elements.append(Spacer(1, 16))

    if has_clinical:
        elements.append(Paragraph("CLINICAL RISK EXPLANATION \u2014 SHAP", section_style))
        shap_card = Table([[RLImage(shap_fig_path, width=150 * mm, height=95 * mm)]], colWidths=[174 * mm])
        shap_card.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('BOX', (0, 0), (-1, -1), 0.5, GRAY_LIGHT), ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
        elements.append(shap_card)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("Each bar shows how a clinical parameter shifted this patient's risk score, ranked by impact.", caption_style))
        elements.append(Spacer(1, 16))

    elements.append(Paragraph("CLINICAL RECOMMENDATIONS", section_style))
    if risk_score < 30:
        recs = ["Continue routine annual diabetic retinopathy screening.",
                "Maintain current glycaemic control \u2014 values are within a healthy range." if has_clinical else "Continue standard diabetic eye care schedule.",
                "No urgent ophthalmological referral indicated based on current screening result."]
        rec_color = GREEN
    elif risk_score < 60:
        recs = ["Schedule ophthalmological review within 3\u20136 months.",
                "Review glycaemic control and blood pressure management with primary physician." if has_clinical else "Recommend clinical data collection for a more complete risk assessment.",
                "Repeat screening in 6 months to monitor progression."]
        rec_color = AMBER
    else:
        recs = ["Refer to ophthalmologist for dilated fundus examination within 4 weeks.",
                "Urgent review of glycaemic control indicated." if has_clinical else "Recommend full clinical work-up to complement this image-based finding.",
                "Repeat screening in 3 months following specialist review."]
        rec_color = RED

    if not has_image:
        recs.insert(0, "No retinal image was provided \u2014 this assessment is based on clinical risk factors only. A retinal examination is recommended to confirm DR status.")
    if not has_clinical:
        recs.insert(0, "No clinical data was provided \u2014 this assessment is based on retinal imaging only. Clinical parameters are recommended for a more complete risk profile.")

    rec_rows = [[Paragraph(f"<font color='{rec_color.hexval()}'>\u25CF</font>", body_style), Paragraph(rec, body_style)] for rec in recs]
    rec_table = Table(rec_rows, colWidths=[6 * mm, 168 * mm])
    rec_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 3)]))
    elements.append(rec_table)
    elements.append(Spacer(1, 18))

    disclaimer_box = Table([[Paragraph(
        "<b>Disclaimer:</b> This report is generated by an AI screening system and must be reviewed and confirmed "
        "by a qualified clinician before any clinical decision is made. This system is a decision-support tool "
        "and is not a diagnostic device.", disclaimer_style)]], colWidths=[174 * mm])
    disclaimer_box.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT), ('BOX', (0, 0), (-1, -1), 0.5, GRAY_LIGHT),
                                          ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8), ('LEFTPADDING', (0, 0), (-1, -1), 8)]))
    elements.append(disclaimer_box)

    doc.build(elements)
    return report_id


def generate_shap_waterfall_image(shap_values_array, X_input_row, feature_names, output_path):
    fig = plt.figure(figsize=(9, 6))
    shap.plots.waterfall(
        shap.Explanation(
            values=shap_values_array,
            base_values=clinical_explainer.expected_value,
            data=X_input_row,
            feature_names=feature_names
        ),
        show=False
    )
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    plt.close(fig)


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

    report_id = uuid.uuid4().hex[:12]
    REPORT_CACHE[report_id] = {
        "mode": "clinical",
        "clinical_data": data.dict(),
        "clinical_result": result,
        "image_result": None,
    }

    response = strip_internal(result)
    return {"mode": "Mode 1 — Clinical Only", "clinical": response, "report_id": report_id}


@app.post("/predict/image")
async def predict_image_endpoint(file: UploadFile = File(...)):
    image_bytes = await validate_image_upload(file)
    result = run_image_prediction(image_bytes, generate_heatmap=True)

    report_id = uuid.uuid4().hex[:12]
    REPORT_CACHE[report_id] = {
        "mode": "image",
        "clinical_data": None,
        "clinical_result": None,
        "image_result": result,
    }

    response = strip_internal(result)
    return {"mode": "Mode 2 — Image Only", "image": response, "report_id": report_id}


@app.post("/predict/fusion")
async def predict_fusion_endpoint(
    file: UploadFile = File(...),
    age: float = Form(..., ge=1, le=120),
    glucose: float = Form(..., ge=40, le=600),
    bmi: float = Form(..., ge=10, le=70),
    diastolic_bp: float = Form(..., ge=30, le=160),
    gender: str = Form("Female"),
    pregnancies: Optional[float] = Form(None, ge=0, le=20),
    skin_thickness: Optional[float] = Form(None, ge=0, le=100),
    insulin: Optional[float] = Form(None, ge=0, le=900),
    pedigree_function: Optional[float] = Form(None, ge=0, le=3),
    systolic_bp: Optional[float] = Form(None, ge=50, le=250),
    pulse_rate: Optional[float] = Form(None, ge=30, le=220),
    family_diabetes: Optional[float] = Form(None, ge=0, le=1),
    hypertensive: Optional[float] = Form(None, ge=0, le=1),
    cardiovascular_disease: Optional[float] = Form(None, ge=0, le=1),
):
    if gender not in ("Male", "Female"):
        raise HTTPException(status_code=400, detail="Gender must be 'Male' or 'Female'.")

    clinical_dict = {
        "age": age, "glucose": glucose, "bmi": bmi, "diastolic_bp": diastolic_bp, "gender": gender,
        "pregnancies": pregnancies, "skin_thickness": skin_thickness, "insulin": insulin,
        "pedigree_function": pedigree_function, "systolic_bp": systolic_bp, "pulse_rate": pulse_rate,
        "family_diabetes": family_diabetes, "hypertensive": hypertensive,
        "cardiovascular_disease": cardiovascular_disease,
    }
    clinical_result = run_clinical_prediction(clinical_dict)

    image_bytes = await validate_image_upload(file)
    image_result = run_image_prediction(image_bytes, generate_heatmap=True)

    severity_labels = ['No DR', 'Mild NPDR', 'Moderate NPDR', 'Severe NPDR', 'Proliferative DR']
    image_severity = sum(
        (i / 4.0) * (image_result["all_probabilities"][label] / 100)
        for i, label in enumerate(severity_labels)
    )
    fused_score = round((0.6 * (clinical_result["risk_score"] / 100) + 0.4 * image_severity) * 100, 1)

    report_id = uuid.uuid4().hex[:12]
    REPORT_CACHE[report_id] = {
        "mode": "fusion",
        "clinical_data": clinical_dict,
        "clinical_result": clinical_result,
        "image_result": image_result,
        "fused_risk_score": fused_score,
    }

    return {
        "mode": "Mode 3 — Fusion",
        "clinical": strip_internal(clinical_result),
        "image": strip_internal(image_result),
        "fused_risk_score": fused_score,
        "report_id": report_id
    }


@app.get("/report/{report_id}")
def get_report(report_id: str):
    if report_id not in REPORT_CACHE:
        raise HTTPException(status_code=404, detail="Report not found. It may have expired if the server restarted.")

    cached = REPORT_CACHE[report_id]
    clinical_data = cached["clinical_data"]
    clinical_result = cached["clinical_result"]
    image_result = cached["image_result"]

    patient_data = {}
    shap_fig_path = None
    gradcam_path = None
    original_path = None

    if clinical_result is not None:
        patient_data.update({
            "age": clinical_data["age"],
            "glucose": clinical_data["glucose"],
            "bmi": clinical_data["bmi"],
            "diastolic_bp": clinical_data["diastolic_bp"],
            "clinical_risk_score": cached.get("fused_risk_score", clinical_result["risk_score"]),
        })
        # Include any optional fields the clinician actually provided
        # (None values are omitted so the PDF only shows real data).
        optional_keys = ['systolic_bp', 'pulse_rate', 'pregnancies', 'skin_thickness',
                          'insulin', 'pedigree_function', 'family_diabetes',
                          'hypertensive', 'cardiovascular_disease']
        for key in optional_keys:
            val = clinical_data.get(key)
            if val is not None:
                patient_data[key] = val
        shap_fig_path = os.path.join(IMAGES_DIR, f"shap_{report_id}.png")
        generate_shap_waterfall_image(
            clinical_result["_shap_explanation"],
            clinical_result["_X_input"].iloc[0],
            clinical_result["feature_names"],
            shap_fig_path
        )

    if image_result is not None:
        patient_data.update({
            "predicted_dr_stage": image_result["predicted_stage"],
            "predicted_stage_label": image_result["stage_label"],
            "image_confidence": image_result["confidence"],
        })
        gradcam_path = image_result["_gradcam_path"]
        original_path = image_result.get("_original_path")

    pdf_path = os.path.join(REPORTS_DIR, f"report_{report_id}.pdf")
    build_pdf_report(patient_data, gradcam_path=gradcam_path, original_path=original_path, shap_fig_path=shap_fig_path, output_path=pdf_path)

    return FileResponse(pdf_path, media_type="application/pdf", filename=f"DR_Report_{report_id}.pdf")