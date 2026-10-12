import { beforeEach, describe, expect, it, vi } from "vitest";
import { ensureEventAuditorium } from "@/lib/event-room";

const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ apiClient: api }));
const room = { id: "room", event: "event", name: "Auditório", purpose: "main", position: 0, zoom_session: { configured: true } };

describe("auditório do evento", () => {
  beforeEach(() => { api.mockReset(); });

  it("não confunde um auditório de outro evento com o do cadastro novo", async () => {
    api.mockResolvedValueOnce({ results: [{ ...room, event: "old-event" }], next: null }).mockResolvedValueOnce(room);
    expect(await ensureEventAuditorium("event")).toEqual(room);
    expect(api).toHaveBeenLastCalledWith("rooms/", expect.objectContaining({ method: "POST", body: expect.objectContaining({ event: "event", purpose: "main" }) }));
  });

  it("reutiliza apenas o auditório que pertence ao evento solicitado", async () => {
    api.mockResolvedValueOnce({ results: [{ ...room, id: "foreign", event: "old-event" }, room], next: null });
    expect(await ensureEventAuditorium("event")).toEqual(room);
    expect(api).toHaveBeenCalledTimes(1);
  });
});
