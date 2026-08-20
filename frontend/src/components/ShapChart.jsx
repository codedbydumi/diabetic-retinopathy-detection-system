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

// The backend returns shap_values in the fixed FEATURE_ORDER (23 features,
// including the 9 *_missing indicator flags — see main.py FEATURE_ORDER).
// For the UI we only show the substantive clinical features, ranked by
// absolute impact, mirroring what the PDF's matplotlib waterfall
// highlights as the "top" contributors — the *_missing flags carry
// negligible SHAP weight in practice (Chapter 3, SHAP summary findings)
// and add clutter here, so they are filtered out for readability.
function ShapChart({ shapValues, featureNames }) {
  if (!shapValues || !featureNames) return null;

  const data = featureNames
    .map((name, i) => ({ name, value: shapValues[i] }))
    .filter((d) => !d.name.endsWith('_missing'))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 10);

  return (
    <div>
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
            width={110}
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
      <p style={{ fontSize: 12, color: 'var(--gray)', margin: '8px 0 0' }}>
        Red bars increase risk, teal bars decrease it. Ranked by impact, top
        10 features shown.
      </p>
    </div>
  );
}

export default ShapChart;