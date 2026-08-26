import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:8000';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // image inference (TTA + Grad-CAM) can take a few seconds — generous timeout
});

// ── error normalisation ──────────────────────────────────────────
// FastAPI/Pydantic validation errors arrive as { detail: [{ loc, msg, ... }] }
// Everything else (network failure, 500s) needs its own readable message.
// This turns all of that into one consistent { message, fields } shape
// so every component can handle errors the same way.
function normalizeError(error) {
  if (error.response) {
    const { status, data } = error.response;

    if (status === 422 && Array.isArray(data.detail)) {
      const fields = data.detail.map((d) => ({
        field: d.loc[d.loc.length - 1],
        message: d.msg,
      }));
      return {
        message: 'One or more values are outside the accepted range.',
        fields,
        status,
      };
    }

    if (data && typeof data.detail === 'string') {
      return { message: data.detail, fields: [], status };
    }

    return { message: `Request failed (${status}).`, fields: [], status };
  }

  if (error.request) {
    return {
      message:
        'Could not reach the DR Detection API. Confirm the backend is running at ' +
        API_BASE_URL,
      fields: [],
      status: null,
    };
  }

  return { message: error.message || 'Unexpected error.', fields: [], status: null };
}

// ── API calls ─────────────────────────────────────────────────────

export async function predictClinical(clinicalData) {
  try {
    const response = await client.post('/predict/clinical', clinicalData);
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function predictImage(imageFile) {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    const response = await client.post('/predict/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function predictFusion(clinicalData, imageFile) {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    // Required fields are always present.
    formData.append('age', clinicalData.age);
    formData.append('glucose', clinicalData.glucose);
    formData.append('bmi', clinicalData.bmi);
    formData.append('diastolic_bp', clinicalData.diastolic_bp);
    formData.append('gender', clinicalData.gender);

    // Optional fields — only append the ones the clinician actually
    // filled in (buildClinicalPayload in ScreeningForm already strips
    // empty ones from clinicalData, so anything present here is real).
    const optionalKeys = [
      'systolic_bp', 'pulse_rate', 'pregnancies', 'skin_thickness',
      'insulin', 'pedigree_function', 'family_diabetes', 'hypertensive',
      'cardiovascular_disease',
    ];
    for (const key of optionalKeys) {
      if (clinicalData[key] !== undefined && clinicalData[key] !== null && clinicalData[key] !== '') {
        formData.append(key, clinicalData[key]);
      }
    }

    const response = await client.post('/predict/fusion', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// Downloads the PDF report and triggers a browser save — used by the
// "Download report" button once a report_id has been returned by any
// of the three prediction calls above.
export async function downloadReport(reportId) {
  try {
    const response = await client.get(`/report/${reportId}`, {
      responseType: 'blob',
    });

    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `DR_Report_${reportId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function checkHealth() {
  try {
    const response = await client.get('/health');
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
}

// ── clinical field validation bounds ────────────────────────────
// Mirrors backend/main.py ClinicalInput exactly (see Chapter 3/4).
// Used for client-side hints and pre-submit validation so users get
// instant feedback instead of waiting on a round trip for a 422.
export const CLINICAL_BOUNDS = {
  age: { min: 21, max: 120, unit: 'years', required: true },
  glucose: { min: 40, max: 600, unit: 'mg/dL', required: true },
  bmi: { min: 10, max: 70, unit: 'kg/m²', required: true },
  diastolic_bp: { min: 30, max: 160, unit: 'mmHg', required: true },
  systolic_bp: { min: 50, max: 250, unit: 'mmHg', required: false },
  pulse_rate: { min: 30, max: 220, unit: 'bpm', required: false },
  pregnancies: { min: 0, max: 20, unit: '', required: false },
  skin_thickness: { min: 0, max: 100, unit: 'mm', required: false },
  insulin: { min: 0, max: 900, unit: 'µU/mL', required: false },
  pedigree_function: { min: 0, max: 3, unit: '', required: false },
};

export function validateClinicalField(field, value) {
  const bounds = CLINICAL_BOUNDS[field];
  if (!bounds) return null;
  if (value === '' || value === null || value === undefined) {
    return bounds.required ? 'This field is required.' : null;
  }
  const num = Number(value);
  if (Number.isNaN(num)) return 'Must be a number.';
  if (num < bounds.min || num > bounds.max) {
    return `Must be between ${bounds.min} and ${bounds.max} ${bounds.unit}.`.trim();
  }
  return null;
}