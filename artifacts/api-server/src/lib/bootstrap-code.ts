import { timingSafeEqual } from "node:crypto";

export const MIN_BOOTSTRAP_CODE_BYTES = 32;
export const MAX_BOOTSTRAP_CODE_BYTES = 512;

export function verifyBootstrapCode(configuredCode: string | undefined, suppliedCode: unknown): boolean {
  if (!configuredCode || typeof suppliedCode !== "string") return false;

  const configured = Buffer.from(configuredCode, "utf8");
  const supplied = Buffer.from(suppliedCode, "utf8");
  if (
    configured.length < MIN_BOOTSTRAP_CODE_BYTES ||
    supplied.length === 0 ||
    supplied.length > MAX_BOOTSTRAP_CODE_BYTES ||
    configured.length !== supplied.length
  ) {
    return false;
  }

  return timingSafeEqual(configured, supplied);
}
