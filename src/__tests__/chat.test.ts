import { describe, expect, it } from "vitest";

import { normalizeRealtimeChatMessage } from "@/lib/chat";

describe("normalizeRealtimeChatMessage", () => {
  it("converte o timestamp do WebSocket para o formato usado pela interface", () => {
    const message = normalizeRealtimeChatMessage({ id: "1", body: "Olá", sender: null, timestamp: "2026-10-08T13:45:00Z" });
    expect(message.created_at).toBe("2026-10-08T13:45:00Z");
  });

  it("usa o horário local de recebimento quando a mensagem não traz data", () => {
    const now = new Date("2026-10-08T14:00:00Z");
    const message = normalizeRealtimeChatMessage({ id: "2", body: "Teste", sender: null }, now);
    expect(message.created_at).toBe(now.toISOString());
  });
});
