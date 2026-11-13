import type { WebSocket } from "ws";
import type { BusEvent } from "./types.js";

export class Bus {
  private clients = new Set<WebSocket>();

  add(ws: WebSocket) {
    this.clients.add(ws);
    ws.on("close", () => this.clients.delete(ws));
  }

  broadcast(event: BusEvent) {
    const raw = JSON.stringify(event);
    for (const ws of this.clients) {
      if (ws.readyState === 1) ws.send(raw);
    }
  }
}
