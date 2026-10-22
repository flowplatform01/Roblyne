import { useEffect, useRef } from "react";

interface PageMetaOptions {
  title: string;
  description: string;
  image?: string | null;
  /** og:type — defaults to "website" */
  type?: string;
  /** Canonical URL — defaults to window.location.href */
  url?: string;
}

const DEFAULT_TITLE = "ROBYNE — Organized Participation";
const DEFAULT_DESC =
  "A unified system for elections, events, and campaigns. Controlled, precise, and built for serious organizations.";

function setMeta(
  attr: "property" | "name",
  value: string,
  content: string,
): void {
  let el = document.querySelector(
    `meta[${attr}="${value}"]`,
  ) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, value);
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMeta(attr: "property" | "name", value: string): void {
  const el = document.querySelector(`meta[${attr}="${value}"]`);
  if (el) el.parentNode?.removeChild(el);
}

/**
 * Centralized page metadata hook.
 *
 * Sets document.title and all Open Graph + Twitter Card meta tags whenever
 * the options change.  On unmount, resets to the default ROBYNE branding so
 * navigating away doesn't leave stale meta on subsequent pages that omit
 * the hook.
 *
 * Usage:
 *   usePageMeta({
 *     title: "Vote for Sarah Johnson — Student Union",
 *     description: "Cast your vote in the 2026 Student Union election.",
 *     image: candidate.photoUrl,
 *     url: window.location.href,
 *   });
 */
export function usePageMeta(options: PageMetaOptions | null): void {
  const prevRef = useRef<PageMetaOptions | null>(null);

  useEffect(() => {
    if (!options) return;

    prevRef.current = options;

    const { title, description, image, type = "website", url } = options;
    const canonicalUrl = url ?? window.location.href;
    const fullTitle = title.endsWith("ROBYNE")
      ? title
      : `${title} | ROBYNE`;

    document.title = fullTitle;

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:type", type);
    setMeta("property", "og:site_name", "ROBYNE");

    if (image) {
      setMeta("property", "og:image", image);
      setMeta("name", "twitter:card", "summary_large_image");
      setMeta("name", "twitter:image", image);
    } else {
      removeMeta("property", "og:image");
      setMeta("name", "twitter:card", "summary");
      removeMeta("name", "twitter:image");
    }

    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "description", description);

    // Canonical link
    let canonical = document.querySelector(
      'link[rel="canonical"]',
    ) as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [options?.title, options?.description, options?.image, options?.type, options?.url]);

  // Reset to defaults on unmount
  useEffect(() => {
    return () => {
      document.title = DEFAULT_TITLE;
      setMeta("property", "og:title", DEFAULT_TITLE);
      setMeta("property", "og:description", DEFAULT_DESC);
      setMeta("property", "og:type", "website");
      setMeta("property", "og:site_name", "ROBYNE");
      setMeta("name", "twitter:title", DEFAULT_TITLE);
      setMeta("name", "twitter:description", DEFAULT_DESC);
      setMeta("name", "twitter:card", "summary_large_image");
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
      removeMeta("property", "og:url");
    };
  }, []);
}
