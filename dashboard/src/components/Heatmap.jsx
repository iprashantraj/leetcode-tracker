import { format, parseISO, getDay, startOfWeek } from "date-fns";
import { fmtDuration } from "../utils/stats";

// GitHub-style contribution grid.
// data: [{ date: "YYYY-MM-DD", activeSeconds }] — must be a contiguous date range.
export default function Heatmap({ data }) {
  if (!data?.length) return null;

  // Bucket into weeks. Each column is a week (Sun..Sat). Rows are days of week.
  // We pad the start so the first column lines up with the day-of-week of the first date.
  const first = parseISO(data[0].date);
  const weekStart = startOfWeek(first, { weekStartsOn: 0 });
  const leadingPad = Math.round((first - weekStart) / 86400000); // days of pad

  const cells = [...Array(leadingPad).fill(null), ...data];
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  // Color scale based on minutes spent (LeetCode green ramp on dark bg).
  const colorFor = (sec) => {
    const m = (sec || 0) / 60;
    if (m === 0) return "#2a2a2a";
    if (m < 5) return "#0e4429";
    if (m < 15) return "#006d32";
    if (m < 45) return "#26a641";
    if (m < 90) return "#39d353";
    return "#46f463";
  };

  return (
    <div className="card">
      <div className="card-header">Activity heatmap (last {data.length} days)</div>
      <div className="heatmap">
        <div className="heatmap-grid">
          {weeks.map((week, wi) => (
            <div key={wi} className="heatmap-col">
              {Array.from({ length: 7 }).map((_, di) => {
                const cell = week[di];
                if (!cell) return <div key={di} className="heatmap-cell empty" />;
                return (
                  <div
                    key={di}
                    className="heatmap-cell"
                    style={{ background: colorFor(cell.activeSeconds) }}
                    title={`${format(parseISO(cell.date), "EEE, MMM d")} — ${fmtDuration(cell.activeSeconds)}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="heatmap-legend">
          <span>Less</span>
          {["#2a2a2a", "#0e4429", "#006d32", "#26a641", "#39d353", "#46f463"].map((c, i) => (
            <span key={i} className="heatmap-cell" style={{ background: c, width: 10, height: 10 }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
