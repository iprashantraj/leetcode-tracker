import { fmtDuration } from "../utils/stats";

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function StatsBar({ summary, streaks }) {
  return (
    <div className="stats-bar">
      <Stat label="Total time" value={fmtDuration(summary.totalSeconds)} />
      <Stat label="Solved" value={summary.solved || 0} />
      <Stat label="Problems" value={summary.problems} />
      <Stat label="Attempts" value={summary.attempts} />
      <Stat label="Submits" value={summary.totalSubmits} />
      <Stat label="Current streak" value={`${streaks.current}d`} />
      <Stat label="Longest streak" value={`${streaks.longest}d`} />
    </div>
  );
}
