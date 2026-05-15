import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { format, parseISO } from "date-fns";

// Comparison-ready chart. Accepts:
//   series: [{ name: "You", color: "#22c55e", data: [{date, activeSeconds}, ...] }, ...]
// Each series's `data` MUST be the same set of dates in the same order — caller
// is responsible for aligning the buckets.
export default function ActivityChart({ series }) {
  if (!series?.length || !series[0].data?.length) return null;

  // Merge by date so Recharts can render one line per series.
  const dates = series[0].data.map(d => d.date);
  const rows = dates.map((date, i) => {
    const row = { date };
    for (const s of series) row[s.name] = Math.round((s.data[i]?.activeSeconds || 0) / 60); // minutes
    return row;
  });

  return (
    <div className="card">
      <div className="card-header">Daily active time (last {dates.length} days)</div>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={rows} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid stroke="#eef0f3" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={d => format(parseISO(d), "MMM d")}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} unit="m" />
            <Tooltip
              labelFormatter={d => format(parseISO(d), "EEE, MMM d")}
              formatter={(v) => [`${v}m`, ""]}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map(s => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
