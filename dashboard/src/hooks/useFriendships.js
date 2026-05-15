import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

// Loads friendships for the current user and exposes mutations.
// Returns:
//   friends:  [{ friendshipId, profile }]
//   incoming: [{ friendshipId, profile }]   // pending requests addressed to me
//   outgoing: [{ friendshipId, profile }]   // pending requests I sent
//   actions: { sendRequest, accept, decline, remove }
//   loading, error, reload
export function useFriendships(myId) {
  const [data, setData] = useState({ friends: [], incoming: [], outgoing: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(v => v + 1), []);

  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    setLoading(true);

    supabase
      .from("friendships")
      .select(`
        id, status, created_at, requester_id, addressee_id,
        requester:profiles!friendships_requester_id_fkey(id, username, display_name, avatar_url),
        addressee:profiles!friendships_addressee_id_fkey(id, username, display_name, avatar_url)
      `)
      .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`)
      .in("status", ["pending", "accepted"])
      .then(({ data: rows, error }) => {
        if (cancelled) return;
        if (error) { setError(error); setLoading(false); return; }
        const friends = [], incoming = [], outgoing = [];
        for (const r of rows || []) {
          const isMeReq = r.requester_id === myId;
          const other = isMeReq ? r.addressee : r.requester;
          const entry = { friendshipId: r.id, profile: other };
          if (r.status === "accepted") friends.push(entry);
          else if (isMeReq) outgoing.push(entry);
          else incoming.push(entry);
        }
        setData({ friends, incoming, outgoing });
        setError(null);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [myId, version]);

  const sendRequest = useCallback(async (otherId) => {
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: myId, addressee_id: otherId, status: "pending" });
    if (error) throw error;
    reload();
  }, [myId, reload]);

  const accept = useCallback(async (friendshipId) => {
    const { error } = await supabase
      .from("friendships")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", friendshipId);
    if (error) throw error;
    reload();
  }, [reload]);

  const decline = useCallback(async (friendshipId) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
    reload();
  }, [reload]);

  const remove = useCallback(async (friendshipId) => {
    const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
    if (error) throw error;
    reload();
  }, [reload]);

  return { ...data, loading, error, reload, actions: { sendRequest, accept, decline, remove } };
}
