import { useState } from "react";
import { api } from "../api";
import type { Agent, Snapshot } from "../types";

type Props = {
  data: Snapshot;
  agentMap: Map<string, Agent>;
  actingAs: string;
};

export function VaultView({ data, agentMap, actingAs }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [key, setKey] = useState("notes.working");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("working");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const selected = data.contexts.find((c) => c.id === selectedId) || data.contexts[0];

  async function save() {
    setSaving(true);
    try {
      await api.upsertContext({
        key: key.trim(),
        title: title.trim() || key.trim(),
        content,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        updatedBy: actingAs,
        pinned,
      });
      setContent("");
      setTitle("");
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(id: string, next: boolean) {
    await api.patchContext(id, { pinned: next, updatedBy: actingAs });
  }

  return (
    <div className="grid-2 rise">
      <div className="panel">
        <h2>Context vault</h2>
        <p className="muted">
          Durable shared memory. Every agent reads pinned keys before acting; updates are versioned so nothing is
          silently lost.
        </p>
        <div className="stack">
          {data.contexts.map((c) => (
            <button
              key={c.id}
              className="context-item"
              style={{
                textAlign: "left",
                background: selected?.id === c.id ? "rgba(20,184,166,0.08)" : "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
                borderRadius: 12,
                padding: "12px",
              }}
              onClick={() => {
                setSelectedId(c.id);
                setKey(c.key);
                setTitle(c.title);
                setContent(c.content);
                setTags(c.tags.join(", "));
                setPinned(c.pinned);
              }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{c.title}</strong>
                <span className={`chip ${c.pinned ? "warn" : ""}`}>{c.pinned ? "pinned" : `v${c.version}`}</span>
              </div>
              <div className="muted" style={{ fontSize: "0.8rem" }}>
                <code>{c.key}</code> · {agentMap.get(c.updatedBy)?.name || c.updatedBy} ·{" "}
                {new Date(c.updatedAt).toLocaleString()}
              </div>
              <div style={{ marginTop: 6, fontSize: "0.9rem" }}>{c.content.slice(0, 140)}{c.content.length > 140 ? "…" : ""}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="panel stack">
        <h3>{selected ? "Edit / write context" : "Write context"}</h3>
        <div className="field">
          <label>Key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="mission.brief" />
        </div>
        <div className="field">
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label>Tags (comma-separated)</label>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="field">
          <label>Content</label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ minHeight: 180 }} />
        </div>
        <label className="row muted" style={{ fontSize: "0.85rem" }}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
          Pin for all agents (included in handoffs & compilations)
        </label>
        <div className="row">
          <button className="btn btn-primary" disabled={saving || !key.trim() || !content.trim()} onClick={save}>
            {saving ? "Saving…" : "Save to vault"}
          </button>
          {selected && (
            <button className="btn btn-ghost" onClick={() => togglePin(selected.id, !selected.pinned)}>
              {selected.pinned ? "Unpin selected" : "Pin selected"}
            </button>
          )}
        </div>
        {selected && (
          <div className="pre" style={{ maxHeight: 200 }}>
            {selected.content}
          </div>
        )}
      </div>
    </div>
  );
}
