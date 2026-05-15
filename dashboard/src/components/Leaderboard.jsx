import { useState } from "react";
import { fmtDuration, summary, streaks } from "../utils/stats";

const METRICS = [
  { key: "totalSeconds", label: "Time", render: v => fmtDuration(v) },
  { key: "problems", label: "Problems", render: v => v },
  { key: "totalSubmits", label: "Submits", render: v => v },
  { key: "currentStreak", label: "Current streak", render: v => `${v}d` },
];

export default function Leaderboard({ rows }) {
  const [metric, setMetric] = useState("totalSeconds");
  const m = METRICS.find(x => x.key === metric);

  const sorted = [...rows].sort((a, b) => (b[metric] || 0) - (a[metric] || 0));

  return (
    <div className="card">
      <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Leaderboard</span>
        <select className="select" value={metric} onChange={e => setMetric(e.target.value)}>
          {METRICS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
        </select>
      </div>
      <table className="recent-table">
        <thead>
          <tr>
            <th style={{ width: 30 }}>#</th>
            <th>Player</th>
            <th className="num">{m.label}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id}>
              <td className="muted">{i + 1}</td>
              <td className="problem">{r.label}{r.isMe ? <span className="muted"> (you)</span> : null}</td>
              <td className="num">{m.render(r[metric] || 0)}</td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr><td colSpan="3" className="muted" style={{ padding: 12 }}>No friends yet — add one to see the leaderboard.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Helper: build a row {id, label, isMe, totalSeconds, problems, totalSubmits, currentStreak}
export function rowFromAttempts(profile, attempts, isMe = false) {
  const s = summary(attempts);
  const st = streaks(attempts);
  return {
    id: profile.id,
    label: profile.display_name || profile.username || "user",
    isMe,
    totalSeconds: s.totalSeconds,
    problems: s.problems,
    totalSubmits: s.totalSubmits,
    currentStreak: st.current,
  };
}
