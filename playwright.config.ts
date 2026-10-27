import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  use: {
    launchOptions: { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH },
    baseURL: "http://127.0.0.1:5173/wireless-signal-orchestra/",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://127.0.0.1:5173/wireless-signal-orchestra/",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
});
