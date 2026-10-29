import { expect, test } from "@playwright/test";

const discoveryItem = {
  id: 1,
  type: "election",
  title: "Synthetic discovery item",
  description: "Synthetic content for the browser loading check.",
  coverImageUrl: null,
  organizationName: "Synthetic Organization",
  status: "active",
  startsAt: null,
  endsAt: null,
  participantsCount: 1,
  createdAt: "2026-10-30T00:00:00.000Z",
};

test("home shell renders before its bounded discovery request completes", async ({ page }) => {
  let discoveryRequested = false;
  let discoveryResponded = false;
  let releaseDiscovery: (() => void) | undefined;
  const discoveryGate = new Promise<void>((resolve) => {
    releaseDiscovery = resolve;
  });

  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/discover") {
      discoveryRequested = true;
      expect(url.searchParams.get("limit")).toBe("12");
      await discoveryGate;
      discoveryResponded = true;
      return route.fulfill({
        json: { items: [discoveryItem], featured: [discoveryItem], trending: [discoveryItem] },
      });
    }
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Unauthenticated" } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect.poll(() => discoveryRequested).toBe(true);
  await expect(page.locator("h1").first()).toBeVisible();
  expect(discoveryResponded).toBe(false);

  releaseDiscovery?.();
  await expect(page.getByRole("link", { name: discoveryItem.title }).first()).toBeVisible();
});

test("finance entry does not fetch inactive engine lists", async ({ page }) => {
  const engineListRequests: string[] = [];

  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (["/api/elections", "/api/events", "/api/campaigns"].includes(url.pathname)) {
      engineListRequests.push(url.pathname);
      return route.fulfill({ json: [] });
    }
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { id: 1, email: "owner@example.test", name: "Synthetic Owner", isPlatformAdmin: false } });
    }
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [] });
    if (url.pathname === "/api/organizations/7") {
      return route.fulfill({ json: { id: 7, name: "Synthetic Organization", description: null, role: "owner" } });
    }
    if (url.pathname === "/api/organizations/7/stats") return route.fulfill({ json: {} });
    if (url.pathname === "/api/organizations/7/finance") return route.fulfill({ status: 503, json: { error: "Synthetic finance outage" } });
    if (url.pathname.startsWith("/api/organizations/7/transactions") || url.pathname.startsWith("/api/organizations/7/settlements")) return route.fulfill({ json: [] });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });

  await page.goto("/organizations/7?tab=finance");
  await expect(page.getByText("Financial data could not be loaded.")).toBeVisible();
  expect(engineListRequests).toEqual([]);
});
