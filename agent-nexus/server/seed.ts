import { Store } from "./store.js";

const AGENT_IDS = {
  chatgpt: "agent-chatgpt",
  cursor: "agent-cursor",
  claude: "agent-claude",
  antigravity: "agent-antigravity",
  orchestrator: "agent-orchestrator",
};

export function seedIfEmpty(store: Store) {
  if (!store.isEmpty()) return;

  const agents = [
    store.upsertAgent({
      id: AGENT_IDS.orchestrator,
      name: "Nexus Orchestrator",
      kind: "custom",
      status: "online",
      role: "Mission lead — distributes work and compiles outcomes",
      capabilities: ["plan", "assign", "compile", "mediate"],
      color: "#0f766e",
      notes: "Human-operated or rule-based conductor for the swarm.",
    }),
    store.upsertAgent({
      id: AGENT_IDS.chatgpt,
      name: "ChatGPT Desktop",
      kind: "chatgpt",
      status: "online",
      role: "Research, drafting, and broad ideation",
      capabilities: ["research", "draft", "summarize", "brainstorm"],
      color: "#10a37f",
      notes: "Paste handoff packets into ChatGPT Desktop; post replies back via Bridge.",
    }),
    store.upsertAgent({
      id: AGENT_IDS.cursor,
      name: "Cursor",
      kind: "cursor",
      status: "busy",
      role: "Implementation and codebase surgery",
      capabilities: ["code", "refactor", "tests", "git"],
      color: "#f59e0b",
      notes: "Best for repo-local edits; sync context via API or paste protocol.",
    }),
    store.upsertAgent({
      id: AGENT_IDS.claude,
      name: "Claude Desktop",
      kind: "claude",
      status: "online",
      role: "Deep reasoning, critique, and long-form synthesis",
      capabilities: ["reason", "critique", "longform", "architecture"],
      color: "#d97706",
      notes: "Strong reviewer — feed compilations for adversarial pass.",
    }),
    store.upsertAgent({
      id: AGENT_IDS.antigravity,
      name: "Antigravity",
      kind: "antigravity",
      status: "away",
      role: "Exploration, tooling, and experimental paths",
      capabilities: ["explore", "prototype", "tools", "automation"],
      color: "#0891b2",
      notes: "Use for spikes and alternate approaches; fold winners into compile.",
    }),
  ];

  const channel = store.upsertChannel({
    id: "channel-mission",
    name: "mission-bus",
    purpose: "Primary cross-agent coordination channel",
    memberIds: agents.map((a) => a.id),
  });

  store.upsertChannel({
    id: "channel-handoffs",
    name: "handoffs",
    purpose: "Structured handoff packets between agents",
    memberIds: agents.map((a) => a.id),
  });

  const mission = store.upsertMission({
    id: "mission-demo",
    title: "Ship a resilient multi-agent workflow",
    goal: "Design, implement, review, and compile a Windows-friendly collaboration loop so ChatGPT, Cursor, Claude, and Antigravity never lose shared progress.",
    status: "active",
  });

  store.upsertContext({
    key: "mission.brief",
    title: "Mission brief",
    content: mission.goal,
    tags: ["mission", "pinned"],
    updatedBy: AGENT_IDS.orchestrator,
    pinned: true,
  });

  store.upsertContext({
    key: "protocol.handoff",
    title: "Handoff protocol",
    content:
      "Every agent reads pinned context before acting. On finish: (1) write durable notes to a context key, (2) update task deliverable + status, (3) post a handoff message naming the next owner, (4) never overwrite others' keys without versioning intent.",
    tags: ["protocol"],
    updatedBy: AGENT_IDS.orchestrator,
    pinned: true,
  });

  store.upsertContext({
    key: "architecture.notes",
    title: "Architecture notes",
    content:
      "Agent Nexus = local Express API + WebSocket bus + SQLite vault + React mission control. Desktop agents join via paste bridge, file drop folder, or HTTP if available.",
    tags: ["architecture", "cursor"],
    updatedBy: AGENT_IDS.cursor,
    pinned: false,
  });

  store.upsertContext({
    key: "decisions.log",
    title: "Decision log",
    content:
      "D1: Shared SQLite vault is source of truth.\nD2: Compilations merge done-task deliverables + pinned context.\nD3: Agents stay loosely coupled — no vendor lock-in APIs required.",
    tags: ["decisions"],
    updatedBy: AGENT_IDS.claude,
    pinned: true,
  });

  const t1 = store.upsertTask({
    id: "task-research",
    title: "Map desktop agent constraints",
    description:
      "Document how ChatGPT Desktop, Claude Desktop, Cursor, and Antigravity can ingest/export context on Windows (clipboard, files, extensions, HTTP).",
    status: "done",
    assigneeId: AGENT_IDS.chatgpt,
    priority: 3,
    deliverable:
      "ChatGPT/Claude: clipboard + project files. Cursor: repo + MCP/HTTP. Antigravity: tooling hooks / file watchers. Common denominator: paste packets + watched folder.",
    tags: ["research"],
  });

  const t2 = store.upsertTask({
    id: "task-implement",
    title: "Implement Nexus vault + bus",
    description: "Stand up persistence, REST, WebSocket fan-out, and compile endpoint.",
    status: "in_progress",
    assigneeId: AGENT_IDS.cursor,
    priority: 5,
    deliverable: "Server store + API skeleton in progress.",
    tags: ["code"],
  });

  store.upsertTask({
    id: "task-review",
    title: "Adversarial review of collaboration loop",
    description: "Find failure modes: lost context, race overwrites, unclear ownership, weak compile quality.",
    status: "assigned",
    assigneeId: AGENT_IDS.claude,
    priority: 4,
    deliverable: "",
    tags: ["review"],
  });

  store.upsertTask({
    id: "task-spike",
    title: "Windows bridge spike",
    description: "Prototype PowerShell watcher that posts dropped .md handoffs into the bus.",
    status: "backlog",
    assigneeId: AGENT_IDS.antigravity,
    priority: 2,
    deliverable: "",
    tags: ["bridge", "windows"],
  });

  store.upsertTask({
    id: "task-compile",
    title: "Produce v1 compiled playbook",
    description: "Merge research + implementation + review into one operator playbook.",
    status: "backlog",
    assigneeId: AGENT_IDS.orchestrator,
    priority: 4,
    parentId: null,
    deliverable: "",
    tags: ["compile"],
  });

  store.createMessage({
    channelId: channel.id,
    fromAgentId: AGENT_IDS.orchestrator,
    toAgentId: null,
    kind: "system",
    body: "Mission bus online. Seeded demo swarm is live — claim tasks, keep the vault current, compile when slices land.",
    meta: { missionId: mission.id },
  });

  store.createMessage({
    channelId: channel.id,
    fromAgentId: AGENT_IDS.chatgpt,
    toAgentId: AGENT_IDS.cursor,
    kind: "handoff",
    body: "Research complete on Windows constraints. Cursor: prioritize HTTP + file-drop bridge; clipboard packets as fallback for ChatGPT/Claude.",
    meta: { taskId: t1.id },
  });

  store.createMessage({
    channelId: "channel-handoffs",
    fromAgentId: AGENT_IDS.cursor,
    toAgentId: AGENT_IDS.claude,
    kind: "status",
    body: `Implementing vault now (${t2.id}). Claude: queue architecture critique once compile draft exists.`,
    meta: {},
  });

  store.upsertAgent({
    ...store.getAgent(AGENT_IDS.cursor)!,
    currentTaskId: t2.id,
  });
  store.upsertAgent({
    ...store.getAgent(AGENT_IDS.claude)!,
    currentTaskId: "task-review",
  });
  store.upsertAgent({
    ...store.getAgent(AGENT_IDS.chatgpt)!,
    currentTaskId: null,
    status: "online",
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const store = new Store();
  seedIfEmpty(store);
  console.log("Seed complete.");
}
