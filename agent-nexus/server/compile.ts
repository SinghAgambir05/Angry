import type { Agent, Compilation, ContextEntry, Task } from "./types.js";

export function buildMergedOutput(opts: {
  title: string;
  goal: string;
  tasks: Task[];
  agents: Agent[];
  contexts: ContextEntry[];
}): { mergedOutput: string; contributions: Compilation["contributions"] } {
  const { title, goal, tasks, agents, contexts } = opts;
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const contributions: Compilation["contributions"] = [];

  const sections = tasks
    .filter((t) => t.status === "done" || t.deliverable.trim().length > 0)
    .map((task) => {
      const agent = task.assigneeId ? agentMap.get(task.assigneeId) : undefined;
      const excerpt = task.deliverable.trim() || task.description.trim() || "(no deliverable yet)";
      if (agent) {
        contributions.push({ agentId: agent.id, taskId: task.id, excerpt: excerpt.slice(0, 280) });
      }
      return [
        `### ${task.title}`,
        agent ? `*Owner: ${agent.name} (${agent.kind})*` : "*Unassigned*",
        "",
        excerpt,
      ].join("\n");
    });

  const pinned = contexts.filter((c) => c.pinned).slice(0, 6);
  const contextBlock =
    pinned.length === 0
      ? "_No pinned context._"
      : pinned.map((c) => `- **${c.title}** (\`${c.key}\` v${c.version}): ${c.content.slice(0, 160)}…`).join("\n");

  const coverage = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === "done").length,
    inProgress: tasks.filter((t) => t.status === "in_progress" || t.status === "assigned").length,
    blocked: tasks.filter((t) => t.status === "blocked").length,
  };

  const mergedOutput = [
    `# ${title}`,
    "",
    `> Goal: ${goal}`,
    "",
    `## Coverage`,
    `- Tasks: ${coverage.done}/${coverage.total} done`,
    `- In flight: ${coverage.inProgress}`,
    `- Blocked: ${coverage.blocked}`,
    `- Contributors: ${[...new Set(contributions.map((c) => agentMap.get(c.agentId)?.name).filter(Boolean))].join(", ") || "none"}`,
    "",
    `## Shared Context (pinned)`,
    contextBlock,
    "",
    `## Compiled Deliverables`,
    sections.length ? sections.join("\n\n") : "_No deliverables yet. Mark tasks done or add deliverable text._",
    "",
    `## Synthesis notes`,
    `This compilation was assembled by Agent Nexus from live task deliverables and pinned context.`,
    `Review conflicts, then mark the compilation ready or publish.`,
    "",
    `_Generated ${new Date().toISOString()}_`,
  ].join("\n");

  return { mergedOutput, contributions };
}

export function buildHandoffPacket(opts: {
  agent: Agent;
  contexts: ContextEntry[];
  tasks: Task[];
  recentMessages: { from: string; body: string; createdAt: string }[];
  missionGoal?: string;
}): string {
  const { agent, contexts, tasks, recentMessages, missionGoal } = opts;
  const mine = tasks.filter((t) => t.assigneeId === agent.id);
  const open = mine.filter((t) => t.status !== "done");
  const pinned = contexts.filter((c) => c.pinned);
  const relevant = contexts.filter(
    (c) =>
      c.pinned ||
      c.tags.some((t) => agent.kind.includes(t) || agent.name.toLowerCase().includes(t))
  );

  return [
    `# Agent Nexus Handoff — ${agent.name}`,
    ``,
    `You are **${agent.name}** (${agent.kind}). Role: ${agent.role}.`,
    missionGoal ? `Mission goal: ${missionGoal}` : "",
    ``,
    `## Your open work`,
    open.length
      ? open
          .map(
            (t) =>
              `- [${t.status}] **${t.title}** (priority ${t.priority})\n  ${t.description}\n  Deliverable so far: ${t.deliverable || "(empty)"}`
          )
          .join("\n")
      : `- No open tasks. Check the board or claim backlog work.`,
    ``,
    `## Shared context (read before continuing)`,
    [...new Map([...pinned, ...relevant].map((c) => [c.id, c])).values()]
      .map((c) => `### ${c.title} (\`${c.key}\` v${c.version})\n${c.content}`)
      .join("\n\n") || "_Empty vault — ask the orchestrator to seed context._",
    ``,
    `## Recent bus chatter`,
    recentMessages
      .slice(-8)
      .map((m) => `- ${m.createdAt} ${m.from}: ${m.body}`)
      .join("\n") || "_Quiet channel._",
    ``,
    `## Protocol`,
    `1. Read pinned context. Do not contradict without posting a context update.`,
    `2. Work only your assigned tasks unless you claim backlog via the API or board.`,
    `3. When finished a slice, update the task deliverable and status.`,
    `4. Post a handoff message summarizing what the next agent needs.`,
    `5. Never discard progress — write durable notes into context keys.`,
    ``,
    `Capabilities you declared: ${agent.capabilities.join(", ") || "general"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}
