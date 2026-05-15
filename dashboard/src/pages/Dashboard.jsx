import { useState } from "react";
import { supabase } from "../supabase";
import { useAttempts } from "../hooks/useAttempts";
import { useFriendships } from "../hooks/useFriendships";
import { dailyActivity, heatmapData, summary, streaks } from "../utils/stats";
import StatsBar from "../components/StatsBar";
import ActivityChart from "../components/ActivityChart";
import Heatmap from "../components/Heatmap";
import RecentList from "../components/RecentList";
import Tabs from "../components/Tabs";
import Friends from "./Friends";

export default function Dashboard({ session }) {
  const [tab, setTab] = useState("overview");
  const { data, loading, error } = useAttempts();
  // Shared friendship state: powers both the tab badge and the Friends page,
  // so accepting a request immediately clears the badge.
  const friendships = useFriendships(session.user.id);

  if (loading) return <div className="page-pad muted">Loading…</div>;
  if (error) return <div className="page-pad error">Failed to load: {error.message}</div>;

  const attempts = data || [];
  const sum = summary(attempts);
  const strk = streaks(attempts);

  return (
    <div className="dashboard">
      <header className="topbar">
        <div className="brand">LeetCode Tracker</div>
        <div className="account">
          <span className="muted">{session.user.email}</span>
          <button className="link" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </header>

      <Tabs
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "friends", label: "Friends", badge: friendships.incoming.length || null },
        ]}
        active={tab}
        onChange={setTab}
      />

      <main className="page-pad">
        {tab === "overview" && (
          <>
            <StatsBar summary={sum} streaks={strk} />
            <ActivityChart series={[{ name: "You", color: "#ffa116", data: dailyActivity(attempts, 30) }]} />
            <Heatmap data={heatmapData(attempts, 120)} />
            <RecentList attempts={attempts} />
          </>
        )}
        {tab === "friends" && (
          <Friends session={session} myAttempts={attempts} friendships={friendships} />
        )}
      </main>
    </div>
  );
}
