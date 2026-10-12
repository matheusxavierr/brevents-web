import { expect, test } from "@playwright/test";

test("as prévias de Web Events alternam e abrem em um modal acessível", async ({ page }) => {
  await page.goto("/servicos/web-events");
  const gallery = page.getByRole("region", { name: "Conheça Web Events por dentro" });
  await expect(gallery.getByRole("img", { name: /Web Event fictício/ }).first()).toBeVisible();
  await gallery.getByRole("button", { name: "Lobby e rodadas 1:1" }).click();
  await expect(gallery.getByRole("button", { name: "Lobby e rodadas 1:1" })).toHaveAttribute("aria-pressed", "true");
  await expect(gallery.getByRole("img", { name: /Rodada de negócios fictícia/ }).first()).toBeVisible();
  await gallery.getByRole("button", { name: "Ampliar prévia" }).click();
  const dialog = page.getByRole("dialog", { name: "Lobby e rodadas 1:1" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Fechar prévia" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await gallery.getByRole("button", { name: "Painel do organizador" }).click();
  await expect(gallery.getByRole("img", { name: /Painel fictício/ }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quer realizar um evento pela plataforma?" })).toBeVisible();
});

test("home e serviços carregam imagens sem transbordar em celular e iPad", async ({ page }, testInfo) => {
  for (const [device, width, height] of [["mobile", 390, 844], ["ipad", 820, 1180]] as const) {
    await page.setViewportSize({ width, height });
    for (const route of ["/", "/servicos/web-events", "/servicos/meetings"]) {
      await page.goto(route);
      const pictures = page.locator('main img[src*="product-previews"]');
      await expect(pictures.first()).toBeVisible();
      for (const picture of await pictures.all()) {
        if (await picture.isVisible()) {
          await picture.scrollIntoViewIfNeeded();
          await expect.poll(() => picture.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        }
      }
      const overflow = await page.locator("main").evaluate(element => [...element.querySelectorAll("*")].filter(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
      }).map(node => node.tagName));
      expect(overflow).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath(`${device}-${route.replaceAll("/", "-") || "home"}.png`), fullPage: true, animations: "disabled" });
    }
  }
});
