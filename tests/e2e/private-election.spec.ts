import { expect, test, type Page } from "@playwright/test";

const election = {
  id: 42,
  orgId: 7,
  title: "Private Election Test",
  description: "Synthetic browser regression fixture.",
  visibility: "invite_only",
  status: "active",
  eligibilityMode: "open",
  requiresPayment: false,
  paymentAmount: null,
  currency: "XAF",
  startsAt: new Date(Date.now() - 60_000).toISOString(),
  endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  organizationName: "Synthetic Organization",
  inviteVerified: true,
};

async function mockElectionApi(page: Page) {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    if (url.pathname === "/api/elections/42/invite-verification" && request.method() === "POST") {
      expect(await request.postDataJSON()).toEqual({ inviteCode: "VALIDCODE" });
      return route.fulfill({ json: { verified: true } });
    }
    if (url.pathname === "/api/elections/42") {
      expect(url.searchParams.has("invite")).toBe(false);
      return route.fulfill({ json: election });
    }
    if (url.pathname === "/api/elections/42/positions") {
      expect(url.searchParams.has("invite")).toBe(false);
      return route.fulfill({ json: [{ id: 9, electionId: 42, title: "Chair", maxSelections: 1, sortOrder: 0 }] });
    }
    if (url.pathname === "/api/elections/42/candidates") {
      expect(url.searchParams.has("invite")).toBe(false);
      return route.fulfill({ json: [{ id: 12, electionId: 42, positionId: 9, name: "Candidate One" }] });
    }
    return route.fulfill({ status: 404, json: { error: `Unexpected request: ${url.pathname}` } });
  });
}

test("a shared private-election link verifies once and removes the invite secret", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await mockElectionApi(page);

  await page.goto("/elections/42/vote?invite=VALIDCODE");

  await expect(page.getByRole("heading", { name: "Private Election Test" })).toBeVisible();
  await expect(page.getByText("Candidate One")).toBeVisible();
  await expect(page.locator("#invite-code")).toHaveCount(0);
  await expect(page).toHaveURL(/\/elections\/42\/vote$/);
  expect(pageErrors).toEqual([]);
});

test("an invalid shared invite shows a recovery screen without exposing election data", async ({ page }) => {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/elections/42/invite-verification") {
      return route.fulfill({ status: 403, json: { error: "This invite code is invalid or no longer available" } });
    }
    return route.fulfill({ json: {} });
  });

  await page.goto("/elections/42/vote?invite=INVALID");

  await expect(page.getByRole("heading", { name: "This voting page needs access" })).toBeVisible();
  await expect(page.getByText("Private Election Test")).toHaveCount(0);
});
