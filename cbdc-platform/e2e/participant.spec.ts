import { test, expect } from "@playwright/test";

// Run with APP_ROLE=participant and a seeded participant user.
// Seed: prisma/seed.ts — org `bank-xyz`, user `trader@bank.id` role TRADER
test("participant sees wallet KPIs", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("trader@bank.id");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.goto("/participant/wallet");
  await expect(page.getByRole("heading", { name: /CBDC Wallet/i })).toBeVisible();
  await expect(page.getByText(/Balance Limit/i)).toBeVisible();
});
