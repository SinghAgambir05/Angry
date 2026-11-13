import { useState } from "react";
import { api } from "../api";
import type { Agent, Snapshot, TaskStatus } from "../types";

const COLUMNS: TaskStatus[] = ["backlog", "assigned", "in_progress", "review", "done", "blocked"];

type Props = {
  data: Snapshot;
  agentMap: Map<string, Agent>;
  actingAs: string;
};

export function TasksView({ data, agentMap, actingAs }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("code");
  const [assigneeId, setAssigneeId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deliverable, setDeliverable] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = data.tasks.find((t) => t.id === selectedId);

  async function createTask() {
    if (!title.trim()) return;
    setBusy(true);
    try {
      await api.createTask({
        title: title.trim(),
        description,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        assigneeId: assigneeId || null,
        status: assigneeId ? "assigned" : "backlog",
        priority: 3,
        deliverable: "",
      });
      setTitle("");
      setDescription("");
    } finally {
      setBusy(false);
    }
  }

  async function move(id: string, status: TaskStatus) {
    await api.patchTask(id, { status });
  }

  async function assign(id: string, agentId: string) {
    await api.patchTask(id, { assigneeId: agentId || null, status: agentId ? "assigned" : "backlog" });
  }

  async function saveDeliverable() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patchTask(selected.id, { deliverable, status: deliverable.trim() ? selected.status : selected.status });
    } finally {
      setBusy(false);
    }
  }

  async function distribute(strategy: string) {
    setBusy(true);
    try {
      await api.distribute(strategy);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack rise">
      <div className="panel row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0 }}>Task weaver</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            Distribute work across agents, then fold deliverables into a compile.
          </p>
        </div>
        <div className="row">
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => distribute("by_capability")}>
            Auto-assign by skill
          </button>
          <button className="btn btn-ghost btn-small" disabled={busy} onClick={() => distribute("load")}>
            Balance load
          </button>
        </div>
      </div>

      <div className="kanban">
        {COLUMNS.map((col) => (
          <div key={col} className="column">
            <h4>
              {col.replace("_", " ")} ({data.tasks.filter((t) => t.status === col).length})
            </h4>
            {data.tasks
              .filter((t) => t.status === col)
              .map((t) => (
                <button
                  key={t.id}
                  className="task-card"
                  style={{
                    width: "100%",
                    textAlign: "left",
                    color: "inherit",
                    outline: selectedId === t.id ? "1px solid var(--teal)" : undefined,
                  }}
                  onClick={() => {
                    setSelectedId(t.id);
                    setDeliverable(t.deliverable);
                  }}
                >
                  <strong>{t.title}</strong>
                  <div className="muted" style={{ fontSize: "0.75rem" }}>
                    {t.assigneeId ? agentMap.get(t.assigneeId)?.name : "Unassigned"} · P{t.priority}
                  </div>
                  <div className="row">
                    {t.tags.map((tag) => (
                      <span key={tag} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h3>New task</h3>
          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="field">
            <label>Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </div>
          <div className="field">
            <label>Assignee</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Backlog</option>
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy} onClick={createTask}>
            Create task
          </button>
        </div>

        <div className="panel stack">
          <h3>Task detail {selected ? `· acting as ${agentMap.get(actingAs)?.name}` : ""}</h3>
          {!selected ? (
            <p className="muted">Select a task card to update status, owner, or deliverable.</p>
          ) : (
            <>
              <strong>{selected.title}</strong>
              <p className="muted">{selected.description}</p>
              <div className="field">
                <label>Status</label>
                <select value={selected.status} onChange={(e) => move(selected.id, e.target.value as TaskStatus)}>
                  {COLUMNS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Assignee</label>
                <select
                  value={selected.assigneeId || ""}
                  onChange={(e) => assign(selected.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {data.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Deliverable (what this agent produced)</label>
                <textarea value={deliverable} onChange={(e) => setDeliverable(e.target.value)} style={{ minHeight: 140 }} />
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={saveDeliverable}>
                Save deliverable
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
