import { describe, expect, it } from "vitest";

import { isFatalRealtimeClose, realtimeReconnectDelay, websocketBaseUrl } from "@/lib/realtime";

describe("realtime helpers", () => {
  it("normaliza URLs HTTP do ambiente para WebSocket seguro", () => {
    expect(websocketBaseUrl("https://api.example.com/ws/")).toBe("wss://api.example.com/ws");
    expect(websocketBaseUrl("http://127.0.0.1:8000/ws/")).toBe("ws://127.0.0.1:8000/ws");
  });

  it("aplica backoff limitado na reconexão", () => {
    expect(realtimeReconnectDelay(0)).toBe(1_000);
    expect(realtimeReconnectDelay(3)).toBe(8_000);
    expect(realtimeReconnectDelay(10)).toBe(15_000);
  });

  it("renova token expirado e não tenta reconectar acesso proibido", () => {
    expect(isFatalRealtimeClose(4401)).toBe(false);
    expect(isFatalRealtimeClose(4403)).toBe(true);
    expect(isFatalRealtimeClose(1006)).toBe(false);
  });
});
