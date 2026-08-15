import joblib
from tensorflow.keras.models import load_model
import tensorflow.keras.backend as K

def categorical_focal_loss(gamma=2.0, alpha=0.25):
    def focal_loss(y_true, y_pred):
        y_pred = K.clip(y_pred, K.epsilon(), 1.0 - K.epsilon())
        cross_entropy = -y_true * K.log(y_pred)
        weight = alpha * K.pow(1 - y_pred, gamma)
        loss = weight * cross_entropy
        return K.sum(loss, axis=-1)
    return focal_loss

print("Loading clinical model...")
clinical_model = joblib.load('../models/clinical_model_xgboost_FINAL.pkl')
clinical_threshold = joblib.load('../models/clinical_threshold_FINAL.pkl')
print(f"Clinical model loaded. Threshold: {clinical_threshold}")

print("Loading image model...")
image_model = load_model(
    '../models/mobilenetv2_final_v4_tta.keras',
    custom_objects={'focal_loss': categorical_focal_loss(gamma=2.0, alpha=0.25)}
)
print("Image model loaded.")

print("\n✅ Both models load correctly to my local machine.")