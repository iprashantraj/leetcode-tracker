import { format, parseISO } from "date-fns";
import { useAttemptEvents } from "../hooks/useAttemptEvents";

const ICON = {
  run: "▶",
  submit: "↑",
  run_accepted: "▶",
  run_rejected: "▶",
  submit_accepted: "↑",
  submit_rejected: "↑",
};

function classify(type) {
  if (type.endsWith("_accepted")) return "accepted";
  if (type.endsWith("_rejected")) return "rejected";
  return "neutral";
}

function label(ev) {
  const verdict = ev.metadata?.verdict;
  switch (ev.event_type) {
    case "run": return "Ran";
    case "submit": return "Submitted";
    case "run_accepted": return verdict || "Accepted";
    case "run_rejected": return verdict || "Wrong";
    case "submit_accepted": return verdict || "Accepted";
    case "submit_rejected": return verdict || "Wrong";
    default: return ev.event_type;
  }
}

export default function EventTimeline({ attemptId, enabled }) {
  const { events, loading, error } = useAttemptEvents(attemptId, enabled);
  if (!enabled) return null;
  if (loading) return <div className="timeline-empty muted">Loading events…</div>;
  if (error) return <div className="timeline-empty error">Failed: {error.message}</div>;
  if (!events?.length) return <div className="timeline-empty muted">No events recorded for this attempt. (Older attempts predate event logging.)</div>;

  return (
    <ol className="timeline">
      {events.map(ev => {
        const kind = ev.event_type.startsWith("run") ? "run" : "submit";
        const cls = classify(ev.event_type);
        return (
          <li key={ev.id} className={`timeline-item ${cls}`}>
            <span className={`timeline-icon ${kind}`}>{ICON[ev.event_type] || "·"}</span>
            <span className="timeline-time">{format(parseISO(ev.occurred_at), "HH:mm:ss")}</span>
            <span className="timeline-label">{label(ev)}</span>
          </li>
        );
      })}
    </ol>
  );
}
