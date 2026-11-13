import { useState } from "react";
import { api } from "../api";
import type { Agent, Snapshot } from "../types";

type Props = {
  data: Snapshot;
  agentMap: Map<string, Agent>;
};

export function CompileView({ data, agentMap }: Props) {
  const mission = data.missions.find((m) => m.status === "active") || data.missions[0];
  const [title, setTitle] = useState(mission ? `${mission.title} — compiled` : "Swarm compilation");
  const [goal, setGoal] = useState(mission?.goal || "");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const active = data.compilations.find((c) => c.id === activeId) || data.compilations[0];

  async function compile() {
    setBusy(true);
    try {
      const c = await api.compile({ title, goal });
      setActiveId(c.id);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    if (!active) return;
    setBusy(true);
    try {
      const c = await api.refreshCompile(active.id);
      setActiveId(c.id);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!active) return;
    await navigator.clipboard.writeText(active.mergedOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="grid-2 rise">
      <div className="panel stack">
        <h2>Compile forge</h2>
        <p className="muted">
          Pull done-task deliverables and pinned vault entries into one shared outcome the whole swarm can stand
          behind.
        </p>
        <div className="field">
          <label>Compilation title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Goal</label>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !title || !goal} onClick={compile}>
            {busy ? "Compiling…" : "Compile now"}
          </button>
          {active && (
            <button className="btn btn-ghost" disabled={busy} onClick={refresh}>
              Refresh from live tasks
            </button>
          )}
        </div>

        <h3>Past compilations</h3>
        <div className="stack">
          {data.compilations.length === 0 && <p className="muted">No compilations yet.</p>}
          {data.compilations.map((c) => (
            <button
              key={c.id}
              className="btn btn-ghost"
              style={{
                textAlign: "left",
                borderColor: active?.id === c.id ? "var(--teal)" : undefined,
              }}
              onClick={() => setActiveId(c.id)}
            >
              <div>
                <strong>{c.title}</strong>
                <div className="muted" style={{ fontSize: "0.78rem" }}>
                  {c.status} · {c.contributions.length} contributions · {new Date(c.updatedAt).toLocaleString()}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3 style={{ margin: 0 }}>Merged output</h3>
          {active && (
            <button className="btn btn-ghost btn-small" onClick={copy}>
              {copied ? "Copied" : "Copy markdown"}
            </button>
          )}
        </div>
        {!active ? (
          <p className="muted">Run a compile to assemble the swarm's best outcome.</p>
        ) : (
          <>
            <div className="row">
              {active.contributions.map((c, i) => (
                <span key={i} className="chip live">
                  {agentMap.get(c.agentId)?.name || c.agentId}
                </span>
              ))}
            </div>
            <div className="pre">{active.mergedOutput}</div>
          </>
        )}
      </div>
    </div>
  );
}
