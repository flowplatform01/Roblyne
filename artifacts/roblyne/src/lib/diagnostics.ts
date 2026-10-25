type ClientDiagnostic = {
  event: 'error' | 'unhandledrejection';
  message: string;
  stack?: string;
  componentStack?: string;
  route?: string;
};

const MAX_FIELD_LENGTH = 8_000;

function truncate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.length > MAX_FIELD_LENGTH
    ? `${value.slice(0, MAX_FIELD_LENGTH - 1)}…`
    : value;
}

/**
 * Sends non-sensitive client diagnostics to the API without interrupting the
 * user's flow. Reporting is deliberately best-effort: a diagnostics failure
 * must never become a second application failure.
 */
export function reportClientDiagnostic(input: ClientDiagnostic): void {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;

  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  const payload = {
    event: input.event,
    message: truncate(input.message) ?? 'Unknown client error',
    stack: truncate(input.stack),
    componentStack: truncate(input.componentStack),
    route: truncate(input.route ?? window.location.pathname),
  };

  void fetch(`${basePath}/api/diagnostics/client`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Diagnostics are intentionally best-effort.
  });
}

export function describeUnknownError(reason: unknown): string {
  if (reason instanceof Error) return reason.message || reason.name;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason) || 'Unknown promise rejection';
  } catch {
    return 'Unknown promise rejection';
  }
}