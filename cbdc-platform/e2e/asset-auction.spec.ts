import { test, expect } from "@playwright/test";

// Bond creation = 4 sequential Pente txs; worst-case ~90s under load.
test.setTimeout(300_000);

test("operator creates a bond, publishes, allocates, settles", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@bi.go.id");
  await page.getByLabel("Password").fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/", { timeout: 20_000 });

  await page.goto("/admin/assets/new");
  await page.getByLabel("Name").fill("FR0100 Test");
  await page.getByLabel("Symbol / ISIN code").fill("FR0100");
  await page.getByLabel(/Maturity/).fill("1893456000");
  await page.getByLabel(/Coupon rate/).fill("600");
  await page.getByLabel(/Principal amount/).fill("1000000000");
  await page.getByRole("button", { name: /create asset/i }).click();
  await page.waitForURL("**/admin/assets", { timeout: 240_000 });
  await expect(page.getByText("FR0100 Test").first()).toBeVisible();
});
