import { expect, test, type Page } from "@playwright/test";

async function setup(page: Page) {
  test.skip(!process.env.E2E_ORGANIZER_ACCESS, "Defina um organizador local para acessar o painel.");
  await page.context().addCookies([{ name: "brevents_access", value: process.env.E2E_ORGANIZER_ACCESS!, url: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3001", httpOnly: true }]);
  const event = { id: "event", name: "Evento atual", slug: "evento-atual", status: "published", starts_at: "2026-10-18T18:30:00Z", ends_at: "2026-10-18T20:30:00Z", timezone: "America/Sao_Paulo", public_config: {}, feature_flags: {}, registration_open: true };
  const current = { id: "current-room", event: event.id, name: "Auditório atual", position: 1, purpose: "main", zoom_session: { configured: true } };
  const foreign = { ...current, id: "foreign-room", event: "other-event", position: 0 };
  const controls = { reject: false, payload: {} as Record<string, unknown> };
  await page.route("**/api/backend/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/backend/", "");
    if (path === "events/") return route.fulfill({ json: { results: [event], next: null } });
    if (path === "rooms/") return route.fulfill({ json: { results: [foreign, current], next: null } });
    if (path.endsWith("/analytics/")) return route.fulfill({ json: { registrations: 0, rooms: [] } });
    if (path === "sessions/" && route.request().method() === "POST") {
      controls.payload = route.request().postDataJSON();
      if (controls.reject) return route.fulfill({ status: 400, json: { ends_at: ["O término deve ser posterior ao início."] } });
      return route.fulfill({ status: 201, json: { id: "talk", ...controls.payload } });
    }
    return route.fulfill({ json: { results: [], next: null } });
  });
  await page.goto("/painel");
  await page.getByRole("button", { name: "Programação", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar à programação", exact: true }).click();
  return controls;
}

test("programação usa o auditório do evento atual mesmo com sala antiga na resposta", async ({ page }) => {
  const controls = await setup(page);
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título *").fill("Abertura do evento");
  await expect(dialog.getByLabel("Categoria (opcional)")).toBeVisible();
  await expect(dialog.getByText(/Pode deixá-la em branco/)).toBeVisible();
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Programação salva." })).toBeVisible();
  expect(controls.payload.event).toBe("event"); expect(controls.payload.room).toBe("current-room"); expect(controls.payload.track).toBe("");
});

test("erro de validação aparece dentro do modal e identifica o campo", async ({ page }) => {
  const controls = await setup(page); controls.reject = true;
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título *").fill("Abertura do evento");
  await dialog.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Término: O término deve ser posterior ao início.");
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(1);
  await expect(dialog.getByLabel("Título *")).toHaveValue("Abertura do evento");
});
