import cors from "cors";
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { Bus } from "./bus.js";
import { buildHandoffPacket, buildMergedOutput } from "./compile.js";
import { seedIfEmpty } from "./seed.js";
import { Store } from "./store.js";
import type { Agent, MessageKind, TaskStatus } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);

const store = new Store();
seedIfEmpty(store);
const bus = new Bus();

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "agent-nexus", time: new Date().toISOString() });
});

app.get("/api/snapshot", (_req, res) => {
  res.json(store.snapshot());
});

// —— Agents ——
app.get("/api/agents", (_req, res) => res.json(store.listAgents()));

app.post("/api/agents", (req, res) => {
  const agent = store.upsertAgent(req.body);
  bus.broadcast({ type: "agent.updated", payload: agent });
  res.status(201).json(agent);
});

app.patch("/api/agents/:id", (req, res) => {
  const existing = store.getAgent(req.params.id);
  if (!existing) return res.status(404).json({ error: "Agent not found" });
  const agent = store.upsertAgent({ ...existing, ...req.body, id: existing.id });
  bus.broadcast({ type: "agent.updated", payload: agent });
  res.json(agent);
});

app.post("/api/agents/:id/heartbeat", (req, res) => {
  const existing = store.getAgent(req.params.id);
  if (!existing) return res.status(404).json({ error: "Agent not found" });
  const agent = store.upsertAgent({
    ...existing,
    status: (req.body.status as Agent["status"]) || "online",
    lastSeen: new Date().toISOString(),
  });
  bus.broadcast({ type: "agent.updated", payload: agent });
  res.json(agent);
});

// —— Context vault ——
app.get("/api/contexts", (_req, res) => res.json(store.listContexts()));

app.get("/api/contexts/:id/versions", (req, res) => {
  res.json(store.listContextVersions(req.params.id));
});

app.post("/api/contexts", (req, res) => {
  const { key, title, content, tags, updatedBy, pinned } = req.body;
  if (!key || !title || content === undefined || !updatedBy) {
    return res.status(400).json({ error: "key, title, content, updatedBy required" });
  }
  const entry = store.upsertContext({ key, title, content, tags, updatedBy, pinned });
  bus.broadcast({ type: "context.updated", payload: entry });
  const msg = store.createMessage({
    channelId: "channel-mission",
    fromAgentId: updatedBy,
    toAgentId: null,
    kind: "context_update",
    body: `Updated context \`${key}\` → v${entry.version}: ${title}`,
    meta: { contextId: entry.id, version: entry.version },
  });
  bus.broadcast({ type: "message.created", payload: msg });
  res.status(201).json(entry);
});

app.patch("/api/contexts/:id", (req, res) => {
  const existing = store.getContext(req.params.id);
  if (!existing) return res.status(404).json({ error: "Context not found" });
  const entry = store.upsertContext({
    id: existing.id,
    key: req.body.key ?? existing.key,
    title: req.body.title ?? existing.title,
    content: req.body.content ?? existing.content,
    tags: req.body.tags ?? existing.tags,
    updatedBy: req.body.updatedBy ?? "system",
    pinned: req.body.pinned ?? existing.pinned,
  });
  bus.broadcast({ type: "context.updated", payload: entry });
  res.json(entry);
});

// —— Channels / messages ——
app.get("/api/channels", (_req, res) => res.json(store.listChannels()));

app.get("/api/messages", (req, res) => {
  const channelId = typeof req.query.channelId === "string" ? req.query.channelId : undefined;
  res.json(store.listMessages(channelId));
});

app.post("/api/messages", (req, res) => {
  const { channelId, fromAgentId, toAgentId, kind, body, meta } = req.body;
  if (!channelId || !fromAgentId || !body) {
    return res.status(400).json({ error: "channelId, fromAgentId, body required" });
  }
  const message = store.createMessage({
    channelId,
    fromAgentId,
    toAgentId: toAgentId ?? null,
    kind: (kind as MessageKind) || "chat",
    body,
    meta: meta ?? {},
  });
  const agent = store.getAgent(fromAgentId);
  if (agent) {
    const updated = store.upsertAgent({ ...agent, lastSeen: new Date().toISOString(), status: agent.status === "offline" ? "online" : agent.status });
    bus.broadcast({ type: "agent.updated", payload: updated });
  }
  bus.broadcast({ type: "message.created", payload: message });
  res.status(201).json(message);
});

// —— Tasks ——
app.get("/api/tasks", (_req, res) => res.json(store.listTasks()));

app.post("/api/tasks", (req, res) => {
  const task = store.upsertTask(req.body);
  if (task.assigneeId) {
    const agent = store.getAgent(task.assigneeId);
    if (agent) {
      const updated = store.upsertAgent({
        ...agent,
        currentTaskId: task.id,
        status: "busy",
        lastSeen: new Date().toISOString(),
      });
      bus.broadcast({ type: "agent.updated", payload: updated });
    }
  }
  bus.broadcast({ type: "task.updated", payload: task });
  res.status(201).json(task);
});

app.patch("/api/tasks/:id", (req, res) => {
  const existing = store.getTask(req.params.id);
  if (!existing) return res.status(404).json({ error: "Task not found" });
  const task = store.upsertTask({ ...existing, ...req.body, id: existing.id });
  bus.broadcast({ type: "task.updated", payload: task });

  if (req.body.status) {
    const msg = store.createMessage({
      channelId: "channel-mission",
      fromAgentId: task.assigneeId || "agent-orchestrator",
      toAgentId: null,
      kind: "task_update",
      body: `Task "${task.title}" → ${task.status}`,
      meta: { taskId: task.id, status: task.status },
    });
    bus.broadcast({ type: "message.created", payload: msg });
  }
  res.json(task);
});

app.post("/api/tasks/distribute", (req, res) => {
  const { strategy } = req.body as { strategy?: "by_capability" | "round_robin" | "load" };
  const tasks = store.listTasks().filter((t) => t.status === "backlog" || !t.assigneeId);
  const agents = store.listAgents().filter((a) => a.kind !== "custom" || a.id === "agent-orchestrator");
  const workers = agents.filter((a) => a.id !== "agent-orchestrator");
  const updated = [];

  for (const task of tasks) {
    let assignee = workers[0];
    if (strategy === "by_capability" || !strategy) {
      const tag = task.tags[0]?.toLowerCase();
      assignee =
        workers.find((a) =>
          a.capabilities.some((c) => c.toLowerCase().includes(tag || "") || (tag || "").includes(c.toLowerCase()))
        ) ||
        workers.find((a) => {
          if (task.tags.includes("code") || task.tags.includes("git")) return a.kind === "cursor";
          if (task.tags.includes("review") || task.tags.includes("architecture")) return a.kind === "claude";
          if (task.tags.includes("research") || task.tags.includes("draft")) return a.kind === "chatgpt";
          if (task.tags.includes("bridge") || task.tags.includes("explore")) return a.kind === "antigravity";
          return false;
        }) ||
        workers.sort((a, b) => loadOf(a.id) - loadOf(b.id))[0];
    } else if (strategy === "load") {
      assignee = [...workers].sort((a, b) => loadOf(a.id) - loadOf(b.id))[0];
    } else {
      const idx = updated.length % workers.length;
      assignee = workers[idx];
    }

    const taskNext = store.upsertTask({
      ...task,
      assigneeId: assignee.id,
      status: "assigned" as TaskStatus,
    });
    const agent = store.upsertAgent({
      ...assignee,
      currentTaskId: taskNext.id,
      status: "busy",
      lastSeen: new Date().toISOString(),
    });
    bus.broadcast({ type: "task.updated", payload: taskNext });
    bus.broadcast({ type: "agent.updated", payload: agent });
    updated.push(taskNext);
  }

  const msg = store.createMessage({
    channelId: "channel-mission",
    fromAgentId: "agent-orchestrator",
    toAgentId: null,
    kind: "system",
    body: `Distributed ${updated.length} task(s) via ${strategy || "by_capability"}.`,
    meta: { taskIds: updated.map((t) => t.id) },
  });
  bus.broadcast({ type: "message.created", payload: msg });
  res.json({ distributed: updated });

  function loadOf(agentId: string) {
    return store.listTasks().filter((t) => t.assigneeId === agentId && t.status !== "done").length;
  }
});

// —— Compilations ——
app.get("/api/compilations", (_req, res) => res.json(store.listCompilations()));

app.post("/api/compilations", (req, res) => {
  const { title, goal, taskIds } = req.body;
  if (!title || !goal) return res.status(400).json({ error: "title and goal required" });
  const tasks = store.listTasks().filter((t) => !taskIds || taskIds.includes(t.id));
  const { mergedOutput, contributions } = buildMergedOutput({
    title,
    goal,
    tasks,
    agents: store.listAgents(),
    contexts: store.listContexts(),
  });
  const compilation = store.upsertCompilation({
    title,
    goal,
    taskIds: tasks.map((t) => t.id),
    contributions,
    mergedOutput,
    status: "ready",
  });
  bus.broadcast({ type: "compilation.updated", payload: compilation });
  const msg = store.createMessage({
    channelId: "channel-mission",
    fromAgentId: "agent-orchestrator",
    toAgentId: null,
    kind: "system",
    body: `Compiled "${title}" — ready for review.`,
    meta: { compilationId: compilation.id },
  });
  bus.broadcast({ type: "message.created", payload: msg });
  res.status(201).json(compilation);
});

app.post("/api/compilations/:id/refresh", (req, res) => {
  const existing = store.getCompilation(req.params.id);
  if (!existing) return res.status(404).json({ error: "Compilation not found" });
  const tasks = store.listTasks().filter((t) => existing.taskIds.includes(t.id));
  const { mergedOutput, contributions } = buildMergedOutput({
    title: existing.title,
    goal: existing.goal,
    tasks: tasks.length ? tasks : store.listTasks(),
    agents: store.listAgents(),
    contexts: store.listContexts(),
  });
  const compilation = store.upsertCompilation({
    ...existing,
    contributions,
    mergedOutput,
    status: "ready",
  });
  bus.broadcast({ type: "compilation.updated", payload: compilation });
  res.json(compilation);
});

// —— Missions ——
app.get("/api/missions", (_req, res) => res.json(store.listMissions()));

app.post("/api/missions", (req, res) => {
  const mission = store.upsertMission(req.body);
  bus.broadcast({ type: "mission.updated", payload: mission });
  res.status(201).json(mission);
});

// —— Handoff packets (paste into desktop agents) ——
app.get("/api/handoff/:agentId", (req, res) => {
  const agent = store.getAgent(req.params.agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const missions = store.listMissions().filter((m) => m.status === "active");
  const agents = store.listAgents();
  const packet = buildHandoffPacket({
    agent,
    contexts: store.listContexts(),
    tasks: store.listTasks(),
    recentMessages: store.listMessages("channel-mission", 20).map((m) => ({
      from: agents.find((a) => a.id === m.fromAgentId)?.name || m.fromAgentId,
      body: m.body,
      createdAt: m.createdAt,
    })),
    missionGoal: missions[0]?.goal,
  });
  res.type("text/markdown").send(packet);
});

app.get("/api/handoff/:agentId.json", (req, res) => {
  const agent = store.getAgent(req.params.agentId);
  if (!agent) return res.status(404).json({ error: "Agent not found" });
  const missions = store.listMissions().filter((m) => m.status === "active");
  const agents = store.listAgents();
  const packet = buildHandoffPacket({
    agent,
    contexts: store.listContexts(),
    tasks: store.listTasks(),
    recentMessages: store.listMessages("channel-mission", 20).map((m) => ({
      from: agents.find((a) => a.id === m.fromAgentId)?.name || m.fromAgentId,
      body: m.body,
      createdAt: m.createdAt,
    })),
    missionGoal: missions[0]?.goal,
  });
  res.json({ agentId: agent.id, packet, generatedAt: new Date().toISOString() });
});

// —— Bridge ingest (file drop / PowerShell) ——
app.post("/api/bridge/ingest", (req, res) => {
  const { agentId, kind, body, contextKey, contextTitle, taskId, deliverable, status } = req.body;
  if (!agentId || !body) return res.status(400).json({ error: "agentId and body required" });
  const agent = store.getAgent(agentId);
  if (!agent) return res.status(404).json({ error: "Unknown agentId" });

  const message = store.createMessage({
    channelId: kind === "handoff" ? "channel-handoffs" : "channel-mission",
    fromAgentId: agentId,
    toAgentId: null,
    kind: kind || "chat",
    body,
    meta: { source: "bridge" },
  });
  bus.broadcast({ type: "message.created", payload: message });

  let context = null;
  if (contextKey) {
    context = store.upsertContext({
      key: contextKey,
      title: contextTitle || contextKey,
      content: body,
      updatedBy: agentId,
      tags: ["bridge"],
    });
    bus.broadcast({ type: "context.updated", payload: context });
  }

  let task = null;
  if (taskId) {
    const existing = store.getTask(taskId);
    if (existing) {
      task = store.upsertTask({
        ...existing,
        deliverable: deliverable ?? existing.deliverable,
        status: status ?? existing.status,
      });
      bus.broadcast({ type: "task.updated", payload: task });
    }
  }

  const updatedAgent = store.upsertAgent({
    ...agent,
    lastSeen: new Date().toISOString(),
    status: "online",
  });
  bus.broadcast({ type: "agent.updated", payload: updatedAgent });

  res.json({ ok: true, message, context, task });
});

// Static client in production
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
  res.sendFile(path.join(clientDist, "index.html"), (err) => {
    if (err) next();
  });
});

const server = createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  bus.add(ws);
  ws.send(JSON.stringify({ type: "snapshot", payload: store.snapshot() }));
  ws.on("message", (raw) => {
    try {
      const data = JSON.parse(String(raw));
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", t: Date.now() }));
      }
    } catch {
      /* ignore */
    }
  });
});

server.listen(PORT, () => {
  console.log(`Agent Nexus listening on http://localhost:${PORT}`);
  console.log(`WebSocket bus at ws://localhost:${PORT}/ws`);
});
