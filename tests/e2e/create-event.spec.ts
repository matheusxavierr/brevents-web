import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page, failPublish = false) {
  if (process.env.E2E_ORGANIZER_ACCESS) await page.context().addCookies([{ name: "brevents_access", value: process.env.E2E_ORGANIZER_ACCESS, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001", httpOnly: true }]);
  const controls = { eventPosts: 0, roomPosts: 0, publishPosts: 0, payload: {} as Record<string, unknown> };
  const id = "11111111-1111-4111-8111-111111111111";
  await page.route("**/api/backend/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend/", "");
    const method = route.request().method();
    if (path === "organizations/") return route.fulfill({ json: { results: [{ id: "hub", name: "Aurora Eventos", can_manage: true }], next: null } });
    if (path === "events/" && method === "POST") { controls.eventPosts += 1; controls.payload = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { ...controls.payload, id, status: "draft" } }); }
    if (path === "rooms/" && method === "POST") { controls.roomPosts += 1; return route.fulfill({ status: 201, json: { id: "room", zoom_session: { configured: true } } }); }
    if (path === "rooms/" && method === "GET") return route.fulfill({ json: { results: [{ id: "old-room", event: "other-event", purpose: "main", position: 0, name: "Outro auditório", zoom_session: { configured: true } }, ...(controls.roomPosts ? [{ id: "room", event: id, purpose: "main", position: 0, name: "Auditório principal", zoom_session: { configured: true } }] : [])], next: null } });
    if (path.endsWith("/publish/")) { controls.publishPosts += 1; return failPublish && controls.publishPosts === 1 ? route.fulfill({ status: 503, json: { detail: "Falha temporária na publicação." } }) : route.fulfill({ json: { id, status: "published" } }); }
    if (path.includes("analytics")) return route.fulfill({ json: { registrations: 0, confirmed_registrations: 0, chat_messages: 0, rooms: [] } });
    if (path === "events/" && method === "GET") return route.fulfill({ json: { results: controls.eventPosts ? [{ ...controls.payload, id, status: "published", registration_open: true }] : [], next: null } });
    return route.fulfill({ json: { results: [], next: null } });
  });
  return { controls, id };
}

async function presentation(page: Page) {
  await page.getByLabel("Nome do evento", { exact: false }).fill("Encontro de inovação");
  await page.getByLabel("Frase principal", { exact: false }).fill("Ideias que viram conexões.");
  await page.getByLabel("Descrição", { exact: false }).fill("Um encontro online para trocar ideias e criar novas parcerias.");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}
async function dates(page: Page) {
  await page.getByLabel("Início", { exact: false }).fill("2026-10-15T10:00");
  await page.getByLabel("Término", { exact: false }).fill("2026-10-15T12:00");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}
async function noScroll(page: Page) {
  expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight }))).toEqual({ x: true, y: true });
  const body = page.getByRole("region", { name: "Etapa do cadastro" });
  expect(await body.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  await expect(page.getByRole("form", { name: "Criar evento" }).getByRole("button").last()).toBeInViewport();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 390, height: 667 }]) {
  test(`cadastro ${viewport.width}x${viewport.height} mantém todas as etapas sem scroll`, async ({ page }) => {
    await page.setViewportSize(viewport); const { controls, id } = await setup(page);
    await page.goto("/painel/eventos/novo");
    await expect(page.getByText("Etapa 1 de 4")).toBeVisible(); await noScroll(page);
    await page.screenshot({ path: `test-results/create-event-${viewport.width}x${viewport.height}.png`, fullPage: true });
    await presentation(page); await noScroll(page);
    await dates(page); await noScroll(page);
    await page.getByRole("button", { name: "Adicionar palestrante", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Adicionar palestrante" });
    await dialog.getByLabel("Nome do palestrante", { exact: false }).fill("Marina Costa");
    await dialog.getByRole("button", { name: "Salvar palestrante" }).click();
    await expect(page.getByText("Marina Costa", { exact: true })).toBeVisible();
    await noScroll(page);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await noScroll(page);
    await page.screenshot({ path: `test-results/create-event-review-${viewport.width}x${viewport.height}.png`, fullPage: true });
    expect(controls.eventPosts).toBe(0);
    await page.getByRole("button", { name: "Criar e publicar evento" }).click();
    await expect(page).toHaveURL(new RegExp(`/painel\\?event=${id}$`));
    expect(controls.eventPosts).toBe(1); expect(controls.roomPosts).toBe(1); expect(controls.publishPosts).toBe(1);
    expect(controls.payload.initial_speakers).toEqual([{ name: "Marina Costa", email: "", bio: "" }]);
  });
}

test("voltar mantém dados e publicação pode ser retomada sem duplicar", async ({ page }) => {
  const { controls, id } = await setup(page, true); await page.goto("/painel/eventos/novo");
  await presentation(page);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await expect(page.getByLabel("Nome do evento", { exact: false })).toHaveValue("Encontro de inovação");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await dates(page);
  await page.getByRole("button", { name: "Continuar sem palestrantes" }).click();
  await page.getByRole("button", { name: "Criar e publicar evento" }).click();
  await expect(page.getByText("Falha temporária na publicação.")).toBeVisible();
  await page.getByRole("button", { name: "Tentar concluir publicação" }).click();
  await expect(page).toHaveURL(new RegExp(`/painel\\?event=${id}$`));
  expect(controls.eventPosts).toBe(1); expect(controls.roomPosts).toBe(1); expect(controls.publishPosts).toBe(2);
});

test("palestrantes são paginados no celular sem estender o formulário", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 }); await setup(page); await page.goto("/painel/eventos/novo");
  await presentation(page); await dates(page);
  for (let index = 1; index <= 6; index += 1) {
    await page.getByRole("button", { name: "Adicionar palestrante", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Nome do palestrante", { exact: false }).fill(`Palestrante ${index}`);
    await dialog.getByRole("button", { name: "Salvar palestrante" }).click();
  }
  await expect(page.getByText("Palestrante 6", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(2);
  await noScroll(page);
  await page.getByRole("button", { name: "Palestrantes anteriores" }).click();
  await expect(page.getByText("Palestrante 4", { exact: true })).toBeVisible();
});
