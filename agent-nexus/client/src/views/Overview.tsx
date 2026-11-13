import type { Snapshot, ViewId, Agent } from "../types";

type Props = {
  data: Snapshot;
  agentMap: Map<string, Agent>;
  setView: (v: ViewId) => void;
};

export function Overview({ data, agentMap, setView }: Props) {
  const online = data.agents.filter((a) => a.status === "online" || a.status === "busy").length;
  const done = data.tasks.filter((t) => t.status === "done").length;
  const pinned = data.contexts.filter((c) => c.pinned).length;

  return (
    <>
      <div className="grid-3 rise">
        <div className="panel stat">
          <div className="muted">Agents awake</div>
          <div className="value">
            {online}/{data.agents.length}
          </div>
          <div className="muted">ChatGPT · Cursor · Claude · Antigravity</div>
        </div>
        <div className="panel stat">
          <div className="muted">Tasks complete</div>
          <div className="value">
            {done}/{data.tasks.length}
          </div>
          <button className="btn btn-ghost btn-small" onClick={() => setView("tasks")}>
            Open weaver
          </button>
        </div>
        <div className="panel stat">
          <div className="muted">Pinned context</div>
          <div className="value">{pinned}</div>
          <button className="btn btn-ghost btn-small" onClick={() => setView("vault")}>
            Open vault
          </button>
        </div>
      </div>

      <div className="grid-2 rise rise-delay-1">
        <div className="panel">
          <h2>Swarm roster</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Each agent keeps a heartbeat, role, and current assignment so work can move without losing thread.
          </p>
          <div className="grid-auto">
            {data.agents.map((a) => {
              const task = data.tasks.find((t) => t.id === a.currentTaskId);
              return (
                <div key={a.id} className="panel agent-card" style={{ background: "rgba(7,22,20,0.5)" }}>
                  <div className="agent-head">
                    <div className="avatar" style={{ background: a.color }}>
                      {a.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong>{a.name}</strong>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {a.kind}
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <span className={`chip ${a.status === "online" || a.status === "busy" ? "live" : ""}`}>
                      {a.status}
                    </span>
                    {a.capabilities.slice(0, 3).map((c) => (
                      <span key={c} className="chip">
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {task ? `Working: ${task.title}` : a.role}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel stack">
          <h2>Live pulse</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Latest bus traffic across the swarm.
          </p>
          <div className="message-list">
            {[...data.messages].slice(-8).reverse().map((m) => (
              <div key={m.id} className={`message ${m.kind}`}>
                <div className="meta">
                  {agentMap.get(m.fromAgentId)?.name || m.fromAgentId} · {m.kind} ·{" "}
                  {new Date(m.createdAt).toLocaleTimeString()}
                </div>
                <div>{m.body}</div>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-small" onClick={() => setView("bus")}>
            Join the bus
          </button>
        </div>
      </div>
    </>
  );
}
