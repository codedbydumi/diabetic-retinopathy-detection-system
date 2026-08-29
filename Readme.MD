# AI-Powered Diabetic Retinopathy Detection System

A multi-modal clinical decision support system that screens for diabetic retinopathy using **clinical data, retinal images, or both** — and explains every prediction it makes.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

**Live system:** [dr-ai.duminduthushan.com](https://dr-ai.duminduthushan.com) · **API docs:** [dr-detection.duminduthushan.com/docs](https://dr-detection.duminduthushan.com/docs)

> ⚠️ **This is a clinical decision-support tool, not a diagnostic device.** All predictions must be reviewed and confirmed by a qualified clinician before any clinical decision is made. It has not undergone prospective clinical validation and is not approved for real patient care.

---

## Why this exists

Diabetic retinopathy is the leading cause of preventable blindness in working-age adults, affecting roughly one in three people with diabetes. It progresses silently — by the time a patient notices vision changes, damage is often permanent.

Screening works, but it requires an ophthalmologist and a fundus camera. At primary care level in many countries, neither is available. In Sri Lanka, fewer than 18% of registered diabetic patients had a retinal examination within a two-year period.

Existing AI screening tools (Gulshan et al., 2016; IDx-DR) are **image-only**, produce **no explanation**, and generate **no clinical documentation**. This project addresses all three gaps in a single deployed system.

---

## What it does

| | Mode 1 | Mode 2 | Mode 3 |
|---|---|---|---|
| **Input** | 14 clinical parameters | Retinal fundus image | Both |
| **Output** | Risk probability | DR severity stage (0–4) | Fused risk score |
| **Explanation** | SHAP waterfall | Grad-CAM heatmap | Both |
| **Hardware needed** | Browser only | Fundus camera | Fundus camera |

**Mode 1 is the access case** — a clinician with no imaging hardware can still screen a patient using data already in their record.

Every mode generates a downloadable, structured **PDF clinical report** suitable for a patient file or referral letter.

---

## Results

| Model | Metric | Result |
|---|---|---|
| Clinical (XGBoost) | Accuracy | 86.8% |
| Clinical (XGBoost) | AUC-ROC | 0.896 |
| Image (MobileNetV2) | Accuracy | 78.0% |
| Image (MobileNetV2) | AUC-ROC | 0.920 |
| Image (MobileNetV2) | Quadratic Weighted Kappa | 0.863 |

**On the clinical accuracy figure:** an earlier version scored 87.1%, but a demographic bias audit revealed that glucose was recorded in mg/dL in one source dataset and mmol/L in the other. After correcting the unit mismatch, accuracy settled at 86.8%. The lower number is reported because it reflects correct data.

**On image accuracy:** raw accuracy is a weak metric for imbalanced five-class ordinal grading, where the majority class alone is 49.3% of samples. QWK (0.863) better reflects the model's ability to order severity correctly, which is what matters clinically.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Presentation    React + Vite  →  Vercel        │
├─────────────────────────────────────────────────┤
│  Application     FastAPI (Docker) → Contabo VPS │
├─────────────────────────────────────────────────┤
│  Models          XGBoost  |  MobileNetV2        │
├─────────────────────────────────────────────────┤
│  Fusion & XAI    Late fusion | SHAP | Grad-CAM  │
├─────────────────────────────────────────────────┤
│  Persistence     Model artefacts | Report cache │
└─────────────────────────────────────────────────┘
```

Backend runs behind an Apache reverse proxy with a Let's Encrypt TLS certificate. CORS is restricted to the deployed frontend origin.

---

## Data

| Dataset | Records | Use |
|---|---|---|
| [PIMA Indian Diabetes](https://www.kaggle.com/datasets/uciml/pima-indians-diabetes-database) | 768 | Clinical model |
| [DiaBD (Bangladesh)](https://doi.org/10.1016/j.dib.2025.111746) | 5,288 | Clinical model |
| [APTOS 2019 Blindness Detection](https://www.kaggle.com/c/aptos2019-blindness-detection) | 3,662 images | Image model |

Clinical datasets merged to **6,056 records** with 14 substantive features plus 9 missing-value indicator flags. Images preprocessed with automatic cropping, resizing to 224×224, and CLAHE contrast enhancement.

> Datasets are **not redistributed** in this repository. Download them from the sources above.

---

## Repository structure

```
├── backend/          FastAPI application + Dockerfile
├── frontend/         React (Vite) single-page application
├── models/           Trained model artefacts
├── notebooks/        8 sequential development notebooks
└── docker-compose.yml
```

### Notebooks

| # | Notebook | Covers |
|---|---|---|
| 01 | `data_collection` | Dataset acquisition |
| 02 | `clinical_data_prep` | Merge, impute, unit correction |
| 03 | `clinical_model` | XGBoost tuning, threshold sweep |
| 04 | `image_data_prep` | Cropping, CLAHE, augmentation |
| 05 | `image_model_training` | MobileNetV2 transfer learning |
| 06 | `gradcam_focal_tta` | Grad-CAM, focal loss, test-time augmentation |
| 07 | `fusion_ablation` | Late vs. intermediate fusion study |
| 08 | `pdf_report_generator` | Automated clinical report |

---

## Running locally

**Prerequisites:** Docker and Docker Compose, Node.js 18+

```bash
git clone https://github.com/codedbydumi/diabetic-retinopathy-detection-system.git
cd diabetic-retinopathy-detection-system
```

**Backend**

```bash
docker compose up -d --build
# API available at http://localhost:8000
# Interactive docs at http://localhost:8000/docs
```

**Frontend**

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/predict/clinical` | Mode 1 — clinical parameters only |
| `POST` | `/predict/image` | Mode 2 — retinal image only |
| `POST` | `/predict/fusion` | Mode 3 — both inputs |
| `GET` | `/report/{report_id}` | Download the generated PDF |
| `GET` | `/health` | Model load status |

Full interactive documentation at [`/docs`](https://dr-detection.duminduthushan.com/docs).

---

## Known limitations

- **No prospective clinical validation.** All metrics are retrospective, on held-out test partitions.
- **Residual demographic disparity.** A 24.9 percentage-point accuracy gap remains between the two clinical source datasets after the glucose unit correction — narrowed from 29.4pp, but not eliminated.
- **No genuinely paired multi-modal data exists publicly.** Intermediate fusion was evaluated on a synthetically rank-matched set of 550 samples and underperformed both single-modality models; late fusion is deployed instead.
- **The PIMA subset is female-only, aged 21+.** Input validation is bounded to age 21–120 to avoid extrapolating beyond the training distribution.
- **Stateless by design.** Reports are cached in memory and do not survive a backend restart.

---

## Future work

- Prospective validation with real patients and practising clinicians
- Acquiring or constructing a genuinely paired clinical + imaging dataset
- Further investigation of the residual source-dataset performance gap
- Database persistence for longitudinal patient tracking
- EHR integration and in-app fundus camera capture

---

## Built with

**ML** — XGBoost · scikit-learn · TensorFlow/Keras · SHAP · OpenCV
**Backend** — Python 3.11 · FastAPI · ReportLab · Docker
**Frontend** — React · Vite
**Infrastructure** — Contabo VPS · Apache · Let's Encrypt · Vercel

---

## Academic context

Developed as the final year Development Project (CSE6035) for BSc (Hons) Data Science, Cardiff Metropolitan University via ICBT Campus.

**Author:** Dumindu Thushan

---

## License

Released under the [MIT License](LICENSE).

The license covers **this repository's source code only**. The PIMA, DiaBD, and APTOS 2019 datasets are governed by their own respective licences and terms of use — consult each source before using them. Trained model artefacts derived from those datasets inherit any restrictions their source data carries.