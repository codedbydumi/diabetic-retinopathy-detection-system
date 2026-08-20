import { useState, useRef } from 'react';
import { CLINICAL_BOUNDS, validateClinicalField } from '../api';

const MODES = [
  {
    id: 'clinical',
    title: 'Mode 1 — Clinical only',
    sub: '13 clinical parameters, no image required',
  },
  {
    id: 'image',
    title: 'Mode 2 — Image only',
    sub: 'Retinal fundus photograph, no clinical data',
  },
  {
    id: 'fusion',
    title: 'Mode 3 — Fusion',
    sub: 'Both inputs, highest accuracy',
  },
];

const DEFAULT_CLINICAL = {
  age: '',
  glucose: '',
  bmi: '',
  diastolic_bp: '',
  gender: 'Female',
};

function ScreeningForm({ mode, onModeChange, onSubmit, isLoading, error }) {
  const [clinicalData, setClinicalData] = useState(DEFAULT_CLINICAL);
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const needsClinical = mode === 'clinical' || mode === 'fusion';
  const needsImage = mode === 'image' || mode === 'fusion';

  function handleFieldChange(field, value) {
    setClinicalData((prev) => ({ ...prev, [field]: value }));
    const message = validateClinicalField(field, value);
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
  }

  function handleFile(file) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setFieldErrors((prev) => ({
        ...prev,
        _image: 'File must be PNG or JPEG.',
      }));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setFieldErrors((prev) => ({
        ...prev,
        _image: 'Image must be under 15MB.',
      }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, _image: null }));
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  }

  function handleRemoveImage() {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function isFormValid() {
    if (needsClinical) {
      const requiredFields = ['age', 'glucose', 'bmi', 'diastolic_bp'];
      for (const field of requiredFields) {
        const message = validateClinicalField(field, clinicalData[field]);
        if (message) return false;
      }
    }
    if (needsImage && !imageFile) return false;
    return true;
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (needsClinical) {
      const requiredFields = ['age', 'glucose', 'bmi', 'diastolic_bp'];
      const newErrors = {};
      let hasError = false;
      for (const field of requiredFields) {
        const message = validateClinicalField(field, clinicalData[field]);
        newErrors[field] = message;
        if (message) hasError = true;
      }
      setFieldErrors((prev) => ({ ...prev, ...newErrors }));
      if (hasError) return;
    }

    if (needsImage && !imageFile) {
      setFieldErrors((prev) => ({ ...prev, _image: 'Please upload a retinal image.' }));
      return;
    }

    onSubmit({
      clinicalData: needsClinical
        ? {
            ...clinicalData,
            age: Number(clinicalData.age),
            glucose: Number(clinicalData.glucose),
            bmi: Number(clinicalData.bmi),
            diastolic_bp: Number(clinicalData.diastolic_bp),
          }
        : null,
      imageFile: needsImage ? imageFile : null,
    });
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <p className="section-title">Screening mode</p>
      <div className="mode-tabs" role="tablist">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            className={`mode-tab${mode === m.id ? ' active' : ''}`}
            onClick={() => onModeChange(m.id)}
          >
            <div className="mode-tab-title">{m.title}</div>
            <div className="mode-tab-sub">{m.sub}</div>
          </button>
        ))}
      </div>

      {error && (
        <div className="error-banner">
          <p className="error-banner-message">{error.message}</p>
          {error.fields?.length > 0 && (
            <ul className="error-banner-fields">
              {error.fields.map((f, i) => (
                <li key={i}>
                  <strong>{f.field}</strong>: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {needsClinical && (
        <>
          <p className="section-title">Clinical parameters</p>
          <div className="field-grid">
            <ClinicalField
              field="age"
              label="Age"
              value={clinicalData.age}
              error={fieldErrors.age}
              onChange={handleFieldChange}
            />
            <ClinicalField
              field="glucose"
              label="Glucose"
              value={clinicalData.glucose}
              error={fieldErrors.glucose}
              onChange={handleFieldChange}
            />
            <ClinicalField
              field="bmi"
              label="BMI"
              value={clinicalData.bmi}
              error={fieldErrors.bmi}
              onChange={handleFieldChange}
            />
            <ClinicalField
              field="diastolic_bp"
              label="Diastolic BP"
              value={clinicalData.diastolic_bp}
              error={fieldErrors.diastolic_bp}
              onChange={handleFieldChange}
            />
            <div className="field">
              <label htmlFor="gender">Gender</label>
              <select
                id="gender"
                value={clinicalData.gender}
                onChange={(e) => handleFieldChange('gender', e.target.value)}
              >
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </div>
          </div>
        </>
      )}

      {needsImage && (
        <>
          <p className="section-title" style={{ marginTop: needsClinical ? 22 : 0 }}>
            Retinal image
          </p>

          {!imagePreviewUrl ? (
            <div
              className={`dropzone${isDragActive ? ' drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragActive(true);
              }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
            >
              <svg
                className="dropzone-icon"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 16.5V18a2 2 0 002 2h12a2 2 0 002-2v-1.5M12 3v13m0-13l-4 4m4-4l4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="dropzone-text">Click or drag a retinal image here</div>
              <div className="dropzone-hint">PNG or JPEG, up to 15MB</div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </div>
          ) : (
            <div className="image-preview">
              <img src={imagePreviewUrl} alt="Retinal fundus preview" />
              <button
                type="button"
                className="image-preview-remove"
                onClick={handleRemoveImage}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          )}
          {fieldErrors._image && (
            <p className="field-error" style={{ marginTop: 8 }}>
              {fieldErrors._image}
            </p>
          )}
        </>
      )}

      <div style={{ marginTop: 22 }}>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !isFormValid()}
        >
          {isLoading ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Analysing…
            </>
          ) : (
            'Run screening'
          )}
        </button>
      </div>
    </form>
  );
}

function ClinicalField({ field, label, value, error, onChange }) {
  const bounds = CLINICAL_BOUNDS[field];
  return (
    <div className="field">
      <label htmlFor={field}>{label}</label>
      <input
        id={field}
        type="number"
        step="any"
        value={value}
        className={error ? 'invalid' : ''}
        onChange={(e) => onChange(field, e.target.value)}
        placeholder={`${bounds.min}–${bounds.max}`}
      />
      {error ? (
        <span className="field-error">{error}</span>
      ) : (
        <span className="field-hint">
          {bounds.min}–{bounds.max} {bounds.unit}
        </span>
      )}
    </div>
  );
}

export default ScreeningForm;