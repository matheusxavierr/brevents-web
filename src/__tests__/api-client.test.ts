import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiClient } from "@/lib/api-client";

describe("envio JSON e multipart para a API", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mantém JSON e cabeçalhos personalizados", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "created" }) });
    vi.stubGlobal("fetch", fetch);
    expect(await apiClient("registrations/importer/", { method: "POST", headers: { "X-Test": "value" }, body: { name: "Ana" } })).toEqual({ id: "created" });
    const options = fetch.mock.calls[0][1] as RequestInit;
    expect(options.body).toBe('{"name":"Ana"}');
    expect(new Headers(options.headers).get("Content-Type")).toBe("application/json");
    expect(new Headers(options.headers).get("X-Test")).toBe("value");
  });

  it("envia FormData intacto e deixa o navegador definir o boundary", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ready: 1 }) });
    vi.stubGlobal("fetch", fetch);
    const body = new FormData();
    body.set("event", "event-1"); body.set("file", new File(["csv"], "clientes.csv"));
    await apiClient("registrations/import-preview/", { method: "POST", body, headers: { "Content-Type": "application/json" } });
    const options = fetch.mock.calls[0][1] as RequestInit;
    expect(options.body).toBe(body);
    expect(new Headers(options.headers).has("Content-Type")).toBe(false);
  });

  it("preserva erros específicos e informa expiração de sessão em uploads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ detail: "Sessão expirada" }) }));
    const listener = vi.fn();
    window.addEventListener("brevents:session-expired", listener);
    try {
      await expect(apiClient("registrations/import-preview/", { method: "POST", body: new FormData() })).rejects.toBeInstanceOf(ApiError);
      expect(listener).toHaveBeenCalledOnce();
    } finally { window.removeEventListener("brevents:session-expired", listener); }
  });
});
