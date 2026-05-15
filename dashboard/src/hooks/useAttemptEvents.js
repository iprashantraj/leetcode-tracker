import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Fetches events for a single attempt id, ordered by occurred_at.
// Returns { events, loading, error }.
export function useAttemptEvents(attemptId, enabled = true) {
  const [events, setEvents] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !attemptId) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("events")
      .select("id, event_type, occurred_at, metadata")
      .eq("attempt_id", attemptId)
      .order("occurred_at", { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error);
        else setEvents(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [attemptId, enabled]);

  return { events, loading, error };
}
