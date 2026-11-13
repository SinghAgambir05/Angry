# Workspace

## Agent Nexus

The primary project in this workspace is **[agent-nexus](./agent-nexus)** — a local collaboration hub so Windows desktop AI agents (ChatGPT, Cursor, Claude, Antigravity) can share context, distribute work, and compile results.

```bash
cd agent-nexus
npm install && npm install --prefix client
npm run dev
```

Open http://localhost:5173

See `agent-nexus/README.md` and `agent-nexus/protocols/AGENT_PROTOCOL.md`.

## Legacy demo

The repository root also contains an older p5.js physics demo (`sketch.js`, etc.). It is unrelated to Agent Nexus.
