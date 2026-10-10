import { expect, test, type Page } from "@playwright/test";

const event = { id: "event-1", name: "Conexões 2026", slug: "conexoes", starts_at: "2026-10-10T15:00:00Z", ends_at: "2026-10-10T18:00:00Z", timezone: "America/Sao_Paulo", status: "published", description: "Um encontro de ideias e negócios.", registration_open: true, access_mode: "registration", public_config: {}, branding: {}, feature_flags: {} };
const room = { id: "main", event: event.id, name: "Auditório principal", description: "", mode: "event", purpose: "main", position: 0, module_config: [], zoom_session: { id: 1, configured: true, is_live: true } };
const pageOf = (results: unknown[], next: string | null = null) => ({ count: results.length, next, previous: null, results });
async function mockDashboard(page: Page) {
  test.skip(!process.env.E2E_ORGANIZER_ACCESS, "Defina E2E_ORGANIZER_ACCESS com um token do organizador do ambiente de teste.");
  await page.context().addCookies([{ name: "brevents_access", value: process.env.E2E_ORGANIZER_ACCESS!, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001", httpOnly: true }]);
  const poll = { id: "poll-1", room: room.id, question: "Qual tema você quer explorar?", state: "open", total_votes: 8, show_results_before_close: true, options: [{ id: "a", text: "Inovação", votes: 6 }, { id: "b", text: "Negócios", votes: 2 }] };
  let deleted = false;
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { id: 1, username: "org", name: "Organizador", first_name: "Org", account_type: "organizer", is_staff: false } }));
  await page.route("**/api/backend/**", (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/backend/", "");
    const method = route.request().method();
    if (path === "events/") return route.fulfill({ json: pageOf([event]) });
    if (path.includes("analytics")) return route.fulfill({ json: {
      event_id: event.id, generated_at: "2026-10-10T16:00:00Z", registrations: 12, confirmed_registrations: 10, unique_viewers: 8, total_visits: 24, chat_messages: 32, questions: 5, answered_questions: 3, polls: 1, poll_votes: 8, poll_voters: 8, live_duration_seconds: 3600, average_duration_seconds: 1240, is_live: true,
      registration_statuses: { confirmed: 10, pending: 2 }, daily_activity: [{ date: "2026-10-08", registrations: 4, visits: 8, messages: 10, networking: 1 }, { date: "2026-10-09", registrations: 8, visits: 16, messages: 22, networking: 2 }],
      networking: { invitations: 5, accepted: 4, realized: 3, completed: 2, participants: 6, statuses: { pending: 1, accepted: 2, ended: 2 }, conversations: [] },
      rooms: [{ room_id: room.id, room_name: room.name, purpose: "main", unique_viewers: 8, visits: 24, average_duration: "1240", chat_messages: 32, questions: 5 }],
    } });
    if (path === "rooms/") return route.fulfill({ json: pageOf([room]) });
    if (path === "registrations/") {
      const registrations = Array.from({ length: 12 }, (_, index) => ({ id: `reg-${index}`, name: `Pessoa ${String(index + 1).padStart(2, "0")}`, email: `pessoa${index + 1}@example.com`, user: index + 1, status: "confirmed", created_at: "2026-10-09T15:00:00Z", profile: { company: index === 11 ? "Aurora" : "Acme", role: "Diretoria" } }));
      return route.fulfill({ json: pageOf(registrations) });
    }
    if (path === "polls/") return route.fulfill({ json: pageOf(deleted ? [] : [poll]) });
    if (path === "polls/poll-1/" && method === "DELETE") { deleted = true; return route.fulfill({ status: 204 }); }
    return route.fulfill({ json: pageOf([]) });
  });
}

test("painel exibe preparo real e navegação sem scroll da página", async ({ page }) => {
  await mockDashboard(page); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto("/painel");
  await expect(page.getByText("Preparação do evento")).toBeVisible();
  await expect(page.getByText("4/4", { exact: true })).toBeVisible();
  await expect(page.getByText("Agenda publicada")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Eventos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gravações", exact: true })).toBeDisabled();
  await page.getByLabel("Gravações: em breve").hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight)).toBe(true);
  await page.screenshot({ path: "test-results/dashboard-overview.png", fullPage: true });
  await page.getByRole("button", { name: "Participantes", exact: true }).click();
  await expect(page.getByRole("row")).toHaveCount(11);
  await page.getByRole("button", { name: "Próxima página" }).click();
  await expect(page.getByText("Pessoa 12", { exact: true })).toBeVisible();
  await page.getByRole("searchbox").fill("Aurora");
  await expect(page.getByRole("row")).toHaveCount(2);
  await page.getByRole("button", { name: "Resultados", exact: true }).click();
  await expect(page.getByRole("img", { name: /Atividade diária/ })).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard-analytics.png", fullPage: true });
  await page.getByRole("button", { name: "Rodadas de negócios", exact: true }).click();
  await expect(page.getByText("Do convite à conversa", { exact: true })).toBeVisible();
});

test("enquete exibe resultados e exclusão exige confirmação", async ({ page }) => {
  await mockDashboard(page); await page.goto("/painel");
  await page.getByRole("button", { name: "Interações", exact: true }).click();
  await expect(page.getByText("6 · 75%")).toBeVisible();
  await page.getByRole("button", { name: /Excluir enquete/ }).click();
  await expect(page.getByRole("dialog", { name: "Excluir esta interação?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByText("Qual tema você quer explorar?", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Excluir enquete/ }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByText("Interação excluída.")).toBeVisible();
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1024, height: 768 }]) {
  test(`painel responsivo ${viewport.width}px mantém a página fixa`, async ({ page }) => {
    await page.setViewportSize(viewport); await mockDashboard(page); await page.goto("/painel");
    await expect(page.getByText("Preparação do evento")).toBeVisible();
    expect(await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth <= window.innerWidth, vertical: document.documentElement.scrollHeight <= window.innerHeight }))).toEqual({ horizontal: true, vertical: true });
    const selector = await page.getByLabel("Evento selecionado").boundingBox();
    expect(selector!.x + selector!.width).toBeLessThanOrEqual(viewport.width);
    await expect(page.getByRole("link", { name: "Novo evento", exact: true })).toBeInViewport();
    await page.screenshot({ path: `test-results/dashboard-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Configurações", exact: true }).click();
    await expect(page.getByText("Informações do evento", { exact: true })).toBeVisible();
  });
}
