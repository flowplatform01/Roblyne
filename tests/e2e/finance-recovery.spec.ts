import { expect, test } from "@playwright/test";

test("Finance shows a local recovery state when the summary request fails", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { id: 1, email: "owner@example.test", name: "Synthetic Owner", isPlatformAdmin: false } });
    }
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [] });
    if (url.pathname === "/api/organizations/7") {
      return route.fulfill({ json: { id: 7, name: "Synthetic Organization", description: null, role: "owner" } });
    }
    if (url.pathname === "/api/organizations/7/stats") return route.fulfill({ json: {} });
    if (url.pathname === "/api/organizations/7/finance") {
      return route.fulfill({ status: 503, json: { error: "Synthetic finance outage" } });
    }
    if (["/api/elections", "/api/events", "/api/campaigns"].includes(url.pathname)) return route.fulfill({ json: [] });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });

  await page.goto("/organizations/7?tab=finance");

  await expect(page.getByText("Financial data could not be loaded.")).toBeVisible();
  await expect(page.getByText("No balances or payouts are shown until the authoritative summary is available.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
