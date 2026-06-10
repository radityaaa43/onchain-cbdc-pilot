import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1, // Pente txs are sequential; parallel workers cause timeout
  use: { baseURL: "http://localhost:3100" },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3100",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
