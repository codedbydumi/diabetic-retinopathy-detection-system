import joblib
import xgboost as xgb

clinical_model = joblib.load('../models/clinical_model_xgboost_FINAL.pkl')

# Save in XGBoost's native format instead
clinical_model.save_model('../models/clinical_model_xgboost_FINAL.json')

print("Re-saved in native XGBoost format.")