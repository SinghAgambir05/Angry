import type { Agent, Compilation, ContextEntry, Message, Mission, Snapshot, Task } from "./types";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return (await res.text()) as T;
}

export const api = {
  snapshot: () => req<Snapshot>("/api/snapshot"),
  postMessage: (body: Partial<Message> & { channelId: string; fromAgentId: string; body: string }) =>
    req<Message>("/api/messages", { method: "POST", body: JSON.stringify(body) }),
  upsertContext: (body: {
    key: string;
    title: string;
    content: string;
    tags?: string[];
    updatedBy: string;
    pinned?: boolean;
  }) => req<ContextEntry>("/api/contexts", { method: "POST", body: JSON.stringify(body) }),
  patchContext: (id: string, body: Partial<ContextEntry> & { updatedBy?: string }) =>
    req<ContextEntry>(`/api/contexts/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createTask: (body: Partial<Task> & { title: string }) =>
    req<Task>("/api/tasks", { method: "POST", body: JSON.stringify(body) }),
  patchTask: (id: string, body: Partial<Task>) =>
    req<Task>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  distribute: (strategy: string) =>
    req<{ distributed: Task[] }>("/api/tasks/distribute", {
      method: "POST",
      body: JSON.stringify({ strategy }),
    }),
  compile: (body: { title: string; goal: string; taskIds?: string[] }) =>
    req<Compilation>("/api/compilations", { method: "POST", body: JSON.stringify(body) }),
  refreshCompile: (id: string) =>
    req<Compilation>(`/api/compilations/${id}/refresh`, { method: "POST", body: "{}" }),
  handoff: (agentId: string) => fetch(`/api/handoff/${agentId}`).then((r) => r.text()),
  patchAgent: (id: string, body: Partial<Agent>) =>
    req<Agent>(`/api/agents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  createMission: (body: Partial<Mission> & { title: string; goal: string }) =>
    req<Mission>("/api/missions", { method: "POST", body: JSON.stringify(body) }),
  bridgeIngest: (body: Record<string, unknown>) =>
    req("/api/bridge/ingest", { method: "POST", body: JSON.stringify(body) }),
};
