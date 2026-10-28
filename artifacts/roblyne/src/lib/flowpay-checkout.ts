export type CheckoutStatus = "pending" | "completed" | "failed";

export interface FlowPayCheckoutPayload {
  checkoutUrl?: string | null;
  paymentId?: number | null;
  statusToken?: string | null;
  title?: string;
  onCompleted?: (result: any) => void;
  onFailed?: (result: any) => void;
  onClosed?: () => void;
}

const SHEET_ID = "roblyne-flowpay-checkout-sheet";

function apiBase(): string {
  return import.meta.env.BASE_URL.replace(/\/$/, "");
}

/**
 * Opens FlowPay hosted checkout inside an embedded bottom-sheet / modal iframe.
 * Listens for window postMessage events and actively polls the backend status endpoint
 * until the transaction reaches a terminal state (succeeded / failed).
 */
function resolveCheckoutUrl(checkoutUrl: string): string {
  if (/^https?:\/\//i.test(checkoutUrl)) return checkoutUrl;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const origin = window.location.origin;
  if (checkoutUrl.startsWith("/")) {
    return `${origin}${basePath}${checkoutUrl}`;
  }
  return `${origin}${basePath}/${checkoutUrl}`;
}

export function openFlowPayCheckout(options: FlowPayCheckoutPayload): boolean {
  const rawCheckoutUrl = options.checkoutUrl?.trim();
  if (!rawCheckoutUrl) return false;
  const checkoutUrl = resolveCheckoutUrl(rawCheckoutUrl);

  // Dismiss any existing sheet
  document.getElementById(SHEET_ID)?.remove();

  const overlay = document.createElement("div");
  overlay.id = SHEET_ID;
  overlay.style.position = "fixed";
  overlay.style.inset = "0";
  overlay.style.zIndex = "99999";
  overlay.style.backgroundColor = "rgba(10, 22, 40, 0.75)";
  overlay.style.backdropFilter = "blur(12px)";
  overlay.style.display = "flex";
  overlay.style.alignItems = "flex-end";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "16px";
  overlay.style.animation = "fadeIn 0.2s ease-out";

  const sheet = document.createElement("div");
  sheet.style.width = "min(100%, 540px)";
  sheet.style.height = "min(90vh, 780px)";
  sheet.style.backgroundColor = "#0b1329";
  sheet.style.borderRadius = "24px 24px 18px 18px";
  sheet.style.overflow = "hidden";
  sheet.style.boxShadow = "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)";
  sheet.style.display = "flex";
  sheet.style.flexDirection = "column";

  // ── Header ──
  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";
  header.style.padding = "16px 20px";
  header.style.backgroundColor = "#0f172a";
  header.style.borderBottom = "1px solid rgba(255, 255, 255, 0.08)";

  const titleWrap = document.createElement("div");

  const title = document.createElement("div");
  title.textContent = options.title || "Complete Payment";
  title.style.fontWeight = "700";
  title.style.fontSize = "15px";
  title.style.color = "#f8fafc";
  title.style.display = "flex";
  title.style.alignItems = "center";
  title.style.gap = "8px";

  const badge = document.createElement("span");
  badge.textContent = "FlowPay";
  badge.style.fontSize = "11px";
  badge.style.fontWeight = "600";
  badge.style.padding = "2px 8px";
  badge.style.borderRadius = "6px";
  badge.style.backgroundColor = "rgba(79, 70, 229, 0.25)";
  badge.style.color = "#818cf8";
  badge.style.border = "1px solid rgba(129, 140, 248, 0.3)";
  title.appendChild(badge);

  const subtitle = document.createElement("div");
  subtitle.textContent = "Follow prompts on your phone or in the checkout below";
  subtitle.style.fontSize = "12px";
  subtitle.style.color = "#94a3b8";
  subtitle.style.marginTop = "3px";

  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.innerHTML = "&times;";
  closeButton.setAttribute("aria-label", "Close checkout");
  closeButton.style.width = "32px";
  closeButton.style.height = "32px";
  closeButton.style.borderRadius = "9999px";
  closeButton.style.border = "1px solid rgba(255, 255, 255, 0.1)";
  closeButton.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
  closeButton.style.color = "#94a3b8";
  closeButton.style.fontSize = "20px";
  closeButton.style.lineHeight = "1";
  closeButton.style.cursor = "pointer";
  closeButton.style.display = "flex";
  closeButton.style.alignItems = "center";
  closeButton.style.justifyContent = "center";

  header.appendChild(titleWrap);
  header.appendChild(closeButton);

  // ── Iframe ──
  const iframe = document.createElement("iframe");
  iframe.src = checkoutUrl;
  iframe.title = "FlowPay Secure Checkout";
  iframe.style.border = "0";
  iframe.style.width = "100%";
  iframe.style.flex = "1";
  iframe.style.backgroundColor = "#ffffff";
  iframe.allow = "payment *";

  // ── Terminal State Footer ──
  const footer = document.createElement("div");
  footer.style.display = "none";
  footer.style.padding = "14px 20px";
  footer.style.backgroundColor = "#0f172a";
  footer.style.borderTop = "1px solid rgba(255, 255, 255, 0.08)";
  footer.style.textAlign = "center";

  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.textContent = "Done";
  doneButton.style.border = "0";
  doneButton.style.borderRadius = "10px";
  doneButton.style.padding = "10px 24px";
  doneButton.style.fontWeight = "600";
  doneButton.style.fontSize = "14px";
  doneButton.style.color = "#ffffff";
  doneButton.style.backgroundColor = "#4f46e5";
  doneButton.style.cursor = "pointer";
  footer.appendChild(doneButton);

  sheet.appendChild(header);
  sheet.appendChild(iframe);
  sheet.appendChild(footer);
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  let terminal: CheckoutStatus | null = null;
  let pollInterval: number | undefined;

  const cleanup = () => {
    if (pollInterval) window.clearInterval(pollInterval);
    window.removeEventListener("message", onMessage);
    overlay.remove();
    options.onClosed?.();
  };

  const finish = (next: CheckoutStatus, resultData: any) => {
    if (terminal) return;
    terminal = next;
    if (pollInterval) window.clearInterval(pollInterval);

    if (next === "completed") {
      title.textContent = "Payment Confirmed";
      subtitle.textContent = "Recording your ballot…";
      subtitle.style.color = "#4ade80";
      footer.style.display = "block";
      options.onCompleted?.(resultData);
      // Keep sheet briefly so the parent page can move to the success state.
      window.setTimeout(() => {
        cleanup();
      }, 1200);
    } else {
      title.textContent = "Payment Not Completed";
      subtitle.textContent = "The payment could not be processed. Please try again.";
      subtitle.style.color = "#f87171";
      footer.style.display = "block";
      doneButton.textContent = "Close";
      options.onFailed?.(resultData);
    }
  };

  // Poll backend status endpoint
  const pollBackendStatus = async () => {
    if (terminal || !options.paymentId || !options.statusToken) return;
    try {
      const url = `${apiBase()}/api/payments/${options.paymentId}?statusToken=${encodeURIComponent(options.statusToken)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.status === "succeeded") {
        finish("completed", data.result || data);
      } else if (data?.status === "failed") {
        finish("failed", data);
      }
    } catch {
      // transient network error, retry on next interval
    }
  };

  // Listen to postMessage from FlowPay iframe. Never treat iframe "cancel"
  // as a hard failure when we can still confirm status from ROBLYNE/FlowPay.
  const onMessage = (event: MessageEvent) => {
    if (event.source !== iframe.contentWindow) return;
    const raw = event.data;
    if (!raw || typeof raw !== "object") return;
    const eventType = String(raw.type || raw.event || raw.status || "").toLowerCase();
    if (eventType.includes("success") || eventType.includes("complete") || eventType.includes("paid")) {
      void pollBackendStatus();
      return;
    }
    if (eventType.includes("fail") || eventType.includes("declin")) {
      void pollBackendStatus();
      return;
    }
    if (eventType.includes("cancel") || eventType.includes("close")) {
      void pollBackendStatus();
    }
  };

  closeButton.onclick = cleanup;
  doneButton.onclick = cleanup;
  window.addEventListener("message", onMessage);

  if (options.paymentId && options.statusToken) {
    pollInterval = window.setInterval(pollBackendStatus, 2000);
    // Initial fast poll after 1s
    window.setTimeout(pollBackendStatus, 1000);
  }

  return true;
}
