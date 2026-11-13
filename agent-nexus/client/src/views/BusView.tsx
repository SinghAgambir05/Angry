import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Agent, Snapshot } from "../types";

type Props = {
  data: Snapshot;
  agentMap: Map<string, Agent>;
  actingAs: string;
};

export function BusView({ data, agentMap, actingAs }: Props) {
  const [channelId, setChannelId] = useState("channel-mission");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState("chat");
  const [toAgentId, setToAgentId] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = data.messages.filter((m) => m.channelId === channelId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, channelId]);

  async function send() {
    if (!body.trim()) return;
    setSending(true);
    try {
      await api.postMessage({
        channelId,
        fromAgentId: actingAs,
        toAgentId: toAgentId || null,
        kind: kind as any,
        body: body.trim(),
      });
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid-2 rise">
      <div className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Mission bus</h2>
          <div className="tabs">
            {data.channels.map((c) => (
              <button
                key={c.id}
                className={`tab ${channelId === c.id ? "active" : ""}`}
                onClick={() => setChannelId(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          {data.channels.find((c) => c.id === channelId)?.purpose}
        </p>
        <div className="message-list" style={{ maxHeight: 480 }}>
          {messages.map((m) => {
            const from = agentMap.get(m.fromAgentId);
            const to = m.toAgentId ? agentMap.get(m.toAgentId) : null;
            return (
              <div key={m.id} className={`message ${m.kind}`}>
                <div className="meta">
                  <span style={{ color: from?.color || "#99f6e4" }}>{from?.name || m.fromAgentId}</span>
                  {to ? ` → ${to.name}` : " → all"} · {m.kind} · {new Date(m.createdAt).toLocaleString()}
                </div>
                <div>{m.body}</div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="panel stack">
        <h3>Post to the swarm</h3>
        <div className="field">
          <label>Message kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="chat">chat</option>
            <option value="handoff">handoff</option>
            <option value="status">status</option>
            <option value="context_update">context_update</option>
            <option value="task_update">task_update</option>
            <option value="system">system</option>
          </select>
        </div>
        <div className="field">
          <label>Direct to (optional)</label>
          <select value={toAgentId} onChange={(e) => setToAgentId(e.target.value)}>
            <option value="">Broadcast</option>
            {data.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Handoff notes, blockers, discoveries…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
          />
        </div>
        <button className="btn btn-primary" disabled={sending} onClick={send}>
          {sending ? "Sending…" : "Send message"}
        </button>
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          Tip: use kind <code>handoff</code> when transferring ownership so the next agent can resume without
          re-deriving state.
        </p>
      </div>
    </div>
  );
}
