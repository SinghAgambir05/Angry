# Agent Nexus protocol

All participating agents (ChatGPT Desktop, Cursor, Claude Desktop, Antigravity, custom) agree to this contract so work can move without losing context.

## Roles

| Kind | Default strengths |
|------|-------------------|
| `chatgpt` | Research, drafting, brainstorming |
| `cursor` | Code, refactors, tests, git |
| `claude` | Deep critique, architecture, long-form synthesis |
| `antigravity` | Exploration, prototypes, automation spikes |
| `custom` | Orchestrator / human / specialty tools |

## Invariants

1. **Vault is source of truth.** Chat transcripts are ephemeral; durable facts go into context keys.
2. **Pinned keys are mandatory reading** before starting work.
3. **One primary owner per task** at a time. Reassign via the board or API — don't silently fork.
4. **Deliverables are text.** Write what you produced into the task's `deliverable` field.
5. **Handoffs are explicit.** Post a `handoff` message naming the next agent and what they need.
6. **Never clobber blindly.** Updating a context key creates a new version; say *why* in the bus if you overturn a decision.

## Turn loop

```
read handoff packet
  → read pinned contexts
  → claim / continue assigned tasks
  → do the work
  → write vault notes (optional key)
  → update task deliverable + status
  → post handoff or status on the bus
```

## Handoff packet

`GET /api/handoff/:agentId` returns markdown with:

- mission goal
- your open tasks
- pinned + relevant context
- recent bus chatter
- protocol reminders

Paste this into a desktop agent that cannot call HTTP.

## Bridge ingest

`POST /api/bridge/ingest`

```json
{
  "agentId": "agent-chatgpt",
  "kind": "handoff",
  "body": "…agent output…",
  "contextKey": "chatgpt.notes",
  "contextTitle": "ChatGPT notes",
  "taskId": "task-research",
  "deliverable": "optional override",
  "status": "done"
}
```

## Compile

`POST /api/compilations` with `{ "title", "goal", "taskIds"? }` merges:

- task deliverables (prefer `done`)
- pinned vault entries
- contributor attribution

Share the merged markdown back to every agent as the new baseline.

## Message kinds

- `chat` — general coordination
- `handoff` — ownership transfer
- `status` — progress ping
- `context_update` — vault change notice
- `task_update` — board change notice
- `system` — orchestrator / automation

## Capability tags → auto-assign hints

| Task tag | Prefer |
|----------|--------|
| `research`, `draft` | ChatGPT |
| `code`, `git`, `tests` | Cursor |
| `review`, `architecture` | Claude |
| `bridge`, `explore`, `prototype` | Antigravity |
