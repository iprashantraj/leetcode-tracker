import { format, parseISO } from "date-fns";
import { fmtDuration } from "../utils/stats";

export default function RecentList({ attempts, limit = 20 }) {
  if (!attempts?.length) {
    return (
      <div className="card">
        <div className="card-header">Recent attempts</div>
        <div className="muted" style={{ padding: 12 }}>No attempts yet — open a LeetCode problem with the extension installed.</div>
      </div>
    );
  }
  const rows = attempts.slice(0, limit);

  return (
    <div className="card">
      <div className="card-header">Recent attempts</div>
      <table className="recent-table">
        <thead>
          <tr>
            <th>Problem</th>
            <th>Started</th>
            <th>Time</th>
            <th>Runs</th>
            <th>Submits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => (
            <tr key={a.id}>
              <td className="problem">{a.problem_title || a.problem_slug}</td>
              <td className="muted">{format(parseISO(a.started_at), "MMM d, HH:mm")}</td>
              <td className="num">{fmtDuration(a.active_seconds)}</td>
              <td className="num">{a.run_count}</td>
              <td className="num">{a.submit_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
