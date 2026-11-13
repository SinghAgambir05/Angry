# Sample agent reply

I reviewed the Windows constraints for ChatGPT Desktop and Claude Desktop.

## Findings
- Clipboard paste of Agent Nexus handoff packets is the most reliable shared channel.
- Project/knowledge files work for longer-lived notes but are not live-synced.
- Cursor can call `localhost:8787` directly when allowed.

## Recommendation
Use paste bridge for ChatGPT/Claude; HTTP + file watcher for Cursor/Antigravity.

## Deliverable for task-research
Documented common denominator: paste packets + watched inbox folder.
