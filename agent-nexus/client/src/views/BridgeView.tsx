import { useState } from "react";
import { api } from "../api";
import type { Snapshot } from "../types";

type Props = {
  data: Snapshot;
  actingAs: string;
};

export function BridgeView({ data, actingAs }: Props) {
  const [agentId, setAgentId] = useState(actingAs);
  const [packet, setPacket] = useState("");
  const [ingest, setIngest] = useState("");
  const [contextKey, setContextKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function loadHandoff() {
    setBusy(true);
    setStatus(null);
    try {
      const text = await api.handoff(agentId);
      setPacket(text);
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPacket() {
    if (!packet) await loadHandoff();
    const text = packet || (await api.handoff(agentId));
    setPacket(text);
    await navigator.clipboard.writeText(text);
    setStatus("Handoff packet copied — paste into ChatGPT, Claude, Cursor, or Antigravity.");
  }

  async function postIngest() {
    if (!ingest.trim()) return;
    setBusy(true);
    try {
      await api.bridgeIngest({
        agentId,
        kind: "handoff",
        body: ingest.trim(),
        contextKey: contextKey.trim() || undefined,
        contextTitle: contextKey.trim() || undefined,
      });
      setIngest("");
      setStatus("Ingested into the bus" + (contextKey ? " and vault" : "") + ".");
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setBusy(false);
    }
  }

  const ps = `# Agent Nexus Windows bridge — drop .md files into this folder
$Watch = "$env:USERPROFILE\\AgentNexus\\inbox"
$Api   = "http://localhost:8787/api/bridge/ingest"
$Agent = "${agentId}"
New-Item -ItemType Directory -Force -Path $Watch | Out-Null
Write-Host "Watching $Watch …"
$fs = New-Object System.IO.FileSystemWatcher $Watch, "*.md"
$fs.EnableRaisingEvents = $true
Register-ObjectEvent $fs Created -Action {
  Start-Sleep -Milliseconds 400
  $path = $Event.SourceEventArgs.FullPath
  $body = Get-Content -Raw $path
  $payload = @{ agentId = $Agent; kind = "handoff"; body = $body; contextKey = ("bridge." + [IO.Path]::GetFileNameWithoutExtension($path)) } | ConvertTo-Json
  Invoke-RestMethod -Uri $Api -Method Post -ContentType "application/json" -Body $payload
  Move-Item $path ($path + ".done")
}`;

  return (
    <div className="stack rise">
      <div className="panel">
        <h2>Windows bridge</h2>
        <p className="muted">
          Desktop agents that cannot call APIs still participate: copy a tailored handoff packet into their chat,
          then paste their reply back here—or drop markdown into a watched folder.
        </p>
      </div>

      <div className="grid-2">
        <div className="panel stack">
          <h3>1. Export handoff packet</h3>
          <div className="field">
            <label>Target agent</label>
            <select
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setPacket("");
              }}
            >
              {data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={copyPacket}>
              Copy handoff for agent
            </button>
            <button className="btn btn-ghost" disabled={busy} onClick={loadHandoff}>
              Preview
            </button>
          </div>
          {packet && <div className="pre">{packet}</div>}
        </div>

        <div className="panel stack">
          <h3>2. Ingest agent reply</h3>
          <div className="field">
            <label>Optional vault key (writes durable context)</label>
            <input
              value={contextKey}
              onChange={(e) => setContextKey(e.target.value)}
              placeholder="chatgpt.research.notes"
            />
          </div>
          <div className="field">
            <label>Paste the agent's response</label>
            <textarea
              value={ingest}
              onChange={(e) => setIngest(e.target.value)}
              placeholder="Paste output from ChatGPT / Claude / Cursor / Antigravity…"
              style={{ minHeight: 160 }}
            />
          </div>
          <button className="btn btn-primary" disabled={busy || !ingest.trim()} onClick={postIngest}>
            Post into Nexus
          </button>
          {status && <p className="muted">{status}</p>}
        </div>
      </div>

      <div className="panel stack">
        <h3>3. PowerShell file watcher</h3>
        <p className="muted">
          Save as <code>%USERPROFILE%\\AgentNexus\\watch.ps1</code>, run it, then have agents (or you) save
          handoff markdown into <code>inbox\\</code>.
        </p>
        <div className="pre">{ps}</div>
        <button
          className="btn btn-ghost btn-small"
          onClick={async () => {
            await navigator.clipboard.writeText(ps);
            setStatus("PowerShell watcher copied.");
          }}
        >
          Copy PowerShell script
        </button>
      </div>

      <div className="panel">
        <h3>Protocol cheat sheet</h3>
        <ol className="muted" style={{ lineHeight: 1.7 }}>
          <li>Orchestrator sets mission + pins vault keys.</li>
          <li>Copy handoff → paste into desktop agent chat.</li>
          <li>Agent works its slice; you (or watcher) ingest the reply.</li>
          <li>Update task deliverable / status on the weaver board.</li>
          <li>When slices land, run Compile forge and share the merged playbook back to all agents.</li>
        </ol>
      </div>
    </div>
  );
}
