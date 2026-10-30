import { expect, test, type Page } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLzWQAAAABJRU5ErkJggg==",
  "base64",
);

function createOrganizationFixture() {
  let organization = {
    id: 7,
    name: "Synthetic Organization",
    description: "Initial description",
    website: null,
    logoUrl: null,
    coverImageUrl: null,
    heroImageUrl: null,
    accentColor: null,
    theme: "evenum",
    role: "owner",
  };
  let savedBodies: Record<string, unknown>[] = [];

  return {
    organization: () => organization,
    savedBodies: () => savedBodies,
    save: (body: Record<string, unknown>) => {
      savedBodies.push(body);
      organization = { ...organization, ...body };
      return organization;
    },
  };
}

async function mockWorkspaceApi(page: Page, fixture: ReturnType<typeof createOrganizationFixture>) {
  await page.route("http://roblyne.test/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/auth/me") {
      return route.fulfill({ json: { id: 1, email: "owner@example.test", name: "Synthetic Owner", isPlatformAdmin: false } });
    }
    if (url.pathname === "/api/organizations") return route.fulfill({ json: [fixture.organization()] });
    if (url.pathname === "/api/organizations/7" && route.request().method() === "GET") return route.fulfill({ json: fixture.organization() });
    if (url.pathname === "/api/organizations/7" && route.request().method() === "PATCH") {
      return route.fulfill({ json: fixture.save(route.request().postDataJSON()) });
    }
    if (url.pathname === "/api/organizations/7/stats") return route.fulfill({ json: {} });
    if (url.pathname === "/api/admin/platform-settings/public") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });
}

test("organization image upload saves and persists after reload", async ({ page }) => {
  const fixture = createOrganizationFixture();
  const requests: string[] = [];
  await mockWorkspaceApi(page, fixture);
  await page.route("http://storage.test/**", async (route) => {
    requests.push(route.request().method());
    await route.fulfill({ status: 200 });
  });
  await page.route("http://roblyne.test/api/uploads/presign", async (route) => {
    requests.push(route.request().method());
    await route.fulfill({ json: { uploadUrl: "http://storage.test/images/logo.png", publicUrl: "https://cdn.test/images/logo.png" } });
  });

  await page.goto("/organizations/7?tab=settings");
  await page.locator('input[type="file"]').first().setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });

  await expect.poll(() => requests).toEqual(["POST", "PUT"]);
  await expect(page.getByText("Uploading…")).not.toBeVisible();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
  expect(fixture.savedBodies()).toHaveLength(1);
  expect(fixture.organization().logoUrl).toBe("https://cdn.test/images/logo.png");

  await page.reload();
  await expect(page.locator('img[alt="Upload preview"]').first()).toHaveAttribute("src", "https://cdn.test/images/logo.png");
});

test("failed object upload clears the loading state and can be retried", async ({ page }) => {
  const fixture = createOrganizationFixture();
  let uploadAttempts = 0;
  await mockWorkspaceApi(page, fixture);
  await page.route("http://roblyne.test/api/uploads/presign", async (route) => {
    await route.fulfill({ json: { uploadUrl: "http://storage.test/images/logo.png", publicUrl: "https://cdn.test/images/logo.png" } });
  });
  await page.route("http://storage.test/**", async (route) => {
    uploadAttempts += 1;
    await route.fulfill(uploadAttempts === 1 ? { status: 403 } : { status: 200 });
  });

  await page.goto("/organizations/7?tab=settings");
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Image upload failed. Please try again.")).toBeVisible();
  await expect(page.getByText("Uploading…")).not.toBeVisible();

  await fileInput.setInputFiles({ name: "replacement.png", mimeType: "image/png", buffer: png });
  await expect.poll(() => uploadAttempts).toBe(2);
  await expect(page.getByText("Uploading…")).not.toBeVisible();
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Settings saved", { exact: true })).toBeVisible();
});
