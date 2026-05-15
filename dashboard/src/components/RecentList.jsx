import { useState } from "react";
import { format, parseISO } from "date-fns";
import { fmtDuration } from "../utils/stats";
import EventTimeline from "./EventTimeline";

export default function RecentList({ attempts, limit = 20 }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!attempts?.length) {
    return (
      <div className="card">
        <div className="card-header">Recent attempts</div>
        <div className="muted" style={{ padding: 12 }}>
          No attempts yet — open a LeetCode problem with the extension installed.
        </div>
      </div>
    );
  }
  const rows = attempts.slice(0, limit);

  return (
    <div className="card">
      <div className="card-header">Recent attempts <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>(click a row to expand)</span></div>
      <table className="recent-table">
        <thead>
          <tr>
            <th></th>
            <th>Problem</th>
            <th>Started</th>
            <th>Time</th>
            <th className="num">Runs</th>
            <th className="num">Submits</th>
            <th className="num">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(a => {
            const open = expandedId === a.id;
            return (
              <RowFragment
                key={a.id}
                attempt={a}
                open={open}
                onToggle={() => setExpandedId(open ? null : a.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowFragment({ attempt: a, open, onToggle }) {
  const statusLabel = a.solved ? "Solved" : (a.submit_count > 0 ? "Failed" : "—");
  const statusClass = a.solved ? "tag-easy" : (a.submit_count > 0 ? "tag-hard" : "muted");
  return (
    <>
      <tr className="row-clickable" onClick={onToggle}>
        <td className="caret">{open ? "▾" : "▸"}</td>
        <td className="problem">{a.problem_title || a.problem_slug}</td>
        <td className="muted">{format(parseISO(a.started_at), "MMM d, HH:mm")}</td>
        <td>{fmtDuration(a.active_seconds)}</td>
        <td className="num">{a.run_count}</td>
        <td className="num">{a.submit_count}</td>
        <td className="num"><span className={statusClass}>{statusLabel}</span></td>
      </tr>
      {open && (
        <tr className="timeline-row">
          <td></td>
          <td colSpan={6}>
            <EventTimeline attemptId={a.id} enabled={open} />
          </td>
        </tr>
      )}
    </>
  );
}
