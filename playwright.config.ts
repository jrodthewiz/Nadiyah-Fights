import { defineConfig } from "@playwright/test";

const serverPort = process.env.NADIYAH_TEST_SERVER_PORT ?? "2677";
const clientPort = process.env.NADIYAH_TEST_CLIENT_PORT ?? "5283";
const serverUrl = `http://localhost:${serverPort}`;
const clientUrl = `http://localhost:${clientPort}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: clientUrl,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev:server",
      url: `${serverUrl}/api/health`,
      env: { PORT: serverPort },
      reuseExistingServer: true,
      timeout: 25_000,
    },
    {
      command: `npm run dev:client -- --port ${clientPort}`,
      url: clientUrl,
      env: { VITE_SERVER_URL: serverUrl },
      reuseExistingServer: true,
      timeout: 25_000,
    },
  ],
});
