import {
  Boxes,
  Cable,
  LayoutDashboard,
  MessagesSquare,
  Merge,
  Radio,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNexus } from "../useNexus";
import type { ViewId } from "../types";
import { Overview } from "./Overview";
import { BusView } from "./BusView";
import { VaultView } from "./VaultView";
import { TasksView } from "./TasksView";
import { CompileView } from "./CompileView";
import { BridgeView } from "./BridgeView";

const NAV: { id: ViewId; label: string; icon: typeof Radio }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "bus", label: "Mission bus", icon: MessagesSquare },
  { id: "vault", label: "Context vault", icon: Boxes },
  { id: "tasks", label: "Task weaver", icon: Radio },
  { id: "compile", label: "Compile forge", icon: Merge },
  { id: "bridge", label: "Windows bridge", icon: Cable },
];

type Props = { onLeave: () => void };

export function MissionControl({ onLeave }: Props) {
  const { data, connected, error } = useNexus();
  const [view, setView] = useState<ViewId>("overview");
  const [actingAs, setActingAs] = useState("agent-orchestrator");

  const agentMap = useMemo(() => new Map(data.agents.map((a) => [a.id, a])), [data.agents]);
  const mission = data.missions.find((m) => m.status === "active") || data.missions[0];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-mark">
          <img src="/nexus.svg" alt="" />
          <span>Agent Nexus</span>
        </div>
        <nav className="nav-list">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${view === id ? "active" : ""}`}
              onClick={() => setView(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="stack" style={{ marginTop: "auto" }}>
          <div className="field">
            <label>Acting as</label>
            <select value={actingAs} onChange={(e) => setActingAs(e.target.value)}>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-ghost btn-small" onClick={onLeave}>
            Back to landing
          </button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Mission control
            </div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", margin: "4px 0 0" }}>
              {mission?.title || "No active mission"}
            </h1>
          </div>
          <div className="status-pill">
            <span className={`status-dot ${connected ? "on" : ""}`} />
            {connected ? "Bus live" : "Reconnecting…"}
          </div>
        </div>

        {error && <div className="error-banner">API error: {error}. Is the Nexus server running on :8787?</div>}

        {view === "overview" && <Overview data={data} agentMap={agentMap} setView={setView} />}
        {view === "bus" && <BusView data={data} agentMap={agentMap} actingAs={actingAs} />}
        {view === "vault" && <VaultView data={data} agentMap={agentMap} actingAs={actingAs} />}
        {view === "tasks" && <TasksView data={data} agentMap={agentMap} actingAs={actingAs} />}
        {view === "compile" && <CompileView data={data} agentMap={agentMap} />}
        {view === "bridge" && <BridgeView data={data} actingAs={actingAs} />}
      </main>
    </div>
  );
}
