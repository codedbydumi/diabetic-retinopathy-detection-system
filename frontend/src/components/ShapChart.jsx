import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

// Maps the backend's internal feature names (FEATURE_ORDER in main.py) to
// plain-English labels a clinician can read without needing to know the
// underlying column names.
const FEATURE_LABELS = {
  age: 'Age',
  glucose: 'Blood glucose',
  bmi: 'Body Mass Index',
  diastolic_bp: 'Diastolic blood pressure',
  systolic_bp: 'Systolic blood pressure',
  gender_encoded: 'Gender',
  pregnancies: 'Pregnancies',
  skin_thickness: 'Skin thickness',
  insulin: 'Insulin level',
  pedigree_function: 'Family history score',
  pulse_rate: 'Pulse rate',
  family_diabetes: 'Family history of diabetes',
  hypertensive: 'Hypertension',
  cardiovascular_disease: 'Cardiovascular disease',
};

function ShapChart({ shapValues, featureNames }) {
  if (!shapValues || !featureNames) return null;

  const data = featureNames
    .map((name, i) => ({
      name: FEATURE_LABELS[name] || name,
      rawName: name,
      value: shapValues[i],
    }))
    .filter((d) => !d.rawName.endsWith('_missing'))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);

  const topFactor = data[0];

  return (
    <div>
      {topFactor && (
        <p
          style={{
            margin: '0 0 14px',
            fontSize: 13.5,
            color: 'var(--ink)',
            padding: '10px 14px',
            background: 'var(--bg-light)',
            borderRadius: 8,
            border: '1px solid var(--gray-light)',
          }}
        >
          <strong>{topFactor.name}</strong> is the strongest factor
          {topFactor.value >= 0 ? ' increasing' : ' decreasing'} this
          patient&rsquo;s risk score.
        </p>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-light)" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--gray)' }} />
          <YAxis
            type="category"
            dataKey="name"
            width={140}
            tick={{ fontSize: 11.5, fill: 'var(--ink)' }}
          />
          <ReferenceLine x={0} stroke="var(--gray)" />
          <Tooltip
            formatter={(value) => value.toFixed(3)}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--gray-light)',
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 4, 4]}>
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.value >= 0 ? 'var(--red)' : 'var(--teal)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--gray-light)',
        }}
      >
        <LegendSwatch color="var(--red)" label="Increases risk" />
        <LegendSwatch color="var(--teal)" label="Decreases risk" />
        <span style={{ fontSize: 11.5, color: 'var(--gray)' }}>
          Ranked by impact, top 10 factors shown
        </span>
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          background: color,
          display: 'inline-block',
        }}
      />
      <span style={{ fontSize: 11.5, color: 'var(--ink)', fontWeight: 600 }}>
        {label}
      </span>
    </div>
  );
}

export default ShapChart;