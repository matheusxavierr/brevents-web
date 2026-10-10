import { afterEach, describe, expect, it, vi } from "vitest";
import { getPublicEvent } from "@/lib/api-server";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "test-token" }) }) }));

describe("prévia do evento", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("carrega palestrantes sem programação também no rascunho e omite contato", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      let payload: unknown = { results: [] };
      if (input.includes("/public/events/")) return { ok: false, status: 404, json: async () => ({}) };
      if (input.includes("/events/?managed")) payload = { results: [{ id: "draft", slug: "novo", status: "draft" }] };
      if (input.includes("/rooms/?")) payload = { results: [{ id: "room", event: "draft" }, { id: "foreign", event: "other" }] };
      if (input.includes("/speakers/?")) payload = { results: [{ id: "speaker", event: "draft", name: "Marina", email: "private@example.com", bio: "Inovação", avatar_url: "" }] };
      return { ok: true, json: async () => payload };
    });
    vi.stubGlobal("fetch", fetchMock);
    const event = await getPublicEvent("novo");
    expect(event?.speakers).toEqual([{ id: "speaker", name: "Marina", bio: "Inovação", avatar_url: "" }]);
    expect(event?.rooms?.map((room) => room.id)).toEqual(["room"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/speakers/?event=draft"), expect.objectContaining({ headers: { Authorization: "Bearer test-token" }, cache: "no-store" }));
  });
});
