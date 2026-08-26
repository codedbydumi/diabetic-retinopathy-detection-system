FROM python:3.11-slim

# System libraries required by opencv-python-headless AND by
# TensorFlow/XGBoost's compiled OpenMP-based native code (libgomp1).
# Missing libgomp1 causes a native crash at import time — surfaces as
# a segfault backtrace through libffi/_ctypes, not a normal Python error.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY models/ /app/models/

ENV MODELS_DIR=/app/models

RUN mkdir -p /app/generated_reports /app/generated_images

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]