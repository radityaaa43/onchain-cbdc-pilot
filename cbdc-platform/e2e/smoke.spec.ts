import { test, expect } from "@playwright/test";

test("login redirects to dashboard and shows KPI card", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@bi.go.id");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/Org CBDC Balance/i)).toBeVisible();
});
