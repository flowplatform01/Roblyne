export const EVENT_INVITE_VERIFICATION_TTL_MS = 4 * 60 * 60 * 1000;

export type EventInviteVerifications = Record<string, number>;

export function hasEventInviteVerification(
  verifications: EventInviteVerifications | undefined,
  eventId: number,
  now = Date.now(),
): boolean {
  const verifiedAt = verifications?.[String(eventId)];
  return typeof verifiedAt === "number" && verifiedAt > now - EVENT_INVITE_VERIFICATION_TTL_MS && verifiedAt <= now;
}

export function addEventInviteVerification(
  verifications: EventInviteVerifications | undefined,
  eventId: number,
  now = Date.now(),
): EventInviteVerifications {
  const freshEntries = Object.entries(verifications ?? {}).filter(([, verifiedAt]) => (
    typeof verifiedAt === "number" && verifiedAt > now - EVENT_INVITE_VERIFICATION_TTL_MS && verifiedAt <= now
  ));
  return { ...Object.fromEntries(freshEntries), [String(eventId)]: now };
}
