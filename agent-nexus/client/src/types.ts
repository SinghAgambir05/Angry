export type AgentKind = "chatgpt" | "cursor" | "claude" | "antigravity" | "custom";
export type AgentStatus = "online" | "busy" | "away" | "offline";
export type TaskStatus = "backlog" | "assigned" | "in_progress" | "review" | "done" | "blocked";
export type MessageKind = "chat" | "handoff" | "status" | "context_update" | "task_update" | "system";
export type CompilationStatus = "draft" | "merging" | "ready" | "published";

export interface Agent {
  id: string;
  name: string;
  kind: AgentKind;
  status: AgentStatus;
  role: string;
  capabilities: string[];
  color: string;
  lastSeen: string;
  currentTaskId: string | null;
  notes: string;
}

export interface ContextEntry {
  id: string;
  key: string;
  title: string;
  content: string;
  tags: string[];
  version: number;
  updatedBy: string;
  updatedAt: string;
  pinned: boolean;
}

export interface Channel {
  id: string;
  name: string;
  purpose: string;
  memberIds: string[];
  createdAt: string;
}

export interface Message {
  id: string;
  channelId: string;
  fromAgentId: string;
  toAgentId: string | null;
  kind: MessageKind;
  body: string;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  parentId: string | null;
  priority: number;
  deliverable: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Compilation {
  id: string;
  title: string;
  goal: string;
  taskIds: string[];
  contributions: { agentId: string; taskId: string; excerpt: string }[];
  mergedOutput: string;
  status: CompilationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  title: string;
  goal: string;
  status: "active" | "paused" | "complete";
  createdAt: string;
}

export interface Snapshot {
  agents: Agent[];
  contexts: ContextEntry[];
  channels: Channel[];
  messages: Message[];
  tasks: Task[];
  compilations: Compilation[];
  missions: Mission[];
}

export type ViewId = "overview" | "bus" | "vault" | "tasks" | "compile" | "bridge";
