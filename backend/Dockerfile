# Backend Dockerfile — build this from the PROJECT ROOT (not from
# inside backend/), since models/ lives as a sibling folder to
# backend/ in the repo and Docker cannot COPY from outside its build
# context. See the build command in DEPLOY_NOTES.md.

FROM python:3.11-slim

# System libraries required by opencv-python-headless at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first — this layer only rebuilds when
# requirements.txt changes, not on every code edit, keeping rebuilds fast.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend application code
COPY backend/ .

# Copy trained model artefacts (sibling folder in the repo)
COPY models/ /app/models/

# Tells main.py exactly where to find the models inside the container —
# matches the MODELS_DIR fallback logic added to main.py, so no code
# changes are needed between local development and this container.
ENV MODELS_DIR=/app/models

# Runtime-generated directories (PDF reports, Grad-CAM images)
RUN mkdir -p /app/generated_reports /app/generated_images

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]