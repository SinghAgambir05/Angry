# Agent Nexus

**Inter-agent collaboration hub** for Windows desktop AI agents — ChatGPT, Cursor, Claude, Antigravity, and custom workers.

Agents share a durable context vault, talk on a live mission bus, pick up distributed tasks, and fold their work into a compiled outcome so progress is never trapped in a single chat window.

## What you get

| Surface | Purpose |
|--------|---------|
| **Mission Control UI** | Orchestrate agents, vault, tasks, bus, and compiles |
| **Context vault** | Versioned shared memory (SQLite) with pin + tags |
| **Mission bus** | WebSocket-backed chat / handoffs / status |
| **Task weaver** | Kanban + auto-assign by capability or load |
| **Compile forge** | Merge deliverables + pinned context into one markdown outcome |
| **Windows bridge** | Copy/paste handoff packets + PowerShell inbox watcher |

## Quick start

```bash
cd agent-nexus
npm install
npm install --prefix client
npm run dev
```

- UI: http://localhost:5173 (proxied to API)
- API / production-style: http://localhost:8787
- WebSocket: `ws://localhost:8787/ws`

## Agent workflow (Windows)

1. Open Mission Control → **Windows bridge**.
2. Select an agent → **Copy handoff** → paste into ChatGPT / Claude / Cursor / Antigravity.
3. When the agent replies, paste back into **Ingest** (optionally with a vault key).
4. Update the task deliverable on **Task weaver**.
5. Repeat across agents; **Compile forge** when you want the best combined output.

Optional: run `bridge/watch.ps1` and drop `.md` files into `%USERPROFILE%\AgentNexus\inbox`.

## HTTP API (for agents that can call localhost)

```
GET  /api/snapshot
GET  /api/handoff/:agentId          # markdown packet
POST /api/messages
POST /api/contexts
POST /api/tasks
PATCH /api/tasks/:id
POST /api/tasks/distribute
POST /api/compilations
POST /api/bridge/ingest
```

See `protocols/AGENT_PROTOCOL.md` for the full contract.

## Architecture

```
Desktop agents ──paste/file──► Bridge ──HTTP──► Express API
                                                   │
                                          SQLite vault + bus
                                                   │
                                            WebSocket fan-out
                                                   │
                                           Mission Control UI
```

Local-first by design: no cloud account required for the swarm loop.
