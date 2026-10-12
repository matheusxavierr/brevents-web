import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  test.skip(!process.env.E2E_ORGANIZER_ACCESS || !process.env.E2E_EVENT_SLUG, "Defina um organizador e um evento publicado do ambiente local de teste.");
  const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001";
  await page.context().addCookies([{ name: "brevents_access", value: process.env.E2E_ORGANIZER_ACCESS!, url: baseURL, httpOnly: true }]);
  const response = await page.request.get(`http://127.0.0.1:8000/api/public/events/${process.env.E2E_EVENT_SLUG}/`);
  expect(response.ok()).toBe(true);
  const event = await response.json();
  await page.route("**/api/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.includes("/public/events/")) return route.fulfill({ json: { ...event, feature_flags: { ...event.feature_flags, networking_open: false } } });
    if (path.endsWith("/join-token/")) return route.fulfill({ json: { token: "test" } });
    if (path.endsWith("/registrations/") && route.request().method() === "POST") return route.fulfill({ status: 201, json: { id: "registration-test", event: event.id, status: "confirmed" } });
    return route.continue();
  });
  return event;
}

for (const viewport of [{ width: 1920, height: 953 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1024, height: 768 }, { width: 390, height: 844 }, { width: 390, height: 667 }]) {
  test(`página do evento ${viewport.width}x${viewport.height} usa abas e não rola a página`, async ({ page }) => {
    await page.setViewportSize(viewport); const event = await setup(page);
    await page.goto(`/eventos/${event.slug}`);
    await expect(page.getByRole("tab", { name: "Sobre o evento" })).toBeVisible();
    await page.getByRole("tab", { name: "Programação", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Programação do evento" })).toBeVisible();
    await page.getByRole("tab", { name: "Palestrantes", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Conheça quem vai apresentar" })).toBeVisible();
    expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight }))).toEqual({ x: true, y: true });
    await page.getByRole("tab", { name: "Sobre o evento" }).click();
    await page.screenshot({ path: `test-results/event-page-${viewport.width}x${viewport.height}.png`, fullPage: true, animations: "disabled" });
  });

  test(`lobby ${viewport.width}x${viewport.height} exibe auditório e rodadas fechadas`, async ({ page }) => {
    await page.setViewportSize(viewport); const event = await setup(page);
    await page.goto(`/eventos/${event.slug}/lobby`);
    await expect(page.getByRole("link", { name: "Entrar no auditório" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Aguardando abertura" })).toBeDisabled();
    expect(await page.evaluate(() => ({ x: document.documentElement.scrollWidth <= innerWidth, y: document.documentElement.scrollHeight <= innerHeight }))).toEqual({ x: true, y: true });
    await expect(page.getByRole("button", { name: "Aguardando abertura" })).toBeInViewport();
    expect(await page.getByRole("region", { name: "Destinos do lobby" }).evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/event-lobby-${viewport.width}x${viewport.height}.png`, fullPage: true, animations: "disabled" });
  });
}

test("a inscrição confirmada leva primeiro ao lobby", async ({ page }) => {
  const event = await setup(page);
  await page.goto(`/eventos/${event.slug}/inscricao`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Confirmar inscrição", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/eventos/${event.slug}/lobby$`));
  await expect(page.getByRole("link", { name: "Entrar no auditório" })).toBeVisible();
});
