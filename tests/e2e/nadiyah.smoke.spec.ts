import { expect, test } from "@playwright/test";

test("practice mode boots, starts active combat, and shows readable HUD", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nadiyah Fights" })).toBeVisible();
  await page.getByRole("button", { name: "Practice Bot" }).click();
  await expect(page.locator("#roomCode")).not.toHaveText("------");
  await page.getByRole("button", { name: "Mark Ready" }).click();
  await expect(page.locator("#roundState")).toContainText(/COUNTDOWN|ACTIVE/);
  await expect(page.locator("#hud-root")).toHaveAttribute("data-fighter-count", "2");
  await page.waitForTimeout(1800);
  await expect(page.locator("#roundState")).toContainText("ACTIVE");
  await page.keyboard.down("D");
  await page.waitForTimeout(300);
  await page.keyboard.up("D");
  const localX = Number(await page.locator("#hud-root").evaluate((element) => (element as HTMLElement).dataset.localX ?? "0"));
  expect(localX).toBeGreaterThan(0);
  await page.keyboard.press("J");
  await page.waitForTimeout(500);
  const screenshotPath = testInfo.outputPath("practice-active.png");
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach("practice-active", { path: screenshotPath, contentType: "image/png" });
});

test("host and join lobby smoke", async ({ browser }) => {
  test.setTimeout(60_000);
  const hostPage = await browser.newPage();
  const guestPage = await browser.newPage();

  await hostPage.goto("/");
  await hostPage.getByRole("button", { name: "Host Lobby" }).click();
  await expect(hostPage.locator("#roomCode")).not.toHaveText("------");
  const code = (await hostPage.locator("#roomCode").textContent())?.trim() ?? "";
  expect(code).toHaveLength(6);

  await guestPage.goto("/");
  await guestPage.getByRole("button", { name: "Browse Lobbies" }).click();
  await expect(guestPage.locator("#lobbyListRows")).toContainText(code);
  await guestPage.locator("#joinCodeInput").fill(code);
  await guestPage.getByRole("button", { name: "Join By Code" }).click();
  await expect(guestPage.locator("#roomCode")).toHaveText(code);

  await hostPage.getByRole("button", { name: "Mark Ready" }).click();
  await guestPage.getByRole("button", { name: "Mark Ready" }).click();
  await expect(hostPage.locator("#roundState")).toContainText(/COUNTDOWN|ACTIVE/);
  await expect(guestPage.locator("#roundState")).toContainText(/COUNTDOWN|ACTIVE/);

  await hostPage.close();
  await guestPage.close();
});

test("active HUD controls stay inside key viewports", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Practice Bot" }).click();
  await page.getByRole("button", { name: "Mark Ready" }).click();
  await expect(page.locator("#roundState")).toContainText(/COUNTDOWN|ACTIVE/);
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1024, height: 768 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const boxes = await page.evaluate(() => [".top-strip", ".controls-chip", "#waitingPanel"].map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      const rect = element?.getBoundingClientRect();
      return { selector, hidden: element?.hidden ?? true, left: rect?.left ?? 0, right: rect?.right ?? 0, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0 };
    }));
    for (const box of boxes.filter((item) => !item.hidden)) {
      expect(box.left, `${viewport.width} ${box.selector} left`).toBeGreaterThanOrEqual(0);
      expect(box.right, `${viewport.width} ${box.selector} right`).toBeLessThanOrEqual(viewport.width);
      expect(box.top, `${viewport.width} ${box.selector} top`).toBeGreaterThanOrEqual(0);
      expect(box.bottom, `${viewport.width} ${box.selector} bottom`).toBeLessThanOrEqual(viewport.height);
    }
  }
});
