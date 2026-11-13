import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import type {
  Agent,
  Channel,
  Compilation,
  ContextEntry,
  ContextVersion,
  Message,
  Mission,
  Snapshot,
  Task,
} from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "data", "nexus.db");

export class Store {
  db: Database.Database;

  constructor(file = dbPath) {
    this.db = new Database(file);
    this.db.pragma("journal_mode = WAL");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        status TEXT NOT NULL,
        role TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        color TEXT NOT NULL,
        lastSeen TEXT NOT NULL,
        currentTaskId TEXT,
        notes TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        tags TEXT NOT NULL,
        version INTEGER NOT NULL,
        updatedBy TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS context_versions (
        id TEXT PRIMARY KEY,
        contextId TEXT NOT NULL,
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        updatedBy TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS channels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        memberIds TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channelId TEXT NOT NULL,
        fromAgentId TEXT NOT NULL,
        toAgentId TEXT,
        kind TEXT NOT NULL,
        body TEXT NOT NULL,
        meta TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        assigneeId TEXT,
        parentId TEXT,
        priority INTEGER NOT NULL,
        deliverable TEXT NOT NULL,
        tags TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS compilations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        taskIds TEXT NOT NULL,
        contributions TEXT NOT NULL,
        mergedOutput TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);
  }

  // —— Agents ——
  listAgents(): Agent[] {
    return this.db
      .prepare("SELECT * FROM agents ORDER BY name")
      .all()
      .map(rowToAgent);
  }

  getAgent(id: string): Agent | undefined {
    const row = this.db.prepare("SELECT * FROM agents WHERE id = ?").get(id);
    return row ? rowToAgent(row) : undefined;
  }

  upsertAgent(input: Partial<Agent> & { name: string; kind: Agent["kind"] }): Agent {
    const existing = input.id ? this.getAgent(input.id) : undefined;
    const agent: Agent = {
      id: existing?.id ?? input.id ?? randomUUID(),
      name: input.name,
      kind: input.kind,
      status: input.status ?? existing?.status ?? "offline",
      role: input.role ?? existing?.role ?? "collaborator",
      capabilities: input.capabilities ?? existing?.capabilities ?? [],
      color: input.color ?? existing?.color ?? "#0d9488",
      lastSeen: input.lastSeen ?? new Date().toISOString(),
      currentTaskId: input.currentTaskId !== undefined ? input.currentTaskId : existing?.currentTaskId ?? null,
      notes: input.notes ?? existing?.notes ?? "",
    };
    this.db
      .prepare(
        `INSERT INTO agents (id,name,kind,status,role,capabilities,color,lastSeen,currentTaskId,notes)
         VALUES (@id,@name,@kind,@status,@role,@capabilities,@color,@lastSeen,@currentTaskId,@notes)
         ON CONFLICT(id) DO UPDATE SET
           name=excluded.name, kind=excluded.kind, status=excluded.status, role=excluded.role,
           capabilities=excluded.capabilities, color=excluded.color, lastSeen=excluded.lastSeen,
           currentTaskId=excluded.currentTaskId, notes=excluded.notes`
      )
      .run({
        ...agent,
        capabilities: JSON.stringify(agent.capabilities),
      });
    return agent;
  }

  // —— Contexts ——
  listContexts(): ContextEntry[] {
    return this.db
      .prepare("SELECT * FROM contexts ORDER BY pinned DESC, updatedAt DESC")
      .all()
      .map(rowToContext);
  }

  getContext(id: string): ContextEntry | undefined {
    const row = this.db.prepare("SELECT * FROM contexts WHERE id = ?").get(id);
    return row ? rowToContext(row) : undefined;
  }

  getContextByKey(key: string): ContextEntry | undefined {
    const row = this.db.prepare("SELECT * FROM contexts WHERE key = ?").get(key);
    return row ? rowToContext(row) : undefined;
  }

  upsertContext(input: {
    id?: string;
    key: string;
    title: string;
    content: string;
    tags?: string[];
    updatedBy: string;
    pinned?: boolean;
  }): ContextEntry {
    const existing = input.id
      ? this.getContext(input.id)
      : this.getContextByKey(input.key);
    const now = new Date().toISOString();
    const version = (existing?.version ?? 0) + 1;
    const entry: ContextEntry = {
      id: existing?.id ?? randomUUID(),
      key: input.key,
      title: input.title,
      content: input.content,
      tags: input.tags ?? existing?.tags ?? [],
      version,
      updatedBy: input.updatedBy,
      updatedAt: now,
      pinned: input.pinned ?? existing?.pinned ?? false,
    };
    this.db
      .prepare(
        `INSERT INTO contexts (id,key,title,content,tags,version,updatedBy,updatedAt,pinned)
         VALUES (@id,@key,@title,@content,@tags,@version,@updatedBy,@updatedAt,@pinned)
         ON CONFLICT(id) DO UPDATE SET
           key=excluded.key, title=excluded.title, content=excluded.content, tags=excluded.tags,
           version=excluded.version, updatedBy=excluded.updatedBy, updatedAt=excluded.updatedAt,
           pinned=excluded.pinned`
      )
      .run({
        ...entry,
        tags: JSON.stringify(entry.tags),
        pinned: entry.pinned ? 1 : 0,
      });
    this.db
      .prepare(
        `INSERT INTO context_versions (id,contextId,version,content,updatedBy,updatedAt)
         VALUES (?,?,?,?,?,?)`
      )
      .run(randomUUID(), entry.id, version, entry.content, entry.updatedBy, now);
    return entry;
  }

  listContextVersions(contextId: string): ContextVersion[] {
    return this.db
      .prepare(
        "SELECT * FROM context_versions WHERE contextId = ? ORDER BY version DESC"
      )
      .all(contextId) as ContextVersion[];
  }

  // —— Channels / Messages ——
  listChannels(): Channel[] {
    return this.db
      .prepare("SELECT * FROM channels ORDER BY createdAt")
      .all()
      .map(rowToChannel);
  }

  upsertChannel(input: Partial<Channel> & { name: string; purpose: string }): Channel {
    const channel: Channel = {
      id: input.id ?? randomUUID(),
      name: input.name,
      purpose: input.purpose,
      memberIds: input.memberIds ?? [],
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO channels (id,name,purpose,memberIds,createdAt)
         VALUES (@id,@name,@purpose,@memberIds,@createdAt)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, purpose=excluded.purpose, memberIds=excluded.memberIds`
      )
      .run({ ...channel, memberIds: JSON.stringify(channel.memberIds) });
    return channel;
  }

  listMessages(channelId?: string, limit = 200): Message[] {
    if (channelId) {
      return this.db
        .prepare(
          "SELECT * FROM messages WHERE channelId = ? ORDER BY createdAt DESC LIMIT ?"
        )
        .all(channelId, limit)
        .map(rowToMessage)
        .reverse();
    }
    return this.db
      .prepare("SELECT * FROM messages ORDER BY createdAt DESC LIMIT ?")
      .all(limit)
      .map(rowToMessage)
      .reverse();
  }

  createMessage(input: Omit<Message, "id" | "createdAt"> & { id?: string; createdAt?: string }): Message {
    const message: Message = {
      id: input.id ?? randomUUID(),
      channelId: input.channelId,
      fromAgentId: input.fromAgentId,
      toAgentId: input.toAgentId,
      kind: input.kind,
      body: input.body,
      meta: input.meta ?? {},
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO messages (id,channelId,fromAgentId,toAgentId,kind,body,meta,createdAt)
         VALUES (@id,@channelId,@fromAgentId,@toAgentId,@kind,@body,@meta,@createdAt)`
      )
      .run({ ...message, meta: JSON.stringify(message.meta) });
    return message;
  }

  // —— Tasks ——
  listTasks(): Task[] {
    return this.db
      .prepare("SELECT * FROM tasks ORDER BY priority DESC, updatedAt DESC")
      .all()
      .map(rowToTask);
  }

  getTask(id: string): Task | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
    return row ? rowToTask(row) : undefined;
  }

  upsertTask(input: Partial<Task> & { title: string }): Task {
    const existing = input.id ? this.getTask(input.id) : undefined;
    const now = new Date().toISOString();
    const task: Task = {
      id: existing?.id ?? input.id ?? randomUUID(),
      title: input.title,
      description: input.description ?? existing?.description ?? "",
      status: input.status ?? existing?.status ?? "backlog",
      assigneeId:
        input.assigneeId !== undefined ? input.assigneeId : existing?.assigneeId ?? null,
      parentId: input.parentId !== undefined ? input.parentId : existing?.parentId ?? null,
      priority: input.priority ?? existing?.priority ?? 1,
      deliverable: input.deliverable ?? existing?.deliverable ?? "",
      tags: input.tags ?? existing?.tags ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO tasks (id,title,description,status,assigneeId,parentId,priority,deliverable,tags,createdAt,updatedAt)
         VALUES (@id,@title,@description,@status,@assigneeId,@parentId,@priority,@deliverable,@tags,@createdAt,@updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, description=excluded.description, status=excluded.status,
           assigneeId=excluded.assigneeId, parentId=excluded.parentId, priority=excluded.priority,
           deliverable=excluded.deliverable, tags=excluded.tags, updatedAt=excluded.updatedAt`
      )
      .run({ ...task, tags: JSON.stringify(task.tags) });
    return task;
  }

  // —— Compilations ——
  listCompilations(): Compilation[] {
    return this.db
      .prepare("SELECT * FROM compilations ORDER BY updatedAt DESC")
      .all()
      .map(rowToCompilation);
  }

  getCompilation(id: string): Compilation | undefined {
    const row = this.db.prepare("SELECT * FROM compilations WHERE id = ?").get(id);
    return row ? rowToCompilation(row) : undefined;
  }

  upsertCompilation(input: Partial<Compilation> & { title: string; goal: string }): Compilation {
    const existing = input.id ? this.getCompilation(input.id) : undefined;
    const now = new Date().toISOString();
    const compilation: Compilation = {
      id: existing?.id ?? input.id ?? randomUUID(),
      title: input.title,
      goal: input.goal,
      taskIds: input.taskIds ?? existing?.taskIds ?? [],
      contributions: input.contributions ?? existing?.contributions ?? [],
      mergedOutput: input.mergedOutput ?? existing?.mergedOutput ?? "",
      status: input.status ?? existing?.status ?? "draft",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.db
      .prepare(
        `INSERT INTO compilations (id,title,goal,taskIds,contributions,mergedOutput,status,createdAt,updatedAt)
         VALUES (@id,@title,@goal,@taskIds,@contributions,@mergedOutput,@status,@createdAt,@updatedAt)
         ON CONFLICT(id) DO UPDATE SET
           title=excluded.title, goal=excluded.goal, taskIds=excluded.taskIds,
           contributions=excluded.contributions, mergedOutput=excluded.mergedOutput,
           status=excluded.status, updatedAt=excluded.updatedAt`
      )
      .run({
        ...compilation,
        taskIds: JSON.stringify(compilation.taskIds),
        contributions: JSON.stringify(compilation.contributions),
      });
    return compilation;
  }

  // —— Missions ——
  listMissions(): Mission[] {
    return this.db
      .prepare("SELECT * FROM missions ORDER BY createdAt DESC")
      .all() as Mission[];
  }

  upsertMission(input: Partial<Mission> & { title: string; goal: string }): Mission {
    const mission: Mission = {
      id: input.id ?? randomUUID(),
      title: input.title,
      goal: input.goal,
      status: input.status ?? "active",
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO missions (id,title,goal,status,createdAt)
         VALUES (@id,@title,@goal,@status,@createdAt)
         ON CONFLICT(id) DO UPDATE SET title=excluded.title, goal=excluded.goal, status=excluded.status`
      )
      .run(mission);
    return mission;
  }

  snapshot(): Snapshot {
    return {
      agents: this.listAgents(),
      contexts: this.listContexts(),
      channels: this.listChannels(),
      messages: this.listMessages(undefined, 300),
      tasks: this.listTasks(),
      compilations: this.listCompilations(),
      missions: this.listMissions(),
    };
  }

  isEmpty(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) as c FROM agents").get() as { c: number };
    return row.c === 0;
  }
}

function rowToAgent(row: any): Agent {
  return {
    ...row,
    capabilities: JSON.parse(row.capabilities || "[]"),
    currentTaskId: row.currentTaskId ?? null,
  };
}

function rowToContext(row: any): ContextEntry {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
    pinned: Boolean(row.pinned),
  };
}

function rowToChannel(row: any): Channel {
  return { ...row, memberIds: JSON.parse(row.memberIds || "[]") };
}

function rowToMessage(row: any): Message {
  return { ...row, meta: JSON.parse(row.meta || "{}"), toAgentId: row.toAgentId ?? null };
}

function rowToTask(row: any): Task {
  return {
    ...row,
    tags: JSON.parse(row.tags || "[]"),
    assigneeId: row.assigneeId ?? null,
    parentId: row.parentId ?? null,
  };
}

function rowToCompilation(row: any): Compilation {
  return {
    ...row,
    taskIds: JSON.parse(row.taskIds || "[]"),
    contributions: JSON.parse(row.contributions || "[]"),
  };
}
