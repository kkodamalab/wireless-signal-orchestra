import { test, expect } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
test("local HTTP to WebSocket simulation and real reconnect", async ({
  page,
}, info) => {
  const port = info.project.name === "desktop" ? 8010 : 8011,
    ws = port + 100;
  let child: ChildProcess | undefined;
  const start = async () => {
    child = spawn(
      process.env.BRIDGE_PYTHON ?? "python",
      [
        "bridge/server.py",
        "--simulate",
        "--http-port",
        String(port),
        "--ws-port",
        String(ws),
      ],
      { stdio: "pipe" },
    );
    await expect
      .poll(async () => {
        try {
          return (await fetch(`http://127.0.0.1:${port}/`)).status;
        } catch {
          return 0;
        }
      })
      .toBe(200);
  };
  const stop = async () => {
    if (child && child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  };
  try {
    await start();
    await page.goto(`http://127.0.0.1:${port}/wireless-signal-orchestra/`);
    await page.getByRole("button", { name: "DEVICES", exact: true }).click();
    await page.locator("#mode").selectOption("ble");
    await page.locator("#ws").fill(`ws://127.0.0.1:${ws}`);
    await page.locator("#connect").click();
    await expect(page.locator("#connection")).toHaveText("接続済み");
    await expect(page.locator(".signal")).toHaveCount(3);
    await expect(page.locator("#badge")).toContainText("SIMULATION");
    await expect(page.locator(".signal").first()).toContainText("SIMULATED");
    await stop();
    await expect(page.locator("#connection")).toContainText("再接続");
    await start();
    await expect(page.locator("#connection")).toHaveText("接続済み", {
      timeout: 8000,
    });
    await expect(page.locator(".signal").first()).toContainText("受信中");
  } finally {
    await stop();
  }
});
