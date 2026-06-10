import { test, expect } from "@playwright/test";

// Requires APP_ROLE=participant server instance (port 3200) + seeded trader@bank.id.
// Run from onchain-cbdc-pilot-orgn/cbdc-platform: npm run start
// Seed: prisma/seed.ts — org `bank-xyz`, user `trader@bank.id` role TRADER
test.fixme("participant sees wallet KPIs", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("trader@bank.id");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/", { timeout: 15_000 });
  await page.goto("/participant/wallet");
  await expect(page.getByRole("heading", { name: /CBDC Wallet/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Balance Limit/i)).toBeVisible();
});
