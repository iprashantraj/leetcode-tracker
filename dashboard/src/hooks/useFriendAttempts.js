import { useEffect, useState } from "react";
import { supabase } from "../supabase";

// Loads attempts for a list of user IDs. RLS ensures we only see the rows
// we're actually allowed to (i.e. accepted-friend or public profiles).
// Returns { byUser: Map<userId, attempts[]>, loading, error }.
export function useFriendAttempts(userIds) {
  const [byUser, setByUser] = useState(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const key = (userIds || []).slice().sort().join(",");

  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setByUser(new Map());
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    supabase
      .from("attempts")
      .select("id, user_id, problem_slug, problem_title, started_at, active_seconds, run_count, submit_count, solved")
      .in("user_id", userIds)
      .order("started_at", { ascending: false })
      .limit(2000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setError(error); setLoading(false); return; }
        const m = new Map();
        for (const a of data || []) {
          if (!m.has(a.user_id)) m.set(a.user_id, []);
          m.get(a.user_id).push(a);
        }
        setByUser(m);
        setError(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { byUser, loading, error };
}
