import { expect, test, type Page } from "@playwright/test";

const campaign = {
  id: 31,
  orgId: 7,
  title: "Community Scholarship Campaign",
  description: "Help fund scholarships for local students.",
  status: "active",
  visibility: "public",
  type: "contribution",
  fields: [],
  requiresPayment: false,
  paymentAmount: 0,
  currency: "XAF",
  currentAmount: 0,
  goalAmount: null,
  startsAt: null,
  endsAt: null,
  organizationName: "Synthetic Organization",
};

async function mockCampaignApi(page: Page) {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    if (url.pathname === "/api/campaigns/31") return route.fulfill({ json: campaign });
    return route.fulfill({ status: 404, json: { error: `Unexpected request: ${url.pathname}` } });
  });
}

test("campaign copy includes resource context and its crawler-aware public link", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value: string) => { (window as any).__copiedShareText = value; } },
    });
  });
  await mockCampaignApi(page);

  await page.goto("/campaigns/31/participate");
  await page.getByRole("button", { name: "Share" }).click();
  await page.getByRole("button", { name: "Copy Link" }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__copiedShareText)).toBe(
    "Community Scholarship Campaign\n\nHelp fund scholarships for local students.\n\nhttp://roblyne.test/api/share/campaigns/31",
  );
});

test("native share receives one complete text payload without choosing an app", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => { (window as any).__nativeSharePayload = data; },
    });
  });
  await mockCampaignApi(page);

  await page.goto("/campaigns/31/participate");
  await page.getByRole("button", { name: "Share" }).click();

  await expect.poll(() => page.evaluate(() => (window as any).__nativeSharePayload)).toEqual({
    title: "Community Scholarship Campaign",
    text: "Community Scholarship Campaign\n\nHelp fund scholarships for local students.\n\nhttp://roblyne.test/api/share/campaigns/31",
  });
});
