import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Snapshot } from "./types";

const empty: Snapshot = {
  agents: [],
  contexts: [],
  channels: [],
  messages: [],
  tasks: [],
  compilations: [],
  missions: [],
};

export function useNexus() {
  const [data, setData] = useState<Snapshot>(empty);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const applyEvent = useCallback((event: { type: string; payload: unknown }) => {
    setData((prev) => {
      const next = { ...prev };
      switch (event.type) {
        case "snapshot":
          return event.payload as Snapshot;
        case "agent.updated": {
          const agent = event.payload as Snapshot["agents"][number];
          const i = next.agents.findIndex((a) => a.id === agent.id);
          next.agents = i >= 0 ? next.agents.map((a, idx) => (idx === i ? agent : a)) : [...next.agents, agent];
          break;
        }
        case "context.updated": {
          const ctx = event.payload as Snapshot["contexts"][number];
          const i = next.contexts.findIndex((c) => c.id === ctx.id);
          next.contexts = i >= 0 ? next.contexts.map((c, idx) => (idx === i ? ctx : c)) : [ctx, ...next.contexts];
          break;
        }
        case "message.created": {
          const msg = event.payload as Snapshot["messages"][number];
          if (!next.messages.some((m) => m.id === msg.id)) next.messages = [...next.messages, msg];
          break;
        }
        case "task.updated": {
          const task = event.payload as Snapshot["tasks"][number];
          const i = next.tasks.findIndex((t) => t.id === task.id);
          next.tasks = i >= 0 ? next.tasks.map((t, idx) => (idx === i ? task : t)) : [task, ...next.tasks];
          break;
        }
        case "compilation.updated": {
          const comp = event.payload as Snapshot["compilations"][number];
          const i = next.compilations.findIndex((c) => c.id === comp.id);
          next.compilations =
            i >= 0 ? next.compilations.map((c, idx) => (idx === i ? comp : c)) : [comp, ...next.compilations];
          break;
        }
        case "mission.updated": {
          const mission = event.payload as Snapshot["missions"][number];
          const i = next.missions.findIndex((m) => m.id === mission.id);
          next.missions =
            i >= 0 ? next.missions.map((m, idx) => (idx === i ? mission : m)) : [mission, ...next.missions];
          break;
        }
      }
      return { ...next };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .snapshot()
      .then((snap) => {
        if (!cancelled) {
          setData(snap);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        applyEvent(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    };

    const ping = setInterval(() => {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping" }));
    }, 20000);

    return () => {
      cancelled = true;
      clearInterval(ping);
      ws.close();
    };
  }, [applyEvent]);

  return { data, connected, error, refresh: () => api.snapshot().then(setData) };
}
