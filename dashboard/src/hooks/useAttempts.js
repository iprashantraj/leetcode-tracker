import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Loads all attempts for the current user, ordered by start time desc.
// Returns { data, loading, error, reload }.
export function useAttempts() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("attempts")
      .select("id, problem_slug, problem_title, started_at, ended_at, active_seconds, run_count, submit_count, solved, solved_at")
      .order("started_at", { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setError(error);
        else setData(data || []);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [version]);

  return { data, loading, error, reload: () => setVersion(v => v + 1) };
}
