/**
 * Normalizes Cameroon and general phone numbers to E.164 format.
 *
 * Supported Cameroon phone patterns:
 * - 9 digits starting with 6 (mobile: MTN, Orange, Nexttel) or 2 (fixed):
 *   "671234567" -> "+237671234567"
 * - Country code prefix without plus:
 *   "237671234567" -> "+237671234567"
 * - International exit prefix 00:
 *   "00237671234567" -> "+237671234567"
 * - Formatted with delimiters (spaces, dashes, parentheses, dots):
 *   "+237 671-23-45-67" -> "+237671234567"
 *
 * General international E.164 is also accepted:
 *   "+14155552671" -> "+14155552671"
 */
export function normalizeCameroonPhone(raw?: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip whitespace, hyphens, dots, parentheses
  let sanitized = trimmed.replace(/[\s\-\.\(\)]/g, "");

  // Convert 00 international prefix to +
  if (sanitized.startsWith("00")) {
    sanitized = `+${sanitized.slice(2)}`;
  }

  // Local with leading zero (e.g. 06XXXXXXXX)
  if (/^0[62]\d{8}$/.test(sanitized)) {
    sanitized = sanitized.slice(1);
  }

  // Handle local Cameroon 9-digit format (mobile starting with 6, fixed with 2)
  if (/^[62]\d{8}$/.test(sanitized)) {
    return `+237${sanitized}`;
  }

  // Handle Cameroon 12-digit format without leading +
  if (/^237[62]\d{8}$/.test(sanitized)) {
    return `+${sanitized}`;
  }

  // Handle Cameroon full E.164 (+237 followed by 9 digits)
  if (/^\+237[62]\d{8}$/.test(sanitized)) {
    return sanitized;
  }

  // General international E.164 format (+ followed by 8-15 digits)
  if (/^\+[1-9]\d{7,14}$/.test(sanitized)) {
    return sanitized;
  }

  return null;
}

/**
 * Masks a phone number for diagnostic and audit logging without leaking customer PII.
 * Example: "+237671234567" -> "+237 6*** **67"
 */
export function maskPhoneNumber(phone?: string | null): string {
  if (!phone || typeof phone !== "string") return "[not-provided]";
  const clean = phone.trim();
  if (clean.length <= 4) return "****";
  if (clean.startsWith("+237") && clean.length === 13) {
    return `+237 ${clean[4]}*** **${clean.slice(-2)}`;
  }
  return `${clean.slice(0, 3)}****${clean.slice(-2)}`;
}
