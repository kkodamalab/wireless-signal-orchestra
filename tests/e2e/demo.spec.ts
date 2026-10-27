import { test, expect } from "@playwright/test";
test("demo, audio, settings, timeout and responsive stage", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await expect(page.getByText("● DEMO / 仮想信号")).toBeVisible();
  await expect(page.locator(".signal")).toHaveCount(3);
  await page.getByRole("button", { name: "▶ 音声を開始" }).click();
  await expect(page.getByText("音声出力中", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "DEMO", exact: true }).click();
  await page.locator("#count").selectOption("5");
  await expect(page.locator("#demo-edit article")).toHaveCount(5);
  await page.locator("#auto").uncheck();
  await page.locator("#rssi-0").fill("-90");
  await expect(page.locator("#rssi-0-out")).toHaveText("-90");
  await page.locator("#loss-0").click();
  await page.getByRole("button", { name: "STAGE", exact: true }).click();
  await expect(page.locator(".signal").first()).toContainText("受信途絶", {
    timeout: 6000,
  });
  await page.getByRole("button", { name: "SOUND", exact: true }).click();
  await page.locator("#sound-1-pan").fill("0.5");
  await expect(page.locator("#sound-1-pan-out")).toHaveText("0.5");
  await page.getByRole("button", { name: "DEBUG", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV保存" }).click();
  expect((await download).suggestedFilename()).toBe("signal-orchestra.csv");
  await page.getByRole("button", { name: "パネルを隠す", exact: true }).click();
  await expect(page.locator("#show")).toBeVisible();
  await page.locator("#show").click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
