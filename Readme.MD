# AI-Powered Diabetic Retinopathy Detection System

A multi-modal deep learning system for early detection of diabetic retinopathy, combining clinical data analysis and retinal image processing with explainable AI, built for accessible screening at primary care level.

**Author:** Dumindu Thushan
**Student ID:** CL/BSCDS/CMU/09/79
**Programme:** BSc (Hons) Data Science — Final Year Project

---

## Overview

This system screens patients for diabetic retinopathy (DR) using three operational modes, designed to remain useful even in clinics without specialist equipment:

- **Mode 1 — Clinical only:** 13 clinical parameters → risk score + SHAP explanation
- **Mode 2 — Image only:** retinal fundus image → DR severity stage (0–4) + Grad-CAM heatmap
- **Mode 3 — Full fusion:** both inputs combined → highest-accuracy prediction + full explainability

Every mode produces an automated two-page PDF clinical report suitable for patient records or specialist referral.

---

## Key Results

| Model | Metric | Result |
|---|---|---|
| Clinical model (XGBoost) | Accuracy | 86.8% |
| Clinical model (XGBoost) | AUC-ROC | 0.896 |
| Image model (MobileNetV2 + focal loss + TTA) | Accuracy | 78.0% |
| Image model (MobileNetV2 + focal loss + TTA) | AUC-ROC | 0.920 |
| Image model (MobileNetV2 + focal loss + TTA) | Quadratic Weighted Kappa | 0.863 |

Full methodology, iteration history, and honest discussion of trade-offs are documented in `reports/`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Clinical model | XGBoost, scikit-learn |
| Image model | TensorFlow, MobileNetV2, transfer learning |
| Explainability | SHAP (clinical), Grad-CAM (image) |
| Report generation | ReportLab |
| Backend | FastAPI *(in progress)* |
| Frontend | React 18 *(in progress)* |
| Deployment | Docker *(planned)* |

---

## Datasets

| Dataset | Purpose | Records | Source |
|---|---|---|---|
| DiaBD (Bangladesh) | Clinical — South Asian population | 5,288 | Mendeley Data (CC BY) |
| PIMA Indian Diabetes | Clinical — bias audit reference | 768 | UCI / NIH |
| APTOS 2019 | Retinal fundus images, 5-stage DR labels | 3,662 images | Kaggle / Aravind Eye Hospital |

All datasets are free, open access, and cited in full in the project report.

---

## Project Structure

```
diabetic-retinopathy-detection-system/
├── data/                       Raw and processed datasets (gitignored)
├── notebooks/                  Colab experimentation notebooks
│   ├── 01_data_exploration.ipynb
│   ├── 02_clinical_model.ipynb
│   ├── 03_image_model.ipynb
│   ├── 04_fusion_ablation.ipynb
│   └── 05_pdf_report_generator.ipynb
├── models/                     Trained model artefacts
│   ├── clinical_model_xgboost_FINAL.pkl
│   ├── clinical_threshold_FINAL.pkl
│   ├── mobilenetv2_final_v4_tta.keras
│   ├── clinical_model_final_results.json
│   └── fusion_ablation_results.json
├── backend/
│   └── ml/                     Reusable prediction functions
│       ├── clinical_model_fn.py
│       ├── image_model_fn.py
│       ├── fusion_fn.py
│       └── report_generator_fn.py
├── frontend/                   React application (in progress)
├── reports/
│   ├── figures/                SHAP charts, Grad-CAM examples
│   └── Project_Proposal.docx
├── requirements.txt
└── README.md
```

---

## Methodology Highlights

- **Multi-source clinical data integration** — merged DiaBD and PIMA datasets after identifying and correcting a glucose unit mismatch (mg/dL vs mmol/L) discovered during bias auditing.
- **Class imbalance handling** — compared class weighting, SMOTE, and ensembling for the clinical model; compared class weighting, focal loss, and test-time augmentation for the image model. Selected the best-performing technique with evidence at each step.
- **Fusion ablation study** — evaluated both late fusion (weighted ensemble) and intermediate fusion (feature-level concatenation) under rank-matched and random pairing conditions, given the absence of genuinely paired multi-modal patient data in public datasets.
- **Demographic bias audit** — evaluated clinical model performance stratified by gender, age group, and source dataset (PIMA vs DiaBD), with root-cause investigation into an identified performance gap.
- **Dual explainability** — SHAP waterfall charts for per-patient clinical risk explanation; Grad-CAM heatmaps for retinal image lesion localisation, qualitatively validated against visible pathology.

---

## Project Status

- [x] Data collection, verification, and preprocessing
- [x] Clinical model (XGBoost, tuned, threshold-optimised)
- [x] Image model (MobileNetV2, two-phase transfer learning)
- [x] SHAP explainability
- [x] Grad-CAM explainability
- [x] Multi-modal fusion ablation study (late + intermediate)
- [x] Demographic bias audit
- [x] Automated PDF clinical report generator (all 3 modes)
- [ ] FastAPI backend
- [ ] React frontend
- [ ] Docker deployment
- [ ] Final report — Chapters 3–6

---

## Disclaimer

This system is a clinical decision-support tool developed for academic and research purposes. It is **not** a diagnostic device. All AI-generated outputs must be reviewed and confirmed by a qualified clinician before any clinical decision is made.

---

## References

Full reference list available in the project report (`reports/`), including citations for all datasets, model architectures (MobileNetV2, XGBoost), and explainability methods (SHAP, Grad-CAM) used in this project.