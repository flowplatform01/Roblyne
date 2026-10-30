import { expect, test, type Page } from "@playwright/test";

const event = {
  id: 42,
  orgId: 7,
  title: "Invite-Only Event Test",
  description: "Synthetic browser regression fixture.",
  visibility: "invite_only",
  status: "published",
  isOnline: false,
  location: "Test venue",
  startsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  capacity: null,
  organizationName: "Synthetic Organization",
  inviteVerified: true,
};

async function mockInviteEventApi(page: Page) {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    if (url.pathname === "/api/events/42/invite-verification" && request.method() === "POST") {
      expect(await request.postDataJSON()).toEqual({ inviteCode: "VALIDCODE" });
      return route.fulfill({ json: { verified: true } });
    }
    if (url.pathname === "/api/events/42") {
      expect(url.searchParams.has("invite")).toBe(false);
      return route.fulfill({ json: event });
    }
    if (url.pathname === "/api/events/42/ticket-types") {
      expect(url.searchParams.has("invite")).toBe(false);
      return route.fulfill({ json: [{ id: 9, eventId: 42, name: "General Admission", price: 0, currency: "XAF", quantity: null, sold: 0 }] });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected request: ${url.pathname}` } });
  });
}

test("a shared invite-only event link verifies once and removes the invite secret", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockInviteEventApi(page);

  await page.goto("/events/42/register?invite=VALIDCODE");

  await expect(page.getByRole("heading", { name: "Invite-Only Event Test" })).toBeVisible();
  await expect(page.getByText("General Admission")).toBeVisible();
  await expect(page).toHaveURL(/\/events\/42\/register$/);
  expect(pageErrors).toEqual([]);
});

test("an invalid event invite shows a recovery screen without exposing event data", async ({ page }) => {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/events/42/invite-verification") {
      return route.fulfill({ status: 403, json: { error: "This invite code is invalid or no longer available" } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto("/events/42/register?invite=INVALID");

  await expect(page.getByRole("heading", { name: "This registration page needs access" })).toBeVisible();
  await expect(page.getByText("Invite-Only Event Test")).toHaveCount(0);
});
