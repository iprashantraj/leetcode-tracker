import { useState } from "react";
import { supabase } from "../supabase";
import { useFriendAttempts } from "../hooks/useFriendAttempts";
import Leaderboard, { rowFromAttempts } from "../components/Leaderboard";
import ActivityChart from "../components/ActivityChart";
import { dailyActivity } from "../utils/stats";

const COLORS = ["#ffa116", "#00b8a3", "#3b82f6", "#a855f7", "#ef4743", "#ffc01e"];

function Section({ title, children }) {
  return (
    <div className="card">
      <div className="card-header">{title}</div>
      <div className="section-body">{children}</div>
    </div>
  );
}

function FriendCard({ profile, action, actionLabel, secondary, secondaryLabel }) {
  return (
    <div className="friend-row">
      <div>
        <div className="problem">{profile?.display_name || profile?.username || "user"}</div>
        <div className="muted" style={{ fontSize: 12 }}>@{profile?.username}</div>
      </div>
      <div className="friend-actions">
        {secondary && <button className="link" onClick={secondary}>{secondaryLabel}</button>}
        {action && <button className="primary" onClick={action}>{actionLabel}</button>}
      </div>
    </div>
  );
}

// Receives friendship state + actions from Dashboard so the badge and this
// page share a single source of truth.
export default function Friends({ session, myAttempts, friendships }) {
  const me = session.user;
  const myId = me.id;
  const { friends, incoming, outgoing, loading, actions } = friendships;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  async function search(e) {
    e?.preventDefault();
    setError("");
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .neq("id", myId)
      .limit(10);
    setSearching(false);
    if (error) { setError(error.message); return; }
    setResults(data || []);
  }

  async function add(otherId) {
    setError("");
    try { await actions.sendRequest(otherId); } catch (e) { setError(e.message); }
    setResults(rs => rs.filter(r => r.id !== otherId));
  }

  const friendIds = friends.map(f => f.profile.id);
  const { byUser } = useFriendAttempts(friendIds);

  const leaderboardRows = [
    rowFromAttempts({ id: myId, display_name: me.email, username: me.email?.split("@")[0] }, myAttempts, true),
    ...friends.map(f => rowFromAttempts(f.profile, byUser.get(f.profile.id) || [])),
  ];

  const series = [
    { name: "You", color: COLORS[0], data: dailyActivity(myAttempts, 30) },
    ...friends.map((f, i) => ({
      name: f.profile.display_name || f.profile.username || `friend ${i+1}`,
      color: COLORS[(i + 1) % COLORS.length],
      data: dailyActivity(byUser.get(f.profile.id) || [], 30),
    })),
  ];

  return (
    <>
      <Section title="Add a friend">
        <form onSubmit={search} className="search-row">
          <input
            type="text"
            placeholder="Search by username or name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="primary" disabled={searching}>
            {searching ? "…" : "Search"}
          </button>
        </form>
        {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
        {results.length > 0 && (
          <div className="search-results">
            {results.map(r => (
              <FriendCard
                key={r.id}
                profile={r}
                action={() => add(r.id)}
                actionLabel="Add"
              />
            ))}
          </div>
        )}
      </Section>

      {incoming.length > 0 && (
        <Section title={`Incoming requests (${incoming.length})`}>
          {incoming.map(r => (
            <FriendCard
              key={r.friendshipId}
              profile={r.profile}
              action={() => actions.accept(r.friendshipId)}
              actionLabel="Accept"
              secondary={() => actions.decline(r.friendshipId)}
              secondaryLabel="Decline"
            />
          ))}
        </Section>
      )}

      {outgoing.length > 0 && (
        <Section title={`Sent requests (${outgoing.length})`}>
          {outgoing.map(r => (
            <FriendCard
              key={r.friendshipId}
              profile={r.profile}
              secondary={() => actions.remove(r.friendshipId)}
              secondaryLabel="Cancel"
            />
          ))}
        </Section>
      )}

      <Section title={`Friends${loading ? " …" : ` (${friends.length})`}`}>
        {friends.length === 0 && !loading && (
          <div className="muted">No friends yet. Search above to add some.</div>
        )}
        {friends.map(f => (
          <FriendCard
            key={f.friendshipId}
            profile={f.profile}
            secondary={() => actions.remove(f.friendshipId)}
            secondaryLabel="Remove"
          />
        ))}
      </Section>

      {friends.length > 0 && <ActivityChart series={series} />}

      <Leaderboard rows={leaderboardRows} />
    </>
  );
}
