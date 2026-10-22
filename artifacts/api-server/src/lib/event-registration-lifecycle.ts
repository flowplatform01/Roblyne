export type EventRegistrationBlockReason = "unavailable" | "closed" | null;

/**
 * An event's startsAt is its scheduled start, not when registration opens.
 * Ticket sale windows control when each tier can be claimed or purchased.
 */
export function getEventRegistrationBlockReason(
  status: string,
  endsAt: Date | string | null | undefined,
  now = new Date(),
): EventRegistrationBlockReason {
  if (status !== "published") return "unavailable";
  if (endsAt != null && new Date(endsAt).getTime() <= now.getTime()) return "closed";
  return null;
}
