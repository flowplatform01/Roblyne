import { expect, test, type Page } from "@playwright/test";

async function mockFinanceWorkspace(page: Page, withdrawalStatus: 201 | 400) {
  let withdrawalRequests = 0;
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") return route.fulfill({ json: { id: 1, email: "owner@example.test", name: "Synthetic Owner", isPlatformAdmin: false } });
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [] });
    if (url.pathname === "/api/organizations/7") return route.fulfill({ json: { id: 7, name: "Synthetic Organization", description: null, role: "owner" } });
    if (url.pathname === "/api/organizations/7/stats") return route.fulfill({ json: {} });
    if (url.pathname === "/api/organizations/7/finance") {
      return route.fulfill({ json: {
        balancesByCurrency: [{ currency: "XAF", availableBalance: 100, pendingSettlementBalance: 0, releasedBalance: 0, totalRevenue: 100, totalCommissionPaid: 0, totalOrgEarnings: 100, transactionCount: 1 }],
        recentSettlements: [],
        byPillar: [],
      } });
    }
    if (url.pathname === "/api/organizations/7/finance/transactions") return route.fulfill({ json: { total: 0, transactions: [] } });
    if (url.pathname === "/api/organizations/7/finance/payout-destinations") {
      return route.fulfill({ json: [{
        id: 20,
        displayName: "Test Recipient",
        payoutMethod: "mobile_money",
        maskedTarget: "+237 67•••00",
        currency: "XAF",
        verificationStatus: "verified",
      }] });
    }
    if (url.pathname === "/api/organizations/7/finance/settlements" && route.request().method() === "GET") return route.fulfill({ json: [] });
    if (url.pathname === "/api/organizations/7/finance/settlements" && route.request().method() === "POST") {
      withdrawalRequests += 1;
      return route.fulfill(withdrawalStatus === 201
        ? { status: 201, json: { id: 12, amount: 50, currency: "XAF", status: "pending_settlement" } }
        : { status: 400, json: { error: "Requested amount exceeds the available balance" } });
    }
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });
  return () => withdrawalRequests;
}

async function openWithdrawalReview(page: Page) {
  await page.goto("/organizations/7?tab=finance");
  await page.getByLabel("Amount to withdraw").fill("50");
  await page.getByLabel("Verified payout recipient").click();
  await page.getByRole("option", { name: /Test Recipient/ }).click();
  await page.getByRole("button", { name: "Review payout" }).click();
  await expect(page.getByRole("heading", { name: "Confirm payout request" })).toBeVisible();
}

test("withdrawal failure is explicit and never reports success", async ({ page }) => {
  const withdrawalRequests = await mockFinanceWorkspace(page, 400);
  await openWithdrawalReview(page);
  await page.getByRole("button", { name: "Submit payout request" }).click();

  await expect(page.getByText("Withdrawal request failed", { exact: true })).toBeVisible();
  await expect(page.getByText("Requested amount exceeds the available balance", { exact: true })).toBeVisible();
  await expect(page.getByText("Withdrawal request submitted", { exact: true })).not.toBeVisible();
  expect(withdrawalRequests()).toBe(1);
});

test("withdrawal request success is submitted once and shown as pending", async ({ page }) => {
  const withdrawalRequests = await mockFinanceWorkspace(page, 201);
  await openWithdrawalReview(page);
  await page.getByRole("button", { name: "Submit payout request" }).click();

  await expect(page.getByText("Withdrawal request submitted", { exact: true })).toBeVisible();
  expect(withdrawalRequests()).toBe(1);
});
