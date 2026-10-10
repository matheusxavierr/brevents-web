import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  test.skip(!process.env.E2E_ORGANIZER_ACCESS || !process.env.E2E_EVENT_SLUG, "Defina o organizador e um evento do ambiente local de teste.");
  const token = process.env.E2E_ORGANIZER_ACCESS!;
  await page.context().addCookies([{ name: "brevents_access", value: token, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001", httpOnly: true }]);
  const userResponse = await page.request.get("http://127.0.0.1:8000/api/auth/me/", { headers: { Authorization: `Bearer ${token}` } });
  expect(userResponse.ok()).toBe(true);
  const user = await userResponse.json();
  const response = await page.request.get(`http://127.0.0.1:8000/api/public/events/${process.env.E2E_EVENT_SLUG}/`);
  expect(response.ok()).toBe(true);
  const event = await response.json();
  const own = { id: "own", name: user.name, email: user.email, user: user.id, profile: { company: "", role: "" }, event: event.id, status: "confirmed" };
  const person = (index: number, prefix = "Pessoa") => ({ id: `${prefix}-${index}`, name: `${prefix} ${String(index + 1).padStart(2, "0")}`, user: 1000 + index, email: `pessoa${index + 1}@example.com`, profile: { company: index === 29 ? "Aurora" : "Horizonte", role: "Diretoria comercial" }, event: event.id, status: "confirmed" });
  const online = Array.from({ length: 30 }, (_, index) => ({ id: `presence-${index}`, registration: person(index).id, registration_detail: person(index), event: event.id, last_seen_at: new Date().toISOString() }));
  const base = { event: event.id, room: null, room_detail: null, responded_at: null, last_participant_seen_at: null, ended_at: null, created_at: "2026-10-09T21:00:00Z", updated_at: "2026-10-09T21:00:00Z", topic: "Vamos conversar sobre uma parceria?" };
  let requests = Array.from({ length: 55 }, (_, index) => ({ ...base, id: `incoming-${index}`, sender_registration: person(index, "Convidado").id, sender_detail: person(index, "Convidado"), recipient_registration: own.id, recipient_detail: own, status: "pending" }));
  const controls = { open: true, created: 0 };
  await page.route("**/api/backend/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend/", "");
    if (path.startsWith("public/events/")) return route.fulfill({ json: { ...event, feature_flags: { ...event.feature_flags, networking_open: controls.open } } });
    if (path === "networking-presences/heartbeat/") return route.fulfill({ json: { registration: own.id } });
    if (path === "networking-presences/online/") return route.fulfill({ json: online });
    if (path === "networking-presences/leave/") return route.fulfill({ status: 204 });
    if (path === "networking-requests/" && route.request().method() === "GET") {
      const items = requests.filter((item) => item.status === url.searchParams.get("status"));
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const next = items.length > pageNumber * 50 ? `http://localhost/api/networking-requests/?event=${event.id}&status=${url.searchParams.get("status")}&page=${pageNumber + 1}` : null;
      return route.fulfill({ json: { count: items.length, next, results: items.slice((pageNumber - 1) * 50, pageNumber * 50) } });
    }
    if (path === "networking-requests/" && route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      const recipient = online.find((presence) => presence.registration === payload.recipient_registration)!.registration_detail;
      const created = { ...base, id: "sent", sender_registration: own.id, sender_detail: own, recipient_registration: recipient.id, recipient_detail: recipient, topic: payload.topic, status: "pending" };
      requests.push(created); controls.created += 1;
      return route.fulfill({ status: 201, json: created });
    }
    const match = path.match(/^networking-requests\/(.+)\/(accept|decline|cancel|end)\/$/);
    if (match) {
      const item = requests.find((request) => request.id === match[1])!;
      item.status = match[2] === "accept" ? "accepted" : match[2] === "end" ? "ended" : match[2] === "decline" ? "declined" : "cancelled";
      if (match[2] === "accept") requests = requests.map((request) => request.id !== item.id && request.status === "pending" ? { ...request, status: "cancelled" } : request);
      return route.fulfill({ json: item });
    }
    return route.continue();
  });
  return { event, controls };
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 390, height: 667 }]) {
  test(`networking ${viewport.width}x${viewport.height} pagina sem scroll ou cartões cortados`, async ({ page }) => {
    await page.setViewportSize(viewport); const { event } = await setup(page);
    await page.goto(`/eventos/${event.slug}/networking`);
    await expect(page.getByText("Pessoa 01", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight }))).toEqual({ x: true, y: true });
    const results = page.getByRole("region", { name: "Resultados do networking" });
    expect(await results.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    expect(await results.getByRole("article").evaluateAll((elements) => elements.every((element) => element.scrollHeight - element.clientHeight <= 1))).toBe(true);
    await page.screenshot({ path: `test-results/networking-${viewport.width}x${viewport.height}.png`, animations: "disabled", fullPage: true });
    await page.getByRole("searchbox").fill("Aurora");
    await expect(page.getByText("Pessoa 30", { exact: true })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(1);
    await page.getByRole("tab", { name: "Recebidos", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Recebidos" })).toContainText("55");
    expect(await results.getByRole("article").evaluateAll((elements) => elements.every((element) => element.scrollHeight - element.clientHeight <= 1))).toBe(true);
    await expect(page.getByRole("button", { name: "Próxima página" })).toBeEnabled();
  });
}

test("envia convite e aceita uma conversa com saída confirmada", async ({ page }) => {
  const { event, controls } = await setup(page);
  await page.goto(`/eventos/${event.slug}/networking`);
  await expect(page.getByText("Pessoa 01", { exact: true })).toBeVisible();
  await page.getByRole("article").filter({ hasText: "Pessoa 01" }).getByRole("button").click();
  const dialog = page.getByRole("dialog", { name: "Conversar com Pessoa 01?" });
  await dialog.getByRole("textbox").fill("Distribuição de produtos");
  await dialog.getByRole("button", { name: "Enviar convite", exact: true }).click();
  await expect(dialog).toHaveCount(0); expect(controls.created).toBe(1);
  await page.getByRole("tab", { name: "Enviados" }).click();
  await expect(page.getByText("Distribuição de produtos", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar convite" }).click();
  await page.getByRole("tab", { name: "Recebidos" }).click();
  await page.getByRole("button", { name: "Aceitar", exact: true }).first().click();
  await expect(page.getByRole("link", { name: "Entrar na conversa" })).toBeVisible();
  await page.getByRole("tab", { name: "Pessoas" }).click();
  await expect(page.getByRole("button", { name: "Você está em um 1:1" }).first()).toBeDisabled();
  await page.getByRole("tab", { name: "Conversa 1:1" }).click();
  await page.getByRole("button", { name: "Sair do 1:1" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirmar saída" }).click();
  await expect(page.getByRole("button", { name: "Convidar para conversar" }).first()).toBeEnabled();
});

test("fechamento pelo organizador desabilita envio de convite já aberto", async ({ page }) => {
  const { event, controls } = await setup(page);
  await page.goto(`/eventos/${event.slug}/networking`);
  await expect(page.getByText("Pessoa 01", { exact: true })).toBeVisible();
  await page.getByRole("article").filter({ hasText: "Pessoa 01" }).getByRole("button").click();
  controls.open = false;
  const submit = page.getByRole("dialog").getByRole("button", { name: "Enviar convite", exact: true });
  await expect(submit).toBeDisabled({ timeout: 8000 });
  expect(controls.created).toBe(0);
});
