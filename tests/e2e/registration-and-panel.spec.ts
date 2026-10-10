import { expect, test } from "@playwright/test";

test("cadastro conclui e redireciona para a página inicial", async ({ page }) => {
  await page.route("**/api/auth/register", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 42 }) });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
  });

  await page.goto("/criar-conta");
  await page.getByLabel("Nome completo").fill("Pessoa Teste");
  await page.getByLabel("E-mail").fill("pessoa@example.com");
  await page.getByLabel("Senha").fill("senha-teste-123");
  await page.getByRole("button", { name: "Criar minha conta" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("organizador adiciona palestrante pelo painel e recebe confirmação", async ({ page }) => {
  test.skip(!process.env.E2E_ORGANIZER_ACCESS, "Defina E2E_ORGANIZER_ACCESS com um token do organizador do ambiente de teste.");
  await page.context().addCookies([{ name: "brevents_access", value: process.env.E2E_ORGANIZER_ACCESS!, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001", httpOnly: true }]);
  let speakerCreated = false;
  const event = {
    id: "event-1", name: "Evento E2E", slug: "evento-e2e", description: "Teste", timezone: "America/Sao_Paulo",
    starts_at: "2026-10-10T15:00:00Z", ends_at: "2026-10-10T18:00:00Z", status: "draft", access_mode: "public",
    registration_open: true, public_config: { product_type: "web-event" },
  };
  const pageOf = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results });

  await page.route("**/api/auth/me", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 1, username: "organizador", name: "Organizador", first_name: "Org", last_name: "", email: "org@example.com", is_staff: false, is_superuser: false, account_type: "organizer" }) }));
  await page.route("**/api/backend/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend/", "");
    if (route.request().method() === "POST" && path === "speakers/") {
      speakerCreated = true;
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "speaker-1", event: event.id, name: "Marina Costa", email: "marina@example.com", bio: "Produto" }) });
    }
    if (path === "events/" && url.searchParams.get("managed") === "true") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageOf([event])) });
    if (path === "speakers/" && route.request().method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageOf(speakerCreated ? [{ id: "speaker-1", event: event.id, name: "Marina Costa", email: "marina@example.com", bio: "Produto" }] : [])) });
    if (path.startsWith("events/event-1/analytics")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ registrations: 0, confirmed_registrations: 0, unique_viewers: 0, total_visits: 0, chat_messages: 0, questions: 0, poll_votes: 0, rooms: [] }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(pageOf([])) });
  });

  await page.goto("/painel");
  await page.getByRole("button", { name: /Programação/i }).click();
  await page.getByRole("button", { name: "Palestrantes (0)" }).click();
  await page.getByRole("button", { name: "Adicionar palestrante", exact: true }).click();
  await page.getByPlaceholder("Nome").fill("Marina Costa");
  await page.getByPlaceholder("E-mail").fill("marina@example.com");
  await page.getByPlaceholder("Mini bio").fill("Produto");
  await page.getByRole("dialog", { name: "Adicionar palestrante" }).getByRole("button", { name: "Adicionar palestrante" }).click();
  await expect(page.getByText("Palestrante adicionado.")).toBeVisible();
  expect(speakerCreated).toBe(true);
});
