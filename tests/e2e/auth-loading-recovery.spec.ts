import { expect, test } from "@playwright/test";

test("Get Started exits the auth skeleton when session restoration hangs", async ({ page }) => {
  await page.route("http://roblyne.test/api/auth/me", async () => {
    await new Promise(() => undefined);
  });

  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).first().click();

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel("Preparing ROBLYNE")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("could not restore your session", { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  await expect(page.getByLabel("Preparing ROBLYNE")).toHaveCount(0);
});

test("Get Started preserves the existing-session redirect", async ({ page }) => {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { id: 1, email: "member@example.test", name: "Member", isPlatformAdmin: false } });
    }
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [] });
    if (url.pathname === "/api/discover") return route.fulfill({ json: { items: [], featured: [], trending: [] } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });

  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).first().click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /your organizations/i })).toBeVisible();
  await expect(page.getByLabel("Preparing ROBLYNE")).toHaveCount(0);
});

test("a returning user reaches the dashboard while session revalidation is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('roblyne:auth-snapshot', JSON.stringify({
      id: 7,
      email: 'returning@example.test',
      name: 'Returning user',
      avatarUrl: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      isPlatformAdmin: false,
    }));
  });
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") await new Promise(() => undefined);
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [] });
    if (url.pathname === "/api/discover") return route.fulfill({ json: { items: [], featured: [], trending: [] } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });

  await page.goto("/");
  await page.getByRole("link", { name: /get started/i }).first().click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: /your organizations/i })).toBeVisible();
  await expect(page.getByLabel("Preparing ROBLYNE")).toHaveCount(0);
});
