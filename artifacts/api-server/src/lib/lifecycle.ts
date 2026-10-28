import { and, eq, sql } from "drizzle-orm";
import { db, campaignsTable, electionsTable, eventsTable } from "@workspace/db";
import { invalidateDiscoverCache } from "./discover-cache";
import { logger } from "./logger";

export type LifecycleStatus = "upcoming" | "live" | "ended";

export function hasReachedDeadline(value: Date | string | null | undefined, now = new Date()): boolean {
  return value != null && new Date(value).getTime() <= now.getTime();
}

export function isBeforeStart(value: Date | string | null | undefined, now = new Date()): boolean {
  return value != null && new Date(value).getTime() > now.getTime();
}

export function getLifecycleStatus(
  startsAt: Date | string | null | undefined,
  endsAt: Date | string | null | undefined,
  now = new Date(),
): LifecycleStatus {
  if (isBeforeStart(startsAt, now)) return "upcoming";
  if (hasReachedDeadline(endsAt, now)) return "ended";
  return "live";
}

/**
 * Transitions time-bound records even when nobody is currently viewing them.
 * Request-time checks remain authoritative because a scheduler tick can never
 * be the only protection at an exact deadline or during a delayed request.
 */
export async function sweepExpiredLifecycles(): Promise<void> {
  const [elections, campaigns, events] = await Promise.all([
    db.update(electionsTable)
      .set({ status: "ended" })
      .where(and(
        eq(electionsTable.status, "active"),
        sql`${electionsTable.endsAt} IS NOT NULL AND ${electionsTable.endsAt} <= NOW()`,
      ))
      .returning({ id: electionsTable.id }),
    db.update(campaignsTable)
      .set({ status: "ended" })
      .where(and(
        eq(campaignsTable.status, "active"),
        sql`${campaignsTable.endsAt} IS NOT NULL AND ${campaignsTable.endsAt} <= NOW()`,
      ))
      .returning({ id: campaignsTable.id }),
    db.update(eventsTable)
      .set({ status: "completed" })
      .where(and(
        eq(eventsTable.status, "published"),
        sql`${eventsTable.endsAt} IS NOT NULL AND ${eventsTable.endsAt} <= NOW()`,
      ))
      .returning({ id: eventsTable.id }),
  ]);

  const transitioned = elections.length + campaigns.length + events.length;
  if (transitioned > 0) {
    logger.info(
      {
        elections: elections.map(({ id }) => id),
        campaigns: campaigns.map(({ id }) => id),
        events: events.map(({ id }) => id),
      },
      "Lifecycle sweep transitioned expired activities",
    );
    await invalidateDiscoverCache();
  }
}