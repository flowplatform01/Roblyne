import { expect, test, type BrowserContext } from "@playwright/test";

const API = "http://roblyne.test";

// Lazy route chunks are compiled on first request by the Vite dev server, which
// can be slow on a cold run. Allow a generous window for the first assertion
// after each navigation before falling back to the default assertion timeout.
const COLD_START = { timeout: 30_000 };

type LegalDoc = {
  id: number;
  documentType: "terms" | "privacy";
  language: "en" | "fr";
  title: string;
  content: string;
  version: number;
  status: "published";
  effectiveAt: string;
  requiresReacceptance: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  languageFallback: boolean;
};

function legalDoc(overrides: Partial<LegalDoc> & Pick<LegalDoc, "id" | "documentType" | "language" | "title" | "content">): LegalDoc {
  return {
    version: 1,
    status: "published",
    effectiveAt: "2026-01-01T00:00:00.000Z",
    requiresReacceptance: false,
    publishedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    languageFallback: false,
    ...overrides,
  };
}

const termsEn = legalDoc({ id: 101, documentType: "terms", language: "en", title: "ROBLYNE Terms of Service", content: "English terms content for testing." });
const privacyEn = legalDoc({ id: 102, documentType: "privacy", language: "en", title: "ROBLYNE Privacy Policy", content: "English privacy content for testing." });
const termsFr = legalDoc({ id: 201, documentType: "terms", language: "fr", title: "Conditions d'utilisation de ROBLYNE", content: "Contenu français des conditions d'utilisation." });
const privacyFr = legalDoc({ id: 202, documentType: "privacy", language: "fr", title: "Politique de confidentialité de ROBLYNE", content: "Contenu français de la politique de confidentialité." });

/** Routes every API call, letting a test override specific endpoints (including by query). */
async function installApiMocks(context: BrowserContext, override?: (url: URL) => unknown) {
  await context.route(`${API}/api/**`, async (route) => {
    const url = new URL(route.request().url());
    const custom = override?.(url);
    if (custom !== undefined) return route.fulfill({ json: custom });
    if (url.pathname === "/api/auth/me") return route.fulfill({ status: 401, json: { error: "Not authenticated" } });
    if (url.pathname === "/api/discover") return route.fulfill({ json: { items: [], featured: [], trending: [] } });
    if (url.pathname === "/api/auth/providers") return route.fulfill({ json: {} });
    return route.fulfill({ json: {} });
  });
}

function requirementsFor(language: "en" | "fr") {
  return {
    requestedLanguage: language,
    documents: language === "fr" ? [termsFr, privacyFr] : [termsEn, privacyEn],
    missingDocumentTypes: [],
  };
}

function useLanguage(page: import("@playwright/test").Page, language: "en" | "fr") {
  return page.addInitScript((value) => localStorage.setItem("i18nextLng", value), language);
}

test("English registration localizes legal acceptance and drops internal version wording", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/requirements") return requirementsFor("en");
  });
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create an Account" })).toBeVisible(COLD_START);
  await expect(page.getByText(/I have read and accept the/).first()).toBeVisible();
  await expect(page.getByText("ROBLYNE Terms of Service")).toBeVisible();
  await expect(page.getByText(/version/i)).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("French registration localizes legal acceptance and drops internal version wording", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/requirements") return requirementsFor("fr");
  });
  await useLanguage(page, "fr");
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible(COLD_START);
  await expect(page.getByText(/J'ai lu et j'accepte les/).first()).toBeVisible();
  await expect(page.getByText("Conditions d'utilisation de ROBLYNE")).toBeVisible();
  await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-label", "Accepter Conditions d'utilisation de ROBLYNE");
  await expect(page.getByText(/version/i)).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("switching language updates the registration copy in place", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/requirements") return requirementsFor(url.searchParams.get("lang") === "fr" ? "fr" : "en");
  });
  await page.goto("/register");

  await expect(page.getByRole("heading", { name: "Create an Account" })).toBeVisible(COLD_START);
  await page.getByRole("button", { name: /switch language/i }).click();

  await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();
  await expect(page.getByText("Conditions d'utilisation de ROBLYNE")).toBeVisible();
});

test("English legal document opens from registration in a new tab", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/requirements") return requirementsFor("en");
    if (url.pathname === "/api/legal/terms") return termsEn;
  });
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "ROBLYNE Terms of Service" })).toBeVisible(COLD_START);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "ROBLYNE Terms of Service" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();

  await expect(popup.getByText("ROBLYNE Terms of Service")).toBeVisible(COLD_START);
  await expect(popup.getByText(/English terms content for testing/)).toBeVisible();
  await expect(popup.getByRole("note")).toHaveCount(0);
});

test("French legal document opens from registration in a new tab", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/requirements") return requirementsFor("fr");
    if (url.pathname === "/api/legal/terms") return termsFr;
  });
  await useLanguage(page, "fr");
  await page.goto("/register");
  await expect(page.getByRole("link", { name: "Conditions d'utilisation de ROBLYNE" })).toBeVisible(COLD_START);

  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: "Conditions d'utilisation de ROBLYNE" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();

  await expect(popup.getByText("Conditions d'utilisation de ROBLYNE")).toBeVisible(COLD_START);
  await expect(popup.getByText(/Contenu français des conditions d'utilisation/)).toBeVisible();
});

test("a missing French version shows a clearly identified English fallback", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/legal/terms") return { ...termsEn, languageFallback: true, requestedLanguage: "fr" };
  });
  await useLanguage(page, "fr");
  await page.goto("/legal/terms");

  await expect(page.getByText("ROBLYNE Terms of Service")).toBeVisible(COLD_START);
  await expect(page.getByRole("note")).toContainText("pas encore disponible dans la langue sélectionnée");
  await expect(page.getByRole("note")).toContainText("anglaise");
});

test("social sign-in is localized and gated on legal acceptance", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/auth/providers") return { google: true };
    if (url.pathname === "/api/legal/requirements") return requirementsFor("en");
  });
  await page.goto("/register");

  const google = page.getByRole("button", { name: "Continue with Google" });
  await expect(google).toBeVisible(COLD_START);
  await expect(google).toBeDisabled();
  await expect(page.getByText("Accept the Terms of Service and Privacy Policy to continue with social sign-in.")).toBeVisible();
});

test("social sign-in button is localized in French", async ({ page, context }) => {
  await installApiMocks(context, (url) => {
    if (url.pathname === "/api/auth/providers") return { google: true };
    if (url.pathname === "/api/legal/requirements") return requirementsFor("fr");
  });
  await useLanguage(page, "fr");
  await page.goto("/register");

  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible(COLD_START);
  await expect(page.getByText("Acceptez les Conditions d'utilisation et la Politique de confidentialité pour continuer via une connexion sociale.")).toBeVisible();
});

test("password recovery is localized in French", async ({ page, context }) => {
  await installApiMocks(context);
  await useLanguage(page, "fr");
  await page.goto("/password-reset");

  await expect(page.getByRole("heading", { name: "Réinitialiser votre mot de passe" })).toBeVisible(COLD_START);
  await expect(page.getByLabel("Adresse e-mail")).toBeVisible();
  await expect(page.getByRole("button", { name: "Envoyer le code" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Retour à la connexion" })).toBeVisible();
});

test.describe("mobile onboarding layout", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("login and registration do not overflow horizontally", async ({ page, context }) => {
    await installApiMocks(context, (url) => {
      if (url.pathname === "/api/legal/requirements") return requirementsFor("en");
    });

    for (const path of ["/login", "/register"]) {
      await page.goto(path);
      await expect(page.getByRole("main")).toBeVisible(COLD_START);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(1);
    }
  });
});
