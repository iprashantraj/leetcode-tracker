import { useSession } from "./hooks/useSession";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import "./styles.css";

export default function App() {
  const session = useSession();
  if (session === undefined) return <div className="page-pad muted">…</div>;
  return session ? <Dashboard session={session} /> : <Auth />;
}
